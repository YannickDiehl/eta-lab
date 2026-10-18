// Station 11's sandbox: two countries answer the same four tradition items. In country B
// the factor mean can differ (a real difference), and one item — "modest" — can be read
// differently: easier to agree with (its intercept) or more or less tied to tradition (its
// loading). The population moments go straight into the studio's estimator, so the
// invariance ladder shows what each kind of difference does to fit and to the factor mean.
import { fitModel, type Fitted, type GroupStats } from '../math/sem.ts';
import { fromLavaan, structure } from '../model/diagram.ts';
import { LEVELS, locks } from '../model/invariance.ts';

export const ITEMS = ['imptrad', 'ipmodst', 'ipfrule', 'ipbhprp'];
export const LABELS = ['tradition', 'modest', 'rules', 'behave'];
export const BIASED = 1;                               // "modest"
export const POP = { lambda: [0.85, 0.65, 0.95, 0.8], tau: [3.9, 4.2, 3.6, 4.4], theta: [1.0, 1.1, 0.8, 0.7] };
export const N_GROUP = 1000;

/** Country B: its factor mean (in SDs of A), the intercept shift and the loading of "modest". */
export interface World { kappa: number; bias: number; loadB: number }
export const FAIR: World = { kappa: 0.3, bias: 0, loadB: POP.lambda[BIASED] };

export const DIAGRAM = { ...fromLavaan(`Tradition =~ ${ITEMS.join(' + ')}`).diagram, stdlv: true };
const S = structure(DIAGRAM);
const LOCKS = locks(S);
const biasedNode = S.observed.find(v => S.names.get(v) === ITEMS[BIASED])!;
export const RELEASE = {
  intercept: LOCKS.find(l => l.kind === 'intercept' && l.node === biasedNode)!.key,
  loading: LOCKS.find(l => l.kind === 'loading' && l.node === biasedNode)!.key,
};
const factor = S.latent[0];

export function itemMeans(w: World): [number[], number[]] {
  const a = [...POP.tau];
  const b = POP.tau.map((t, i) => t + (i === BIASED ? w.bias : 0) + (i === BIASED ? w.loadB : POP.lambda[i]) * w.kappa);
  return [a, b];
}

export function moments(w: World): GroupStats[] {
  const lamB = POP.lambda.map((l, i) => (i === BIASED ? w.loadB : l));
  const cov = (lam: number[]) => lam.map((li, i) => lam.map((lj, j) => li * lj + (i === j ? POP.theta[i] : 0)));
  const [ma, mb] = itemMeans(w);
  return [
    { label: 'Country A', n: N_GROUP, names: ITEMS, means: ma, cov: cov(POP.lambda) },
    { label: 'Country B', n: N_GROUP, names: ITEMS, means: mb, cov: cov(lamB) },
  ];
}

export interface LadderResult { rungs: Fitted[]; mean: number | null; se: number | null }
/** The four rungs, with the chosen equalities released; the factor mean of B at the scalar rung. */
export function runLadder(w: World, free: string[] = []): LadderResult {
  const groups = moments(w);
  const rungs = LEVELS.map(level => fitModel(DIAGRAM, { groups, level, free })).filter((r): r is Fitted => r.ok);
  const q = rungs[2]?.params.find(p => p.group === 1 && p.op === '~1' && p.lhs === factor);
  return { rungs, mean: q ? q.est : null, se: q ? q.se : null };
}

/** What a comparison of raw item averages suggests, in SDs of the factor. */
export function naiveMean(w: World) {
  const [a, b] = itemMeans(w);
  const diff = a.reduce((s, _, i) => s + b[i] - a[i], 0) / a.length;
  return diff / (POP.lambda.reduce((s, l) => s + l, 0) / POP.lambda.length);
}
