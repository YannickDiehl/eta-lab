// The map of SEM · how a model is estimated. Every widget works on the small model of the matrix
// workshop, fitted to the real covariance matrix of four Dutch items (numbers from R in map.json):
//   BeOptimizer    turn the dials yourself until Σ(θ) is close to S — then let the computer finish
//   LikelihoodOne  what "maximum likelihood" means, for one variable and 25 people
//   LikelihoodGap  χ² as the gap between the model's likelihood and a perfect model's
//   ScaleSwitch    why ML is the default: rescale an item, and ML does not care (least squares does)
//   SearchReplay   the search step by step: starting values, iterations, convergence
//   WhatGoesWrong  not converged, Heywood cases, not identified — with lavaan's own words
//   ValleyWidth    a standard error is the width of the valley; Wald, LR and score test look at it
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Predict, Tex } from '../../components/ui.tsx';
import { gradient } from '../../math/optimize.ts';
import { normals, rng } from '../../math/stats.ts';
import { pnorm } from '../../stations/categories.ts';
import { MiniTask, NumberCheck } from '../day0/widgets.tsx';
import { fitToy, profile, rescale, rescaleStart, stdLoadings, threeTests, toyF, toySE, toySigma, TOY_LABEL, TOY_PARAMS, TOY_RANGE } from './estimate.ts';

// ---------------------------------------------------------------- data from R
export interface EstData {
  toy: {
    items: string[]; n: number; S: number[][]; par: string[]; est: number[]; se: number[]; start: number[];
    fmin: number; chisq: number; iterations: number; trace: number[]; resid_z: number[][]; mi: number;
    short_warning: string; cross_warning: string; se_expected: number[];
  };
  course: { n: number; logl: number; unrestricted: number; chisq: number; df: number; fmin: number; iterations: number; fiml_n: number; fiml_chisq: number; total: number; answered: Record<string, number>; scaling: number };
  ord: { items: string[]; counts: number[][]; thresholds: number[][]; poly: number; pearson: number };
}
export interface McData {
  heywood: { reps: number; rows: { n: number; ok: number; negative: number; noconv: number }[]; example: { warning: string; table: { par: string; est: number; se: number }[] } };
  mlr: { reps: number; rows: { dist: string; n: number; reps: number; truth: number; mean: number; sd: number; se_ml: number; se_mlr: number; cover_ml: number; cover_mlr: number; reject_ml: number; reject_mlr: number; hist: number[]; lo: number; hi: number }[] };
  fiml: { reps: number; n: number; truth_r: number; truth_m: number; rows: { mech: string; share: number; r_lw: number; r_fi: number; m_lw: number; m_fi: number; n_lw: number; n_fi: number; sd_r_lw: number; sd_r_fi: number }[] };
}
let mcCache: Promise<McData> | null = null;
export function useMcData() {
  const [d, setD] = useState<McData | null>(null);
  useEffect(() => {
    mcCache ??= fetch(`${import.meta.env.BASE_URL}data/map-mc.json`).then(r => r.json() as Promise<McData>);
    mcCache.then(setD).catch(() => setD(null));
  }, []);
  return d;
}

const free = (v: number[]) => v.filter((_, i) => i !== 0 && i !== 2);   // drop the two marker loadings (fixed to 1)
const ITEM_TXT: Record<string, string> = { ipfrule: 'follow rules', ipbhprp: 'behave properly', ipeqopt: 'equal opportunities', ipudrst: 'understand others' };
const PARAM_TXT = (items: string[]): Record<string, string> => ({
  l21: `${items[1]} on TRCO`, l42: `${items[3]} on UNIV`,
  t1: `error of ${items[0]}`, t2: `error of ${items[1]}`, t3: `error of ${items[2]}`, t4: `error of ${items[3]}`,
  p11: 'variance of TRCO', p22: 'variance of UNIV', p21: 'covariance TRCO–UNIV',
});
const f3 = (v: number) => (Number.isFinite(v) ? (v < 0 ? '−' : '') + Math.abs(v).toFixed(3) : '–');
const fF = (v: number) => (!Number.isFinite(v) ? 'impossible' : v < 0.01 ? v.toFixed(5) : v.toFixed(3));
const reduced = () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.visibilityState !== 'visible');

/** A path played back frame by frame (or at once, with reduced motion or a hidden page). */
function usePlayback(onFrame: (i: number) => void) {
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);
  return (frames: number, ms = 70, done?: () => void) => {
    if (timer.current) window.clearInterval(timer.current);
    if (reduced() || frames <= 1) { onFrame(frames - 1); done?.(); return; }
    let i = 0;
    timer.current = window.setInterval(() => {
      onFrame(i);
      i++;
      if (i >= frames) { window.clearInterval(timer.current!); timer.current = null; done?.(); }
    }, ms);
  };
}

/** A small lower-triangle matrix of the four items. */
function Mat4({ title, M, items, res }: { title: ReactNode; M: number[][]; items: string[]; res?: boolean }) {
  const bg = (v: number) => (!res ? undefined : v >= 0 ? `rgba(29,158,117,${Math.min(0.8, Math.abs(v) * 6)})` : `rgba(216,90,48,${Math.min(0.8, Math.abs(v) * 6)})`);
  return (
    <div className="mw-grid est-mat">
      <div className="mw-name">{title}</div>
      <table>
        <thead><tr><th />{items.map(c => <th key={c}>{c.slice(0, 7)}</th>)}</tr></thead>
        <tbody>{M.map((row, r) => <tr key={r}><th>{items[r].slice(0, 7)}</th>{row.map((v, c) => <td key={c}>{c > r ? <span className="mw-blank" /> : <span className={res ? 'res' : 'sigma'} style={{ background: bg(v) }}>{res ? (Math.abs(v) < 0.0005 ? '0' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(3)) : v.toFixed(3)}</span>}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** F on a log scale, with the lowest value the model can reach. */
function FMeter({ F, best, history }: { F: number; best: number; history: number[] }) {
  const lo = Math.log10(best / 2), hi = Math.log10(3);
  const pos = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, (hi - Math.log10(Math.max(v, 1e-9))) / (hi - lo))) : 0);
  const h = history.slice(-40), W = 160, H = 34;
  const pts = h.map((v, i) => `${(i / Math.max(1, h.length - 1)) * W},${H - pos(v) * H}`).join(' ');
  return (
    <div className="fmeter">
      <div className="fm-top"><span>distance between S and Σ(θ):</span><b><Tex>{'F_{ML}'}</Tex> = {fF(F)}</b></div>
      <div className="fm-bar"><i style={{ width: `${pos(F) * 100}%` }} /><em style={{ left: `${pos(best) * 100}%` }} title="the lowest possible value" /></div>
      <div className="fm-scale"><span>far (3)</span><span>lowest possible: {best.toFixed(5)}</span></div>
      {h.length > 1 && <svg viewBox={`0 0 ${W} ${H}`} className="fm-spark" aria-hidden="true"><polyline points={pts} fill="none" /></svg>}
    </div>
  );
}

// ---------------------------------------------------------------- E1 · be the optimizer
/** Where the learner left the dials by hand — a possible start for the search further down. */
const hand = { x: null as number[] | null, subs: new Set<() => void>() };
const setHand = (x: number[]) => { hand.x = x; hand.subs.forEach(f => f()); };
const useHand = () => useSyncExternalStore(f => { hand.subs.add(f); return () => { hand.subs.delete(f); }; }, () => hand.x);

export function BeOptimizer({ d }: { d: EstData }) {
  const { S, items, n } = d.toy;
  const firstGuess = useMemo(() => [1, 1, S[0][0] / 2, S[1][1] / 2, S[2][2] / 2, S[3][3] / 2, S[0][0] / 2, S[2][2] / 2, 0], [S]);
  const opt = useMemo(() => fitToy(S, free(d.toy.start)), [S, d.toy.start]);
  const [x, setX] = useState(firstGuess);
  const [hist, setHist] = useState<number[]>([toyF(S)(firstGuess)]);
  const [hints, setHints] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reached, setReached] = useState(false);
  const [byHand, setByHand] = useState(true);
  const [taskDone, setTaskDone] = useState(false);
  const F = toyF(S)(x);
  const Sig = useMemo(() => toySigma(x), [x]);
  const g = useMemo(() => (Number.isFinite(F) ? gradient(toyF(S), x) : x.map(() => 0)), [x, F, S]);
  const gmax = Math.max(...g.map(Math.abs), 1e-12);
  const txt = PARAM_TXT(items);
  const put = (nx: number[], manual = true) => {
    setX(nx);
    if (manual) setHand(nx);
    const f = toyF(S)(nx);
    setHist(h => [...h.slice(-60), f]);
    if (f < 0.01 && manual) setReached(true);
    if (!manual) setByHand(false);
  };
  const play = usePlayback(i => put(pathRef.current[i], false));
  const pathRef = useRef<number[][]>([]);
  const finish = () => {
    const r = fitToy(S, Number.isFinite(F) ? x : firstGuess);
    pathRef.current = r.path; setBusy(true);
    play(r.path.length, 70, () => setBusy(false));
  };
  const groups: [string, typeof TOY_PARAMS[number][]][] = [['Loadings', ['l21', 'l42']], ['Factor variances and covariance', ['p11', 'p22', 'p21']], ['Error variances', ['t1', 't2', 't3', 't4']]];
  return (
    <div className="fig est">
      <p className="hint" style={{ marginTop: 0 }}>The workshop model on real data: y₁ and y₂ measure tradition/conformity (TRCO), y₃ and y₄ universalism (UNIV) — {items.map((it, i) => <span key={it}>{i ? ', ' : ''}<b>y{'₁₂₃₄'[i]} = {it}</b> (“{ITEM_TXT[it]}”)</span>)}; {n} Dutch respondents. Nine dials — move them until Σ(θ) looks like S.</p>
      <div className="est-row">
        <div className="est-dials">
          {groups.map(([gname, keys]) => (
            <fieldset key={gname}><legend>{gname}</legend>
              {keys.map(k => {
                const i = TOY_PARAMS.indexOf(k), gi = g[i], show = hints && Math.abs(gi) > Math.max(gmax * 0.02, 2e-4);
                return (
                  <label key={k} className="ctl est-ctl">
                    <span>{TOY_LABEL[k]} <small>{txt[k]}</small></span>
                    <input type="range" min={TOY_RANGE[k][0]} max={TOY_RANGE[k][1]} step={0.005} value={x[i]} disabled={busy} onChange={e => { const nx = x.slice(); nx[i] = +e.target.value; setByHand(true); put(nx); }} />
                    <output>{x[i].toFixed(3)}{show && <i className="est-hint" style={{ opacity: 0.35 + 0.65 * Math.abs(gi) / gmax }} title={gi > 0 ? 'lower it' : 'raise it'}>{gi > 0 ? '▼' : '▲'}</i>}</output>
                  </label>
                );
              })}
            </fieldset>
          ))}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="tool" aria-pressed={hints} onClick={() => setHints(h => !h)}>{hints ? '✓ ' : ''}show which way is downhill</button>
            <button className="tool" disabled={busy} onClick={() => { setByHand(true); put(firstGuess); }}>reset</button>
            <button className="btn primary" disabled={busy} onClick={finish}>Let the computer finish →</button>
          </div>
          <div className="fm-mini" aria-hidden="true">F<sub>ML</sub> = <b>{fF(F)}</b>{F < 0.01 ? ' ✓' : ' · goal: below 0.01'}</div>
        </div>
        <div>
          <FMeter F={F} best={opt.value} history={hist} />
          {reached && <p className="est-goal ok">✓ F below 0.01 — by hand. That is what estimation does, only faster and to the last decimal.</p>}
          {!reached && byHand && <p className="est-goal">Goal: bring F below 0.01 by hand. {hints ? 'The arrows say which way each dial lowers F; the darker, the more it helps.' : 'Stuck? Switch on “which way is downhill”.'}</p>}
          {!byHand && !busy && <p className="est-goal">The computer stopped at F = {fF(F)} — the minimum. These are lavaan’s estimates (λ₂₁ = {f3(d.toy.est[1])}, λ₄₂ = {f3(d.toy.est[3])}, ψ₂₁ = {f3(d.toy.est[10])}); χ² = N · F = {n} · {F.toFixed(5)} = {(n * F).toFixed(2)}.</p>}
          <div className="mw-mats">
            <Mat4 title={<Tex>{'S'}</Tex>} M={S} items={items} />
            <Mat4 title={<Tex>{'\\Sigma(\\theta)'}</Tex>} M={Sig} items={items} />
            <Mat4 title={<Tex>{'S - \\Sigma(\\theta)'}</Tex>} M={S.map((r, i) => r.map((v, j) => v - Sig[i][j]))} items={items} res />
          </div>
        </div>
      </div>
      {!byHand && !busy && (
        <MiniTask done={taskDone} onRight={() => setTaskDone(true)}
          question="Even at the minimum F does not reach 0. Look at S − Σ(θ): where does the rest of the misfit sit?"
          options={['on the diagonal: in the variances', 'in the four covariances between a TRCO item and a UNIV item', 'in the covariance of the two TRCO items', 'spread evenly over all ten cells']}
          answer={1}
          explain={<>Right. The model has 9 parameters for 10 numbers: df = 1, one claim the data need not obey. Within each factor the model is free enough to fit exactly; the one claim concerns how the two factors connect — the four cross-covariances must follow one pattern (σ₃₁·σ₄₂ = σ₃₂·σ₄₁). The data deviate a little, and with one df the deviation cannot be pinned on one cell: lavaan’s standardized residuals are ±{Math.abs(d.toy.resid_z[2][0]).toFixed(2)} in all four, and every modification index equals χ² = {d.toy.mi.toFixed(2)}.</>} />
      )}
      <details className="deeper">
        <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>What “close” means, and what the computer does differently</span></summary>
        <div className="deeper-body">
          <p>F<sub>ML</sub> is 0 exactly when Σ(θ) = S, and positive otherwise. With df = 1, no θ makes Σ(θ) equal S — the minimum is the best compromise. The computer does what the arrows suggest: it computes the slope of F for every parameter at once (the <b>gradient</b>) and steps downhill, learning the curvature of the landscape as it goes (a quasi-Newton method). The browser needs about {opt.iterations} steps; lavaan’s optimizer (<code>nlminb</code>) needed {d.toy.iterations}. Same valley, same bottom.</p>
          <p className="hint">S here has the divisor N, as in lavaan’s <code>lavInspect(fit, "sampstat")</code>; the model is estimated with plain ML on the {n} respondents who answered all four items (listwise deletion), so the browser and lavaan minimise exactly the same function.</p>
        </div>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------- E2a · the likelihood of one variable
const PEOPLE = (() => { const u = rng(31); return normals(u, 25).map(z => 4.6 + 1.05 * z); })();
export function LikelihoodOne() {
  const [mu, setMu] = useState(3.4);
  const [v, setV] = useState(2.6);
  const N = PEOPLE.length, xbar = PEOPLE.reduce((a, b) => a + b, 0) / N, s2 = PEOPLE.reduce((a, b) => a + (b - xbar) ** 2, 0) / N;
  const dens = (x: number, m: number, s: number) => Math.exp(-((x - m) ** 2) / (2 * s)) / Math.sqrt(2 * Math.PI * s);
  const ll = (m: number, s: number) => PEOPLE.reduce((a, x) => a + Math.log(dens(x, m, s)), 0);
  const L = ll(mu, v), Lmax = ll(xbar, s2), found = Lmax - L < 0.15;
  const W = 520, H = 190, X = (x: number) => 20 + ((x - 1) / 7) * (W - 40), Y = (y: number) => H - 26 - y * 330;
  const curve = Array.from({ length: 141 }, (_, i) => 1 + (i / 140) * 7).map(x => `${X(x)},${Y(dens(x, mu, v))}`).join(' ');
  return (
    <div className="fig">
      <div className="fig-row">
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label="25 people on a scale with a normal curve; each person's line shows how likely their answer is under the curve">
            <line x1={X(1)} y1={Y(0)} x2={X(8)} y2={Y(0)} className="ax" />
            {[1, 2, 3, 4, 5, 6, 7, 8].map(t => <text key={t} x={X(t)} y={H - 8} className="f-lbl c">{t}</text>)}
            {PEOPLE.map((x, i) => <line key={i} x1={X(x)} y1={Y(0)} x2={X(x)} y2={Y(dens(x, mu, v))} className="lk-stick" />)}
            <polyline points={curve} className="lk-curve" fill="none" />
            {PEOPLE.map((x, i) => <circle key={i} cx={X(x)} cy={Y(0) + 6} r="3.5" className="lk-dot" />)}
          </svg>
          <label className="ctl"><span>mean μ</span><input type="range" min={2} max={7} step={0.02} value={mu} onChange={e => setMu(+e.target.value)} /><output>{mu.toFixed(2)}</output></label>
          <label className="ctl"><span>variance σ²</span><input type="range" min={0.2} max={4} step={0.02} value={v} onChange={e => setV(+e.target.value)} /><output>{v.toFixed(2)}</output></label>
        </div>
        <div className="fig-text">
          <p>Each dot is a person; the line above it is how <b>likely</b> their answer is if the curve were the truth. Multiply all 25 heights — or, easier, add their logarithms:</p>
          <div className="why-bars"><div><span>log-likelihood</span><i className="lat" style={{ width: `${Math.max(2, 100 - (Lmax - L) * 6)}%` }} /><b>{L.toFixed(1)}</b></div></div>
          {found
            ? <p className="est-goal ok">✓ The largest possible: μ̂ = {xbar.toFixed(2)}, σ̂² = {s2.toFixed(2)}. These are the sample mean and the variance with divisor N — the <b>maximum-likelihood</b> estimates: the values under which these data are most probable.</p>
            : <p className="est-goal">Your turn: make the data as probable as possible — the log-likelihood as large as you can get it.</p>}
          <p className="hint">Too narrow a curve, and the people in the tails become very improbable; too wide, and everyone becomes a little improbable. ML finds the balance.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- E2b · χ² as a gap in likelihood
export function LikelihoodGap({ d }: { d: EstData }) {
  const c = d.course, gap = c.unrestricted - c.logl;
  const [v, setV] = useState('');
  const lo = c.logl - 40, hi = c.unrestricted + 10, W = (x: number) => ((x - lo) / (hi - lo)) * 100;
  return (
    <div className="fig">
      <p className="hint" style={{ marginTop: 0 }}>The two-factor model of the course (tradition/conformity and universalism, seven items; plain ML, {c.n} respondents with complete answers).</p>
      <div className="lk-gap">
        <div><span>a perfect model (Σ = S, every covariance free)</span><i style={{ width: `${W(c.unrestricted)}%` }} className="obs" /><b>log L = {c.unrestricted.toFixed(2)}</b></div>
        <div><span>your model ({c.df} claims: df = {c.df})</span><i style={{ width: `${W(c.logl)}%` }} className="lat" /><b>log L = {c.logl.toFixed(2)}</b></div>
      </div>
      <div className="sc-formula"><Tex block>{`\\chi^2 = 2\\,(\\log L_{\\text{perfect}} - \\log L_{\\text{model}}) = 2 \\cdot ${gap.toFixed(2)} = ${(2 * gap).toFixed(2)} = N \\cdot F_{ML}`}</Tex></div>
      <p>The model’s claims cost likelihood. χ² measures how much — and asks whether that much could be chance. F<sub>ML</sub> is the same gap per person: χ² = N · F<sub>ML</sub>. One trap in the output: lavaan prints <code>fmin</code>, which is <b>half</b> of F<sub>ML</sub>, so χ² = 2 · N · fmin.</p>
      <pre className="syntax"><code>{`trco_univ_fit_ml <- cfa(
  model = "
    TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp
    UNIV =~ ipeqopt + ipudrst + impenv
  ",
  data = NL2,
  estimator = "ML"
)

trco_univ_fit_ml %>%
  fitMeasures(c("logl", "unrestricted.logl", "chisq", "fmin", "ntotal"))`}</code></pre>
      <NumberCheck label="2 · ntotal · fmin =" expect={c.chisq} tol={0.06} value={v} onChange={setV} unit="the χ² of the model" hint={`fmin = ${c.fmin.toFixed(7)}, ntotal = ${c.n}`} />
      <p className="hint">Optional — if you prepared the data on Day 0, compute it in R. Otherwise: {c.n} · 2 · {c.fmin.toFixed(7)} = {c.chisq.toFixed(2)}.</p>
    </div>
  );
}

// ---------------------------------------------------------------- E2c · ML does not care about units
export function ScaleSwitch({ d }: { d: EstData }) {
  const [ten, setTen] = useState(false);
  const { S, items } = d.toy;
  const res = useMemo(() => {
    const s0 = free(d.toy.start);
    const S10 = rescale(S, 0, 10), s10 = rescaleStart(s0, 0, 10);
    const ml0 = fitToy(S, s0), ml10 = fitToy(S10, s10), uls0 = fitToy(S, s0, { est: 'ULS' }), uls10 = fitToy(S10, s10, { est: 'ULS' });
    return { ml0: stdLoadings(ml0.x), ml10: stdLoadings(ml10.x), uls0: stdLoadings(uls0.x), uls10: stdLoadings(uls10.x) };
  }, [S, d.toy.start]);
  const ml = ten ? res.ml10 : res.ml0, uls = ten ? res.uls10 : res.uls0;
  return (
    <div className="fig">
      <div className="seg" role="group" aria-label="Unit of ipfrule">
        <button aria-pressed={!ten} onClick={() => setTen(false)}>{items[0]} on its scale 1–6</button>
        <button aria-pressed={ten} onClick={() => setTen(true)}>{items[0]} × 10 (10–60)</button>
      </div>
      <table className="rp-table">
        <thead><tr><th>standardized loading</th><th>ML</th><th>least squares (ULS)</th></tr></thead>
        <tbody>{items.map((it, i) => <tr key={it}><td>{it}</td><td>{ml[i].toFixed(3)}</td><td className={Math.abs(uls[i] - res.uls0[i]) > 0.0005 ? 'est-changed' : ''}>{uls[i].toFixed(3)}</td></tr>)}</tbody>
      </table>
      <p>{ten
        ? <>Multiply one item by ten and least squares gives a different solution: the large numbers of {items[0]} now dominate the sum of squared differences. ML gives the same standardized solution — and the same χ² — whatever the units.</>
        : <>Now change the unit of {items[0]}: the same answers, multiplied by ten. A good estimator should not care.</>}</p>
      <p className="hint">ML is <b>scale invariant</b>: it weighs every difference between S and Σ by how large the variances are. That, and its standard errors and χ² test, is why it is the default. Station 2.2 shows ML and least squares on one landscape.</p>
    </div>
  );
}

// ---------------------------------------------------------------- E3 · the search, step by step
type StartKind = 'lavaan' | 'half' | 'bad' | 'hand';
export function SearchReplay({ d }: { d: EstData }) {
  const { S, items } = d.toy;
  const [start, setStart] = useState<StartKind>('lavaan');
  const [maxIter, setMaxIter] = useState(100);
  const [k, setK] = useState(0);
  const handX = useHand();
  const x0 = useMemo(() => {
    if (start === 'half') return TOY_PARAMS.map(() => 0.5);
    if (start === 'bad') return [-1, -1, 0.7, 0.6, 0.4, 0.5, 0.05, 0.05, 0];
    if (start === 'hand' && handX) return handX;
    return free(d.toy.start);
  }, [start, d.toy.start, handX]);
  const run = useMemo(() => fitToy(S, x0, { maxIter }), [S, x0, maxIter]);
  const final = useMemo(() => fitToy(S, free(d.toy.start)).x, [S, d.toy.start]);
  useEffect(() => setK(run.path.length - 1), [run]);
  const play = usePlayback(i => setK(i));
  const F = toyF(S), fs = run.path.map(p => F(p));
  const xk = run.path[Math.min(k, run.path.length - 1)];
  const W = 520, H = 170, lo = Math.log10(1e-3), hi = Math.log10(5);
  const steps = Math.max(run.path.length - 1, start === 'lavaan' ? d.toy.trace.length - 1 : 0, 10);
  const X = (i: number) => 40 + (i / steps) * (W - 60), Y = (v: number) => 12 + ((hi - Math.log10(Math.max(v, 1e-3))) / (hi - lo)) * (H - 40);
  const line = (vs: number[]) => vs.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  const absurd = !run.converged || xk.some((v, i) => (i >= 2 && i <= 7 && v < 0) || Math.abs(v) > 5);
  return (
    <div className="fig">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="hint" style={{ margin: 0 }}>start at</span>
        <div className="seg wrap" role="group" aria-label="Starting values">
          <button aria-pressed={start === 'lavaan'} onClick={() => setStart('lavaan')}>lavaan’s starting values</button>
          <button aria-pressed={start === 'half'} onClick={() => setStart('half')}>everything 0.5</button>
          <button aria-pressed={start === 'bad'} onClick={() => setStart('bad')}>a bad start</button>
          {handX && <button aria-pressed={start === 'hand'} onClick={() => setStart('hand')}>where you left the dials (map, part 6)</button>}
        </div>
      </div>
      <label className="ctl"><span>maximum number of steps (<code>iter.max</code>)</span><input type="range" min={2} max={100} step={1} value={maxIter} onChange={e => setMaxIter(+e.target.value)} /><output>{maxIter}</output></label>
      <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label="F at each iteration of the search, on a log scale">
        {[1, 0.1, 0.01, 0.001].map(t => <g key={t}><line x1="40" x2={W - 20} y1={Y(t)} y2={Y(t)} className="grid" /><text x="34" y={Y(t) + 4} className="f-lbl r">{t}</text></g>)}
        <text x={W - 20} y={H - 6} className="f-lbl r">iteration →</text>
        {start === 'lavaan' && <polyline points={line(d.toy.trace)} className="srch-lav" fill="none" />}
        <polyline points={line(fs)} className="srch-js" fill="none" />
        <circle cx={X(k)} cy={Y(fs[Math.min(k, fs.length - 1)])} r="5" className="srch-dot" />
      </svg>
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => play(run.path.length, 90)}>▶ replay</button>
        <input type="range" min={0} max={run.path.length - 1} value={k} onChange={e => setK(+e.target.value)} aria-label="Iteration" style={{ flex: 1, minWidth: 140 }} />
        <span>step {k} of {run.path.length - 1} · F = {fF(fs[Math.min(k, fs.length - 1)])}</span>
      </div>
      <div className="srch-legend"><span><i className="js" />the browser’s search</span>{start === 'lavaan' && <span><i className="lav" />lavaan’s own record (<code>verbose = T</code>): {d.toy.iterations} iterations</span>}</div>
      <div className="srch-bars">
        {TOY_PARAMS.map((p, i) => {
          const v = xk[i], sc = (z: number) => 50 + Math.max(-50, Math.min(50, z * 25));
          return <div key={p}><span>{TOY_LABEL[p]}</span><div className="sb-track"><i className="sb-zero" style={{ left: '50%' }} /><i className="sb-final" style={{ left: `${sc(final[i])}%` }} /><b style={{ left: `${sc(v)}%` }} /></div><small>{f3(v)}</small></div>;
        })}
      </div>
      {run.converged
        ? <p className="est-goal ok">✓ Converged after {run.path.length - 1} steps: F stopped changing. {start === 'half' ? 'A different start, the same destination.' : ''}</p>
        : <div className="est-warn"><b>Warning message:</b><pre>{d.toy.short_warning.replace('lavaan->lav_lavaan_step11_estoptim():', 'lavaan:')}</pre><p>{start === 'bad'
          ? <>From this start the search wanders off: loadings far below zero, negative variances — and no end. Starting values matter: lavaan computes sensible ones from the data, and you can set your own with <code>start()</code> in the model syntax.</>
          : <>Not enough steps: the search stopped before the bottom. The estimates in the output would be meaningless. lavaan allows 10,000 steps by default; when a model still does not converge, the model is usually the problem, not the number of steps.</>}</p></div>}
      {absurd && run.converged && <p className="hint">Some values are implausible on the way — the search is allowed to pass through them, as long as it ends well.</p>}
      <p className="hint">The browser uses a quasi-Newton method like lavaan’s <code>nlminb</code>, but not the same one: the paths differ, the destination is the same. Items: y₁ = {items[0]}, y₂ = {items[1]}, y₃ = {items[2]}, y₄ = {items[3]}. The ticks mark the final estimates.</p>
    </div>
  );
}

// ---------------------------------------------------------------- E3d · what can go wrong
export function WhatGoesWrong({ d, mc }: { d: EstData; mc: McData | null }) {
  const [ni, setNi] = useState(0);
  const row = mc?.heywood.rows[ni];
  return (
    <div className="wrong-cards">
      <div className="card">
        <b>1 · No convergence</b>
        <p>“the optimizer warns that a solution has NOT been found!” The search did not reach the bottom. Typical causes: a model that does not suit the data, variables on very different scales (variances of 1 and 1,000), too few respondents, poor starting values. Check the model first; then rescale variables; then give starting values with <code>start()</code>.</p>
      </div>
      <div className="card">
        <b>2 · Heywood case: a negative variance</b>
        <p>The search ends — at an impossible value, such as an error variance below 0. How often does it happen to our small model in samples of different size? {mc ? `${mc.heywood.reps} samples each, simulated from the estimates:` : ''}</p>
        {mc && row && <>
          <div className="seg" role="group" aria-label="Sample size">{mc.heywood.rows.map((r, i) => <button key={r.n} aria-pressed={i === ni} onClick={() => setNi(i)}>n = {r.n}</button>)}</div>
          <div className="hw-bar">
            <i className="ok" style={{ width: `${row.ok * 100}%` }} title="fine" /><i className="neg" style={{ width: `${row.negative * 100}%` }} title="negative variance" /><i className="nc" style={{ width: `${row.noconv * 100}%` }} title="not converged" />
          </div>
          <p className="hw-legend"><span><i className="ok" />fine {Math.round(row.ok * 100)} %</span><span><i className="neg" />negative variance or |r| &gt; 1: {Math.round(row.negative * 100)} %</span><span><i className="nc" />not converged {Math.round(row.noconv * 100)} %</span></p>
          <details className="deeper"><summary><span className="shape d" aria-hidden="true" /><span>One such sample (n = 50)</span></summary>
            <div className="deeper-body"><pre className="est-out">{`Warning message:\n${mc.heywood.example.warning.replace('lavaan->lav_object_post_check():', 'lavaan:')}\n\n${mc.heywood.example.table.map(t => `${t.par.padEnd(20)} ${t.est.toFixed(3).padStart(7)} ${t.se.toFixed(3).padStart(7)}`).join('\n')}`}</pre>
              <p className="hint">The error variance of ipudrst is −0.256 — with a standard error of 1.6: the data cannot tell. Two items per factor and few respondents are the classic recipe. Remedies: more items, more respondents, a better model — not simply fixing the variance to 0.</p></div></details>
        </>}
      </div>
      <div className="card">
        <b>3 · Not identified, although df ≥ 0</b>
        <p>A model in which one item of a two-item factor also loads on the other factor: df = 0, the search may even end, but lavaan cannot compute standard errors:</p>
        <pre className="est-out">{d.toy.cross_warning.replace('lavaan->lav_model_vcov():', 'lavaan:')}</pre>
        <p className="hint">Several sets of values fit equally well; the valley has a flat floor. Counting df is necessary, not sufficient (the matrix workshop on the map of SEM, part 5, lets you try it).</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- E4 · the width of the valley
const VALLEY: { k: number; label: string }[] = [{ k: 0, label: 'λ₂₁ (ipbhprp on TRCO)' }, { k: 1, label: 'λ₄₂ (ipudrst on UNIV)' }, { k: 8, label: 'ψ₂₁ (covariance of the factors)' }, { k: 2, label: 'θ₁₁ (error of ipfrule)' }];
const MULT = [0.25, 0.5, 1, 2, 4];
export function ValleyWidth({ d }: { d: EstData }) {
  const { S, n } = d.toy;
  const xhat = useMemo(() => fitToy(S, free(d.toy.start)).x, [S, d.toy.start]);
  const se = useMemo(() => toySE(S, xhat, n), [S, xhat, n]);
  const [pi, setPi] = useState(1);
  const [mi, setMi] = useState(2);
  const k = VALLEY[pi].k, m = MULT[mi];
  const prof = useMemo(() => profile(S, xhat, k, Array.from({ length: 33 }, (_, i) => xhat[k] + ((i - 16) / 4) * se[k]), n), [S, xhat, k, se, n]);
  const tests = useMemo(() => (k === 1 ? threeTests(S, xhat, 1, 1, n) : null), [S, xhat, k, n]);
  const W = 520, H = 220, vlo = xhat[k] - 4 * se[k], vhi = xhat[k] + 4 * se[k], top = 16;
  const X = (v: number) => 40 + ((v - vlo) / (vhi - vlo)) * (W - 60), Y = (y: number) => H - 26 - (Math.min(y, top) / top) * (H - 46);
  const curve = prof.map(p => `${X(p.v)},${Y(m * p.d)}`).join(' ');
  const para = Array.from({ length: 81 }, (_, i) => vlo + (i / 80) * (vhi - vlo)).map(v => `${X(v)},${Y(m * ((v - xhat[k]) / se[k]) ** 2)}`).join(' ');
  const seM = se[k] / Math.sqrt(m);
  // profile interval: where m·d crosses 3.84
  const cross = (side: -1 | 1) => {
    const pts = prof.filter(p => Math.sign(p.v - xhat[k]) === side).sort((a, b) => side * (a.v - b.v));
    let prev = { v: xhat[k], d: 0 };
    for (const p of pts) { if (m * p.d >= 3.84) return prev.v + ((3.84 - m * prev.d) / (m * p.d - m * prev.d)) * (p.v - prev.v); prev = p; }
    return NaN;
  };
  const pl = cross(-1), pu = cross(1);
  return (
    <div className="fig">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="seg wrap" role="group" aria-label="Parameter">{VALLEY.map((v, i) => <button key={v.k} aria-pressed={i === pi} onClick={() => setPi(i)}>{v.label}</button>)}</div>
      </div>
      <label className="ctl"><span>respondents</span><input type="range" min={0} max={4} step={1} value={mi} onChange={e => setMi(+e.target.value)} /><output>{Math.round(n * m)} ({m === 1 ? 'the real N' : m < 1 ? `${m === 0.25 ? '¼' : '½'} N` : `${m} × N`})</output></label>
      <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label="The valley of F around the estimate, its width the standard error">
        <line x1="40" x2={W - 20} y1={Y(3.84)} y2={Y(3.84)} className="vl-384" /><text x={W - 20} y={Y(3.84) - 4} className="f-lbl r">3.84</text>
        <rect x={X(xhat[k] - 1.96 * seM)} y={H - 24} width={X(xhat[k] + 1.96 * seM) - X(xhat[k] - 1.96 * seM)} height="6" className="vl-wald" />
        {Number.isFinite(pl) && Number.isFinite(pu) && <rect x={X(pl)} y={H - 16} width={X(pu) - X(pl)} height="6" className="vl-prof" />}
        <polyline points={para} className="vl-para" fill="none" />
        <polyline points={curve} className="vl-curve" fill="none" />
        <line x1={X(xhat[k])} x2={X(xhat[k])} y1={Y(0)} y2={Y(top)} className="grid" />
        {k === 1 && <><line x1={X(1)} x2={X(1)} y1={Y(0)} y2={Y(top)} className="vl-h0" /><text x={X(1) + 4} y="16" className="f-lbl">λ₄₂ = 1?</text></>}
        {[-4, -2, 0, 2, 4].map(t => <text key={t} x={X(xhat[k] + t * se[k])} y={H - 30 + 0} className="f-lbl c" dy="-2">{(xhat[k] + t * se[k]).toFixed(2)}</text>)}
        <text x="34" y={Y(top) + 8} className="f-lbl r">χ²</text>
      </svg>
      <div className="srch-legend"><span><i className="js" />N · ΔF: the valley (the other parameters re-estimated at each point)</span><span><i className="para" />parabola from the curvature at the bottom</span><span><i className="wald" />estimate ± 1.96 SE</span><span><i className="prof" />where the valley rises by 3.84</span></div>
      <p>Estimate {f3(xhat[k])}, standard error <b>{seM.toFixed(3)}</b>{m === 1 ? <> — lavaan prints {d.toy.se[[1, 3, 10, 4][pi]].toFixed(3)}</> : ''}. 95 % interval {f3(xhat[k] - 1.96 * seM)} to {f3(xhat[k] + 1.96 * seM)}. A steep valley pins the value down; a flat one leaves it open. {m !== 1 ? `With ${m < 1 ? 'fewer' : 'more'} respondents the valley is ${m < 1 ? 'flatter' : 'steeper'}: the standard error changes with 1/√n.` : 'Move the number of respondents.'}</p>
      {tests && (
        <div className="three-tests">
          <p><b>One valley, three tests.</b> Is ipudrst’s loading equal to the marker’s, λ₄₂ = 1 (Day 3: restrictions)?</p>
          <table className="rp-table left"><thead><tr><th>test</th><th>looks at</th><th>χ²(1)</th><th>p</th><th>lavaan</th></tr></thead>
            <tbody>
              <tr><td>Wald</td><td>the distance of the bottom from 1, in standard errors (z²)</td><td>{(tests.wald * m).toFixed(2)}</td><td>{pval(tests.wald * m)}</td><td><code>lavTestWald()</code>, the z of the output</td></tr>
              <tr><td>likelihood ratio</td><td>how much higher the valley is at 1 than at the bottom</td><td>{(tests.lr * m).toFixed(2)}</td><td>{pval(tests.lr * m)}</td><td><code>lavTestLRT()</code>, Δχ²</td></tr>
              <tr><td>score (Lagrange)</td><td>how steep the valley is at 1</td><td>{(tests.score * m).toFixed(2)}</td><td>{pval(tests.score * m)}</td><td><code>lavTestScore()</code>, modification indices</td></tr>
            </tbody></table>
          <p className="hint">With large samples the three agree. Here, near the line of 3.84, they do not quite: Wald says “keep”, the other two say “reject”. The modification indices of section 5 are score tests, the Δχ² of section 6 is a likelihood-ratio test, and the z in every output is a Wald test. All three numbers are lavaan’s, to the second decimal.</p>
        </div>
      )}
      <Predict question="With four times as many respondents, how large is the standard error of λ₄₂? (Now: 0.187.)" min={0.02} max={0.4} step={0.005} start={0.3} truth={0.0935} format={v => v.toFixed(3)}
        explain={() => <>Half as large: the SE shrinks with 1/√n, and √4 = 2. To halve the uncertainty you need four times the data — set the slider to 4 × N and see the valley.</>} />
      <details className="deeper">
        <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>Information, curvature and lavaan’s choices</span></summary>
        <div className="deeper-body">
          <div className="sc-formula"><Tex block>{'\\operatorname{Cov}(\\hat\\theta) = \\big(N \\cdot I(\\hat\\theta)\\big)^{-1}, \\qquad I_{jk} = \\tfrac12 \\operatorname{tr}\\!\\Big(\\Sigma^{-1}\\tfrac{\\partial\\Sigma}{\\partial\\theta_j}\\Sigma^{-1}\\tfrac{\\partial\\Sigma}{\\partial\\theta_k}\\Big)'}</Tex></div>
          <p>The <b>information matrix</b> I is the curvature of the valley per respondent; its inverse, divided by N, holds the squared standard errors on the diagonal (<code>vcov(fit)</code>). lavaan computes the <i>expected</i> curvature for ML with complete data — this page does the same, and its standard errors match lavaan’s. With MLR or FIML lavaan uses the <i>observed</i> curvature at the minimum; here the two differ in the third decimal.</p>
          <pre className="syntax"><code>{`toy_fit %>% vcov() %>% diag() %>% sqrt()          # the standard errors
toy_fit %>% lavInspect(what = "information")       # I, per respondent`}</code></pre>
        </div>
      </details>
    </div>
  );
}
/** p of χ²(1): 2·(1 − Φ(√χ²)). */
const pval = (chi: number) => { const p = 2 * (1 - pnorm(Math.sqrt(chi))); return p < 0.001 ? '< .001' : p.toFixed(3).replace(/^0/, ''); };
