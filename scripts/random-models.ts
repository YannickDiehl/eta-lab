// Draws many random path diagrams the way a learner might (factors, items, cross-loadings,
// higher-order factors, covariates, observed outcomes, regressions, covariances, loose ends)
// and writes what η Lab makes of them: the lavaan syntax, df and the number of free parameters.
// scripts/crosscheck.R feeds the same syntax to lavaan and compares.
//
//   node --import tsx scripts/random-models.ts 2000 > /tmp/models.json
//   Rscript scripts/crosscheck.R /tmp/models.json
//
// With a third argument "groups", every model also gets 2–3 groups, a rung of the invariance
// ladder and a few released equalities (partial invariance), and df comes from invariance.ts.
//   node --import tsx scripts/random-models.ts 2000 7 groups > /tmp/mg.json
// "constraints" adds random equality labels, fixed values, freed markers and std.lv.
import { analyse, fromLavaan, modelLines, uid, type DEdge, type Diagram, type DNode, type EdgeKind } from '../src/model/diagram.ts';
import { rng } from '../src/math/stats.ts';
import { EQUAL, GROUP_EQUAL, LEVELS, ladder } from '../src/model/invariance.ts';

const N = Number(process.argv[2] ?? 1000);
const r = rng(Number(process.argv[3] ?? 2027));
const GROUPS = process.argv.includes('groups');
const CONSTRAINTS = process.argv.includes('constraints');
const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
const chance = (p: number) => r() < p;

function randomDiagram(): Diagram {
  const nodes: DNode[] = [], edges: DEdge[] = [];
  const add = (kind: 'latent' | 'observed', label: string) => { const n = { id: uid('n'), kind, label, x: 0, y: 0 }; nodes.push(n); return n; };
  const edge = (kind: EdgeKind, from: DNode, to: DNode) => { if (from.id !== to.id) edges.push({ id: uid('e'), kind, from: from.id, to: to.id }); };
  const nF = pick([0, 1, 1, 2, 2, 2, 3, 3, 4]);
  const factors = Array.from({ length: nF }, (_, i) => add('latent', `F${i + 1}`));
  const items: DNode[] = [];
  factors.forEach(f => {
    const k = pick([0, 1, 2, 3, 3, 4, 4, 5]);
    for (let j = 0; j < k; j++) { const it = add('observed', `${f.label.toLowerCase()}_${j + 1}`); items.push(it); edge('loading', f, it); }
  });
  if (items.length && nF > 1) factors.forEach(f => { if (chance(0.15)) edge('loading', f, pick(items)); });            // cross-loadings
  if (nF >= 2 && chance(0.12)) { const h = add('latent', 'H'); factors.filter(() => chance(0.8)).forEach(f => edge('path', h, f)); }  // higher-order
  factors.forEach(a => factors.forEach(b => { if (a !== b && chance(0.2)) edge('path', a, b); }));                       // structural paths
  const cov = Array.from({ length: pick([0, 0, 1, 2]) }, (_, i) => add('observed', `x${i + 1}`));
  cov.forEach(x => { const t = pick([...factors, ...items, ...cov]); if (t) edge('path', x, t); if (chance(0.3) && factors.length) edge('path', x, pick(factors)); });
  if (factors.length && chance(0.3)) { const y = add('observed', 'y_out'); edge(chance(0.5) ? 'path' : 'loading', pick(factors), y); if (chance(0.3)) edge('path', y, pick(factors)); }
  if (items.length && chance(0.15)) edge('path', pick(items), pick([...factors, ...items]));                         // item as predictor / item outcome
  const all = [...factors, ...items, ...cov];
  for (let k = pick([0, 0, 1, 1, 2, 3]); k > 0 && all.length > 1; k--) edge('cov', pick(all), pick(all));
  if (chance(0.15)) add(pick(['latent', 'observed'] as const), 'loose');
  if (chance(0.1) && nF) add('latent', 'empty_factor');
  // a learner can draw the same arrow twice; the model keeps it once
  const d: Diagram = { nodes, edges: edges.filter((e, i) => edges.findIndex(x => x.kind === e.kind && x.from === e.from && x.to === e.to) === i) };
  if (CONSTRAINTS) constrain(d);
  return d;
}

/** Equality labels, fixed values, freed markers, equal residual variances, std.lv — at random. */
function constrain(d: Diagram) {
  if (chance(0.25)) d.stdlv = true;
  const shuffled = <T,>(xs: T[]) => xs.map(x => [r(), x] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  // labels tie parameters of one kind, as in the course (equal loadings, equal paths, equal covariances)
  for (const lab of ['L1', 'L2']) if (chance(lab === 'L1' ? 0.45 : 0.2)) {
    const kind = pick(['loading', 'loading', 'path', 'cov'] as const);
    shuffled(d.edges.filter(e => e.kind === kind && !e.label)).slice(0, pick([2, 2, 3])).forEach(e => { e.label = lab; });
  }
  if (chance(0.2)) { const c = d.edges.find(e => e.kind === 'cov'); if (c) c.fix = 0; }
  if (chance(0.15)) { const l = shuffled(d.edges.filter(e => e.kind === 'loading'))[0]; if (l) l.fix = 0.5; }
  if (chance(0.15)) {
    // free the first loading of a factor and fix its variance instead (NA* plus F ~~ 1*F)
    const f = d.nodes.find(n => n.kind === 'latent' && d.edges.some(e => e.from === n.id && e.kind === 'loading'));
    if (f) { d.edges.find(e => e.from === f.id && e.kind === 'loading')!.free = true; f.varFix = 1; }
  }
  if (chance(0.2)) shuffled(d.nodes.filter(n => n.kind === 'observed')).slice(0, 2).forEach(n => { n.varLabel = 'E'; });
}

const out: { id: number; model: string; df: number; npar: number; observed: string[]; roundTripDf: number; blocked: boolean; circular: boolean; stdlv: boolean;
  groups?: { G: number; level: string; eq: string[]; partial: string[] } }[] = [];
for (let i = 0; out.length < N && i < N * 20; i++) {
  const d = randomDiagram();
  const a = analyse(d);
  if (a.p < 2) continue;
  const lines = modelLines(d).filter(l => l && !l.startsWith('#'));
  if (GROUPS) {
    if (a.blocked || !a.s.latent.length) continue;
    const G = pick([2, 2, 3]), level = pick(LEVELS);
    const kinds = EQUAL[level];
    const all = ladder(d, G).locks.filter(l => kinds.includes(l.kind));
    const free = all.filter(() => chance(0.15)).slice(0, 3);
    const lad = ladder(d, G, free.map(l => l.key), level);
    out.push({
      id: out.length + 1, model: lines.join('\n'), df: lad.rungs[LEVELS.indexOf(level)].df, npar: -1,
      observed: a.s.observed.map(id => a.s.names.get(id)!), roundTripDf: lad.rungs[LEVELS.indexOf(level)].df, blocked: false, circular: false, stdlv: !!d.stdlv,
      groups: { G, level, eq: kinds.map(k => GROUP_EQUAL[k]), partial: free.map(l => l.partial) },
    });
    continue;
  }
  const backD = fromLavaan(lines.join('\n')).diagram;
  backD.stdlv = d.stdlv;                       // std.lv is an argument of cfa()/sem(), not part of the model text
  const back = analyse(backD);
  out.push({
    id: out.length + 1, model: lines.join('\n'), df: a.df,
    npar: a.s.params.filter(p => p.free).length,
    observed: a.s.observed.map(id => a.s.names.get(id)!),
    roundTripDf: back.df,
    blocked: !!a.blocked,
    circular: !!a.blocked?.startsWith('Some factors measure each other'),
    stdlv: !!d.stdlv,
  });
}
process.stdout.write(JSON.stringify(out));
