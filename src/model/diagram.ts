// ---------------------------------------------------------------------------
// The learner's own model as a path diagram: what it is, what it implies.
//
//   nodes: latent variables (ellipses) and observed items (boxes)
//   edges: loading  (factor → its indicator; also factor → factor for a higher-order factor)
//          path     (regression: predictor → outcome)
//          cov      (two-headed: covariance, or residual covariance)
//
// structure() turns the drawing into lavaan's parameter table with lavaan's
// defaults for sem()/cfa(): first loading fixed to 1, a single indicator's
// residual variance fixed to 0, exogenous factors covary, the residuals of pure
// outcomes covary, observed covariates are fixed.x. analyse() counts it and
// writes plain-language notes for η; toLavaan() writes the syntax;
// fromLavaan() reads syntax back into a drawing.
// ---------------------------------------------------------------------------

export type NodeKind = 'latent' | 'observed';
export type EdgeKind = 'loading' | 'path' | 'cov';
/** varFix / varLabel: a fixed value or an equality label for the shape's (residual) variance. */
export interface DNode { id: string; kind: NodeKind; label: string; x: number; y: number; varFix?: number; varLabel?: string }
/** fix: a fixed value (lavaan 0.5*x) · label: an equality label (a*x) · free: free a first loading (NA*x)
 *  moderator: a latent interaction — the effect of `from` on `to` depends on this node (to ~ from + moderator + from:moderator). */
export interface DEdge { id: string; kind: EdgeKind; from: string; to: string; fix?: number; label?: string; free?: boolean; moderator?: string }
/** stdlv: identify factors by fixing their variances to 1 instead of a first loading (lavaan's std.lv = TRUE). */
export interface Diagram { nodes: DNode[]; edges: DEdge[]; stdlv?: boolean }

export const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 8)}`;

const UMLAUT: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' };
/** A valid R/lavaan name from a free-text label. */
export function varName(label: string, fallback: string): string {
  const s = label.trim().replace(/[äöüÄÖÜß]/g, c => UMLAUT[c]).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_.]+/g, '_').replace(/^[_.]+|_+$/g, '');
  const n = s || fallback;
  return /^[A-Za-z]/.test(n) ? n : `v_${n}`;
}

/** The kind a new arrow gets: from a factor to a box it is a loading, otherwise a regression. */
export function edgeKind(d: Diagram, from: string, to: string, two: boolean): EdgeKind | null {
  if (from === to) return null;
  const a = d.nodes.find(n => n.id === from), b = d.nodes.find(n => n.id === to);
  if (!a || !b) return null;
  if (two) return 'cov';
  return a.kind === 'latent' && b.kind === 'observed' ? 'loading' : 'path';
}

/** Add an arrow. Drawing an arrow that already exists (or its reverse covariance) changes nothing;
 *  a one-headed arrow between two nodes that already share one in the other direction is allowed (feedback loop). */
export function addEdge(d: Diagram, from: string, to: string, two: boolean): Diagram {
  const kind = edgeKind(d, from, to, two);
  if (!kind) return d;
  const same = (e: DEdge) => kind === 'cov'
    ? e.kind === 'cov' && ((e.from === from && e.to === to) || (e.from === to && e.to === from))
    : e.kind !== 'cov' && e.from === from && e.to === to;
  if (d.edges.some(same)) return d;
  return { ...d, edges: [...d.edges, { id: uid('e'), kind, from, to }] };
}

// ---------------------------------------------------------------------------
// From drawing to parameter table
// ---------------------------------------------------------------------------

export type Op = '=~' | '~' | '~~';
export interface Param {
  op: Op; lhs: string; rhs: string;      // node ids, in lavaan's orientation (lhs =~ rhs, lhs ~ rhs, lhs ~~ rhs)
  free: boolean;
  fixed?: number | 'data';               // value of a fixed parameter; 'data' = fixed.x, taken from the sample
  auto: boolean;                         // added by lavaan, not drawn
  edge?: string;                         // the drawn edge behind it
  role: 'loading' | 'regression' | 'variance' | 'covariance';
  label?: string;                        // equality label: parameters with the same label are one parameter
  stdlvFixed?: boolean;                  // a factor variance fixed to 1 by std.lv (freed in later groups when loadings are equal)
}
export interface Structure {
  names: Map<string, string>;            // node id → lavaan name
  latent: string[];                      // factors that have indicators
  observed: string[];                    // boxes used in the model
  phantom: string[];                     // factors drawn without indicators (left out of the syntax)
  load: DEdge[]; reg: DEdge[]; cov: DEdge[];
  higher: string[];                      // factors whose indicators are factors
  roles: { ovx: string[]; ovy: string[]; lvx: string[]; lvy: string[] };
  params: Param[];
}

export function lavaanNames(d: Diagram): Map<string, string> {
  const names = new Map<string, string>(), seen = new Set<string>();
  d.nodes.forEach((n, i) => {
    let nm = varName(n.label, n.kind === 'latent' ? `F${i + 1}` : `x${i + 1}`);
    if (seen.has(nm)) { let k = 2; while (seen.has(`${nm}_${k}`)) k++; nm = `${nm}_${k}`; }
    seen.add(nm); names.set(n.id, nm);
  });
  return names;
}

export function structure(d: Diagram): Structure {
  const byId = new Map(d.nodes.map(n => [n.id, n]));
  const edges = d.edges.filter(e => byId.has(e.from) && byId.has(e.to) && e.from !== e.to);
  const isLat = (id: string) => byId.get(id)!.kind === 'latent';
  const hasItems = (id: string) => edges.some(e => e.from === id && e.kind === 'loading' && !isLat(e.to));
  // a one-headed arrow from a factor is a loading when drawn as one, or when the factor
  // has no items of its own and points at another factor (a higher-order factor)
  const isLoad = (e: DEdge) => e.kind !== 'cov' && isLat(e.from) && (e.kind === 'loading' || (isLat(e.to) && !hasItems(e.from)));

  // factors need indicators; repeat because a higher-order factor needs indicators that are themselves factors
  let lat = new Set(d.nodes.filter(n => n.kind === 'latent').map(n => n.id));
  for (;;) {
    const next = new Set([...lat].filter(id => edges.some(e => e.from === id && isLoad(e) && (!isLat(e.to) || lat.has(e.to)))));
    if (next.size === lat.size) break;
    lat = next;
  }
  const keep = (id: string) => !isLat(id) || lat.has(id);
  const kept = edges.filter(e => keep(e.from) && keep(e.to));
  const load = kept.filter(isLoad), reg = kept.filter(e => e.kind !== 'cov' && !isLoad(e));
  const cov: DEdge[] = [];
  kept.filter(e => e.kind === 'cov').forEach(e => { if (!cov.some(c => (c.from === e.from && c.to === e.to) || (c.from === e.to && c.to === e.from))) cov.push(e); });

  const used = new Set(kept.flatMap(e => [e.from, e.to]));
  const latent = d.nodes.filter(n => lat.has(n.id)).map(n => n.id);
  const observed = d.nodes.filter(n => n.kind === 'observed' && used.has(n.id)).map(n => n.id);
  const phantom = d.nodes.filter(n => n.kind === 'latent' && !lat.has(n.id)).map(n => n.id);
  const higher = latent.filter(id => load.some(e => e.from === id && isLat(e.to)));

  const dep = new Set(reg.map(e => e.to)), pred = new Set(reg.map(e => e.from)), ind = new Set(load.map(e => e.to));
  const inCov = new Set(cov.flatMap(e => [e.from, e.to]));
  // a covariate with its own variance formula is no longer fixed.x (lavaan treats it as random)
  const varSpec = (v: string) => byId.get(v)!.varFix !== undefined || !!byId.get(v)!.varLabel;
  const ovx = observed.filter(v => pred.has(v) && !dep.has(v) && !ind.has(v) && !inCov.has(v) && !varSpec(v));
  const ovy = observed.filter(v => dep.has(v) && !pred.has(v) && !ind.has(v));
  const lvx = latent.filter(v => !dep.has(v) && !ind.has(v));
  const lvy = latent.filter(v => dep.has(v) && !pred.has(v) && !ind.has(v));

  const params: Param[] = [];
  const fixedZero = new Set<string>();
  const lab = (s?: string) => (s && s.trim() ? s.trim() : undefined);
  latent.forEach(f => {
    const ls = load.filter(e => e.from === f);
    ls.forEach((e, i) => {
      // lavaan's auto.fix.first: the first loading is 1 unless it carries a number, NA*, or std.lv is on
      const fixed = e.fix !== undefined ? e.fix : i === 0 && !e.free && !d.stdlv ? 1 : undefined;
      params.push({ op: '=~', lhs: f, rhs: e.to, free: fixed === undefined, fixed, auto: false, edge: e.id, role: 'loading', label: lab(e.label) });
    });
    // lavaan's auto.fix.single: a lone indicator (item or factor) that measures nothing else gets no residual variance
    if (ls.length === 1 && load.filter(e => e.to === ls[0].to).length === 1) fixedZero.add(ls[0].to);
  });
  reg.forEach(e => params.push({ op: '~', lhs: e.to, rhs: e.from, free: e.fix === undefined, fixed: e.fix, auto: false, edge: e.id, role: 'regression', label: lab(e.label) }));
  [...observed, ...latent].forEach(v => {
    const n = byId.get(v)!;
    if (n.varFix !== undefined) params.push({ op: '~~', lhs: v, rhs: v, free: false, fixed: n.varFix, auto: false, role: 'variance', label: lab(n.varLabel) });
    else if (lab(n.varLabel)) params.push({ op: '~~', lhs: v, rhs: v, free: true, auto: false, role: 'variance', label: lab(n.varLabel) });
    else if (ovx.includes(v)) params.push({ op: '~~', lhs: v, rhs: v, free: false, fixed: 'data', auto: true, role: 'variance' });
    else if (fixedZero.has(v)) params.push({ op: '~~', lhs: v, rhs: v, free: false, fixed: 0, auto: true, role: 'variance' });
    else if (d.stdlv && lat.has(v)) params.push({ op: '~~', lhs: v, rhs: v, free: false, fixed: 1, auto: true, role: 'variance', stdlvFixed: true });
    else params.push({ op: '~~', lhs: v, rhs: v, free: true, auto: true, role: 'variance' });
  });
  cov.forEach(e => params.push({ op: '~~', lhs: e.from, rhs: e.to, free: e.fix === undefined, fixed: e.fix, auto: false, edge: e.id, role: 'covariance', label: lab(e.label) }));
  const has = (a: string, b: string) => params.some(p => p.op === '~~' && ((p.lhs === a && p.rhs === b) || (p.lhs === b && p.rhs === a)));
  const pairs = (vs: string[], fixed?: 'data') => vs.forEach((a, i) => vs.slice(i + 1).forEach(b => {
    if (!has(a, b)) params.push({ op: '~~', lhs: a, rhs: b, free: !fixed, fixed, auto: true, role: 'covariance' });
  }));
  pairs(lvx); pairs([...ovy, ...lvy]); pairs(ovx, 'data');
  // with std.lv, lavaan frees every automatically fixed factor variance in groups 2, 3, … once loadings are equal —
  // also the 0 of a factor that is the lone indicator of a higher-order factor
  if (d.stdlv) params.forEach(p => { if (p.role === 'variance' && p.auto && lat.has(p.lhs) && typeof p.fixed === 'number') p.stdlvFixed = true; });
  // a label shared with a fixed parameter fixes every parameter with that label (as lavaan does)
  const fixedLabel = new Map<string, number>();
  params.forEach(p => { if (p.label && typeof p.fixed === 'number' && !fixedLabel.has(p.label)) fixedLabel.set(p.label, p.fixed); });
  params.forEach(p => { if (p.label && fixedLabel.has(p.label)) { p.fixed = fixedLabel.get(p.label); p.free = false; } });

  return { names: lavaanNames(d), latent, observed, phantom, load, reg, cov, higher, roles: { ovx, ovy, lvx, lvy }, params };
}

// ---------------------------------------------------------------------------
// Counting and notes
// ---------------------------------------------------------------------------

export interface Note { level: 'ok' | 'info' | 'warn'; text: string; node?: string }   // node: the shape the note is about
export interface Analysis {
  p: number; knowns: number; q: number; df: number;
  status: 'empty' | 'under' | 'just' | 'over';
  notes: Note[];
  parts: { label: string; count: number }[];
  s: Structure;
  /** lavaan will refuse this model (with its default LISREL representation) — why */
  blocked?: string;
}

/** Does the structural part contain a feedback loop? */
function hasCycle(reg: DEdge[]): boolean {
  const out = new Map<string, string[]>();
  reg.forEach(e => out.set(e.from, [...(out.get(e.from) ?? []), e.to]));
  const state = new Map<string, number>();
  const visit = (v: string): boolean => {
    if (state.get(v) === 1) return true;
    if (state.get(v) === 2) return false;
    state.set(v, 1);
    const r = (out.get(v) ?? []).some(visit);
    state.set(v, 2);
    return r;
  };
  return [...out.keys()].some(visit);
}

/** lavaan (LISREL representation, its default) turns some boxes into "dummy" factors: boxes in regressions
 *  and boxes that covary with a factor, plus their covariance neighbours. A covariance between a dummy box
 *  and an ordinary box then has no matrix to live in, and lavaan stops with "not defined in the LISREL
 *  representation". This mirrors lav_lisrel() so η can say so before R does. Returns the offending pair. */
function lisrelClash(s: Structure): [string, string] | null {
  const lat = new Set(s.latent), ovx = new Set(s.roles.ovx), obs = new Set(s.observed);
  const gamma = false;   // lavaan's GAMMA branch needs conditional.x = TRUE; sem()/cfa() default to FALSE
  // the ~~ rows of lavaan's parameter table, in lavaan's orientation
  const rows: [string, string][] = [...s.observed, ...s.latent].map(v => [v, v]);
  s.cov.forEach(e => rows.push([e.from, e.to]));
  const combn = (vs: string[]) => vs.forEach((a, i) => vs.slice(i + 1).forEach(b => {
    if (!rows.some(([l, r]) => (l === a && r === b) || (l === b && r === a))) rows.push([a, b]);
  }));
  combn(s.roles.lvx); combn([...s.roles.lvy, ...s.roles.ovy]); combn(s.roles.ovx);
  // lavaan writes every covariance with the variable that comes first in its variable list on the left:
  // factors (in =~ order), then boxes in order of appearance in the syntax, covariates last
  const seen: string[] = [];
  const see = (v: string) => { if (obs.has(v) && !seen.includes(v)) seen.push(v); };
  s.latent.forEach(f => s.load.filter(e => e.from === f).forEach(e => see(e.to)));
  [...new Set(s.reg.map(e => e.to))].forEach(y => { see(y); s.reg.filter(e => e.to === y).forEach(e => see(e.from)); });
  s.cov.forEach(e => { see(e.from); see(e.to); });
  const order = [...s.latent, ...seen.filter(v => !ovx.has(v)), ...seen.filter(v => ovx.has(v))];
  rows.forEach(r => { if (order.indexOf(r[0]) > order.indexOf(r[1])) r.reverse(); });
  const tmp = new Set(gamma ? s.reg.map(e => e.to) : s.reg.flatMap(e => [e.from, e.to]));
  const d1 = new Set([...tmp].filter(v => !lat.has(v)));
  const idx = rows.filter(([l, r]) => d1.has(l) || d1.has(r));
  const L1 = new Set(idx.map(([l]) => l)), R1 = new Set(idx.map(([, r]) => r));
  const idx1 = rows.filter(([l, r]) => L1.has(l) || R1.has(r));
  const d2 = new Set([...idx, ...idx1].flat());
  const d3 = new Set(rows.filter(([l, r]) => obs.has(l) !== obs.has(r)).map(([l, r]) => (obs.has(l) ? l : r)));
  const L = new Set([...lat, ...[...d1, ...d2, ...d3].filter(v => obs.has(v))]);
  const ovNames = new Set([...obs].filter(v => !gamma || !ovx.has(v)));
  for (const [a, b] of rows) {
    let mat = '', ok = true;
    if (!L.has(a)) { mat = 'theta'; ok = ovNames.has(a) && ovNames.has(b); }
    if (gamma && ovx.has(a)) { mat = 'cov.x'; ok = ovx.has(b); }
    if (L.has(b)) { mat = 'psi'; ok = L.has(a); }
    if (!mat || !ok) return [a, b];
  }
  return null;
}

export function analyse(d: Diagram): Analysis {
  const s = structure(d);
  const byId = new Map(d.nodes.map(n => [n.id, n]));
  const label = (id: string) => byId.get(id)?.label || (byId.get(id)?.kind === 'latent' ? 'factor' : 'item');
  const P = s.params;
  const p = s.observed.length, knowns = (p * (p + 1)) / 2;
  // parameters that share a label are one parameter: count only the first free one of each label
  const seenLabel = new Set<string>();
  const counted = new Set(P.filter(x => { if (!x.free || !x.label) return true; if (seenLabel.has(x.label)) return false; seenLabel.add(x.label); return true; }));
  const count = (f: (x: Param) => boolean) => P.filter(x => counted.has(x) && f(x)).length;
  const isLatId = (id: string) => s.latent.includes(id);
  const parts = [
    { label: d.stdlv ? 'loadings (all free: factor variances are fixed to 1)' : 'loadings (the first of each factor is fixed to 1)', count: count(x => x.role === 'loading' && x.free) },
    { label: 'regression paths', count: count(x => x.role === 'regression' && x.free) },
    { label: 'factor variances', count: count(x => x.role === 'variance' && x.free && isLatId(x.lhs)) },
    { label: 'item (residual) variances', count: count(x => x.role === 'variance' && x.free && !isLatId(x.lhs)) },
    { label: 'covariances you drew', count: count(x => x.role === 'covariance' && !x.auto && x.free) },
    { label: 'covariances lavaan adds', count: count(x => x.role === 'covariance' && x.auto && x.free) },
    { label: 'covariate (co)variances, taken from the data', count: count(x => x.fixed === 'data') },
  ];
  const q = parts.reduce((a, x) => a + x.count, 0);
  const df = knowns - q;
  const status: Analysis['status'] = p === 0 ? 'empty' : df < 0 ? 'under' : df === 0 ? 'just' : 'over';

  // ---- notes for η
  const notes: Note[] = [];
  let blocked: string | undefined;
  if (d.nodes.length === 0) notes.push({ level: 'info', text: 'Start with a latent variable for the construct you care about, then add its items.' });
  s.phantom.forEach(id => notes.push({ level: 'warn', node: id, text: `${label(id)} has no items yet. Draw arrows from it to its indicators — until then it stays out of the syntax.` }));
  // a factor is tied to the rest of the model by arrows, drawn covariances, a higher-order factor —
  // or by the covariance lavaan adds between factors that nothing predicts
  const links = (id: string) => s.reg.some(e => e.from === id || e.to === id) || s.cov.some(e => e.from === id || e.to === id)
    || s.load.some(e => e.to === id) || (s.roles.lvx.includes(id) && s.roles.lvx.length > 1);
  const singleOnPurpose: string[] = [];
  s.latent.forEach(f => {
    const ind = s.load.filter(e => e.from === f);
    const n = ind.length, name = label(f);
    if (s.higher.includes(f)) { notes.push({ level: 'ok', node: f, text: `${name} is a higher-order factor: its indicators are the factors ${ind.map(e => label(e.to)).join(', ')}.` }); return; }
    // a single-indicator factor drawn on purpose (fixed loading, or the item's error fixed — as in the RI-CLPM) is fine
    const deliberate = n === 1 && (ind[0].fix !== undefined || byId.get(ind[0].to)?.varFix !== undefined || s.load.filter(e => e.to === ind[0].to).length > 1);
    if (n === 1 && deliberate) singleOnPurpose.push(name);
    else if (n === 1) notes.push({ level: 'warn', node: f, text: `${name} has a single item. lavaan fixes that item’s noise to 0, so the factor is just the item (station 1.2).` });
    else if (n === 2 && !links(f)) notes.push({ level: 'warn', node: f, text: `${name} has two items and no link to other factors — not identified on its own (station 1.4).` });
    else if (n === 2) notes.push({ level: 'info', node: f, text: `${name} has two items. That works only through its relation to other factors; a third item makes it robust.` });
    else if (n === 3 && s.latent.length === 1 && !s.reg.length && !s.cov.length) notes.push({ level: 'info', node: f, text: `${name} has three items: estimable, but it fits perfectly by construction (station 1.3). A fourth item makes it testable.` });
    else notes.push({ level: 'ok', node: f, text: `${name} is measured by ${n} items.` });
  });
  if (singleOnPurpose.length) notes.push({ level: 'ok', text: `${singleOnPurpose.join(', ')} ${singleOnPurpose.length === 1 ? 'is' : 'are each'} carried by one item on purpose — the part of that item a factor stands for (as the within-person parts of an RI-CLPM).` });
  d.nodes.filter(n => n.kind === 'observed' && !s.observed.includes(n.id)).forEach(o => notes.push({ level: 'warn', node: o.id, text: `“${label(o.id)}” is not connected to anything yet.` }));
  // several loadings on one item; fixed ones split an item into parts on purpose (RI-CLPM), so they are no cross-loading
  s.observed.filter(v => s.load.filter(e => e.to === v).length > 1 && !s.load.some(e => e.to === v && e.fix !== undefined)).forEach(v =>
    notes.push({ level: 'info', node: v, text: `“${label(v)}” loads on ${s.load.filter(e => e.to === v).length} factors — a cross-loading. Each one costs a fact and needs a reason.` }));
  s.reg.filter(e => !isLatId(e.from) && s.load.some(x => x.to === e.from)).forEach(e =>
    notes.push({ level: 'info', node: e.from, text: `The item “${label(e.from)}” predicts “${label(e.to)}”. Usually its factor, not the item, should carry that path.` }));
  s.reg.filter(e => isLatId(e.from) && !isLatId(e.to) && !s.load.some(x => x.to === e.to)).forEach(e =>
    notes.push({ level: 'info', node: e.to, text: `“${label(e.to)}” is an observed outcome of ${label(e.from)} — measured without error, unlike a factor.` }));
  if (s.cov.some(e => !isLatId(e.from) && !isLatId(e.to) && s.load.some(x => x.to === e.from) && s.load.some(x => x.to === e.to)))
    notes.push({ level: 'info', text: 'You drew a residual covariance. Write down why those two items share more than their factor (station 2.3).' });
  const autoY = P.filter(x => x.role === 'covariance' && x.auto && x.free && (s.roles.ovy.includes(x.lhs) || s.roles.lvy.includes(x.lhs)));
  if (autoY.length) notes.push({ level: 'info', text: `lavaan lets the residuals of ${autoY.map(x => `${label(x.lhs)} and ${label(x.rhs)}`).join('; ')} covary on its own. “Show what lavaan adds” draws it; fix it to 0 in R if you do not want it.` });
  if (hasCycle(s.reg)) notes.push({ level: 'warn', text: 'Your arrows form a feedback loop. Such non-recursive models need extra conditions to be identified — counting facts is not enough.' });
  const dupes = new Map<string, string[]>();
  d.nodes.forEach(n => { const k = varName(n.label, ''); if (k) dupes.set(k, [...(dupes.get(k) ?? []), n.label]); });
  [...dupes].filter(([, v]) => v.length > 1).forEach(([k]) => notes.push({ level: 'warn', node: d.nodes.filter(n => varName(n.label, '') === k)[1]?.id, text: `Two shapes are both called “${k}”. Every box is one column of your data, so each name may appear only once.` }));
  const renamed = d.nodes.filter(n => n.kind === 'observed' && s.observed.includes(n.id) && n.label.trim() && s.names.get(n.id) !== n.label.trim());
  if (renamed.length) notes.push({ level: 'info', text: `lavaan names cannot contain spaces or special characters: ${renamed.slice(0, 3).map(n => `“${n.label}” → ${s.names.get(n.id)}`).join(', ')}${renamed.length > 3 ? ', …' : ''}. Item names must match your data’s columns.` });
  if (hasCycle(s.load.filter(e => isLatId(e.to))))
    blocked = 'Some factors measure each other in a circle (A is an indicator of B and B of A). A factor cannot be its own indicator — remove one of those arrows.';
  const clash = blocked ? null : lisrelClash(s);
  if (clash) blocked = `“${label(clash[0])}” and “${label(clash[1])}” share a covariance that lavaan cannot place in its model matrices (one of them is tied to a factor or a regression, the other is not). Remove that covariance, or the covariance that ties one of them to a factor.`;
  if (blocked) notes.push({ level: 'warn', text: blocked });
  s.cov.filter(e => isLatId(e.from) !== isLatId(e.to)).forEach(e => {
    const f = isLatId(e.from) ? e.from : e.to, v = f === e.from ? e.to : e.from;
    if (s.load.some(x => x.from === f && x.to === v)) notes.push({ level: 'warn', node: v, text: `${label(f)} and its own item “${label(v)}” share a covariance. That rarely makes sense — did you mean a loading or a residual covariance between two items?` });
  });
  const groupsOfLabel = new Map<string, number>();
  P.forEach(x => { if (x.label) groupsOfLabel.set(x.label, (groupsOfLabel.get(x.label) ?? 0) + 1); });
  [...groupsOfLabel].filter(([, k]) => k > 1).forEach(([l, k]) => {
    const fixedTo = P.find(x => x.label === l && typeof x.fixed === 'number')?.fixed;
    notes.push({ level: 'info', text: fixedTo !== undefined ? `Label “${l}” ties ${k} parameters to the fixed value ${fixedTo}.` : `Label “${l}” holds ${k} parameters equal — they count as one.` });
  });
  if (d.stdlv) notes.push({ level: 'info', text: 'Factors are scaled by fixing their variances to 1 (std.lv), so every loading is estimated.' });
  interactions(d).forEach(x => notes.push({ level: 'info', node: x.moderator, text: `${label(x.moderator)} moderates the effect of ${label(x.from)} on ${label(x.to)}: a latent interaction. It is estimated in R with modsem (see the code); the numbers here leave the interaction out.` }));
  if (status === 'under') notes.push({ level: 'warn', text: `The model asks for ${q} numbers but the data offer ${knowns}. It is not identified (station 1.4).` });
  if (status === 'just') notes.push({ level: 'info', text: 'df = 0: the model is estimable but cannot be tested.' });
  if (status === 'over') notes.push({ level: 'ok', text: `${df} spare fact${df === 1 ? '' : 's'}: the data can test this model.` });

  return { p, knowns, q, df, status, notes, parts, s, blocked };
}

// ---------------------------------------------------------------------------
// Syntax out and in
// ---------------------------------------------------------------------------

/** The model part only (the text between the quotes). */
const num = (v: number) => String(+v.toFixed(6));
/** A term with lavaan's modifiers: 0.5*x, NA*x, a*x — or NA*x + a*x when both apply. */
function term(name: string, fix?: number, free?: boolean, label?: string): string {
  const pre = fix !== undefined ? `${num(fix)}*` : free ? 'NA*' : '';
  const l = label?.trim();
  if (l && pre) return `${pre}${name} + ${l}*${name}`;
  return l ? `${l}*${name}` : `${pre}${name}`;
}

/** Latent interactions drawn as moderated paths. */
export function interactions(d: Diagram) {
  const s = structure(d), ok = new Set([...s.latent, ...s.observed]);
  return s.reg.filter(e => e.moderator && ok.has(e.moderator) && e.moderator !== e.from && e.moderator !== e.to)
    .map(e => ({ edge: e, from: e.from, to: e.to, moderator: e.moderator! }));
}

/** Every simple path along regressions, from each predictor to each outcome it reaches through a mediator. */
export function mediationPaths(s: Structure) {
  const out = new Map<string, DEdge[]>();
  s.reg.forEach(e => out.set(e.from, [...(out.get(e.from) ?? []), e]));
  const res: { from: string; to: string; direct?: DEdge; indirect: DEdge[][] }[] = [];
  new Set(s.reg.map(e => e.from)).forEach(from => {
    const paths: DEdge[][] = [];
    const walk = (node: string, seen: string[], path: DEdge[]) => {
      if (paths.length > 200) return;
      for (const e of out.get(node) ?? []) {
        if (seen.includes(e.to)) continue;
        paths.push([...path, e]);
        walk(e.to, [...seen, e.to], [...path, e]);
      }
    };
    walk(from, [from], []);
    new Set(paths.filter(pp => pp.length > 1).map(pp => pp[pp.length - 1].to)).forEach(to => {
      const mine = paths.filter(pp => pp[pp.length - 1].to === to);
      res.push({ from, to, direct: mine.find(pp => pp.length === 1)?.[0], indirect: mine.filter(pp => pp.length > 1) });
    });
  });
  return res;
}

export function modelLines(d: Diagram, opts: { effects?: boolean } = {}): string[] {
  const s = structure(d), nm = (id: string) => s.names.get(id)!;
  const byId = new Map(d.nodes.map(n => [n.id, n]));
  const lines: string[] = [];
  // effect decomposition (:=) needs a label on every path it uses; generated ones never clash with the learner's
  const med = opts.effects ? mediationPaths(s) : [];
  const pathLabel = new Map<string, string>();
  if (med.length) {
    const taken = new Set(d.edges.map(e => e.label).filter(Boolean) as string[]);
    let k = 1;
    s.reg.forEach(e => {
      if (e.label?.trim()) { pathLabel.set(e.id, e.label.trim()); return; }
      while (taken.has(`p${k}`)) k++;
      pathLabel.set(e.id, `p${k}`); taken.add(`p${k}`);
    });
  }
  if (s.latent.length) {
    lines.push('# measurement model');
    s.latent.forEach(f => lines.push(`${nm(f)} =~ ${s.load.filter(e => e.from === f).map(e => term(nm(e.to), e.fix, e.free, e.label)).join(' + ')}`));
  }
  if (s.reg.length) {
    lines.push('', '# structural model');
    const inter = interactions(d);
    [...new Set(s.reg.map(e => e.to))].forEach(t => {
      const terms = s.reg.filter(e => e.to === t).map(e => term(nm(e.from), e.fix, false, pathLabel.get(e.id) ?? e.label));
      // a latent interaction needs both main effects
      inter.filter(x => x.to === t).forEach(x => {
        if (!s.reg.some(e => e.to === t && e.from === x.moderator)) terms.push(nm(x.moderator));
        terms.push(`${nm(x.from)}:${nm(x.moderator)}`);
      });
      lines.push(`${nm(t)} ~ ${terms.join(' + ')}`);
    });
  }
  if (s.cov.length) {
    lines.push('', '# covariances');
    s.cov.forEach(e => lines.push(`${nm(e.from)} ~~ ${term(nm(e.to), e.fix, false, e.label)}`));
  }
  const vars = [...s.observed, ...s.latent].filter(v => byId.get(v)!.varFix !== undefined || byId.get(v)!.varLabel?.trim());
  if (vars.length) {
    lines.push('', '# variances');
    vars.forEach(v => lines.push(`${nm(v)} ~~ ${term(nm(v), byId.get(v)!.varFix, false, byId.get(v)!.varLabel)}`));
  }
  if (med.length) {
    lines.push('', '# effect decomposition: indirect (products along each path) and total effects');
    med.forEach(m => {
      const tag = `${nm(m.from)}_${nm(m.to)}`;
      const ind = m.indirect.map(pp => pp.map(e => pathLabel.get(e.id)!).join('*')).join(' + ');
      lines.push(`ind_${tag} := ${ind}`);
      lines.push(`total_${tag} := ${m.direct ? `${pathLabel.get(m.direct.id)} + ` : ''}${ind}`);
    });
  }
  return lines[0] === '' ? lines.slice(1) : lines;
}

/** How R estimates the model. The studio itself always uses ML on complete cases. */
export type Estimator = 'ML' | 'MLR' | 'WLSMV';
export interface ROptions { estimator: Estimator; missing: 'listwise' | 'fiml' }
export const ML: ROptions = { estimator: 'ML', missing: 'listwise' };

/** The items treated as ordinal under WLSMV: the observed indicators of factors (not covariates). */
export function orderedItems(d: Diagram): string[] {
  const s = structure(d);
  const ind = new Set(s.load.map(e => e.to));
  return s.observed.filter(v => ind.has(v)).map(v => s.names.get(v)!);
}

/** Lines that must stand before the first fitting call (the vector of ordinal items). */
export function rPrelude(d: Diagram, o: ROptions = ML): string {
  if (o.estimator !== 'WLSMV') return '';
  const items = orderedItems(d).map(v => `"${v}"`);
  return `# the items are ordinal (Likert): WLSMV works with their polychoric correlations\nordered_items <- c(${items.join(', ')})`;
}

/** The arguments every fitting call needs besides model and data. `boot`: the call that bootstraps
 *  (lavaan bootstraps ordinal models only with plain DWLS). */
export function fitArgs(d: Diagram, o: ROptions = ML, boot = false): string {
  let a = d.stdlv ? ', std.lv = TRUE' : '';
  if (o.estimator === 'WLSMV') a += `, ordered = ordered_items, estimator = "${boot ? 'DWLS' : 'WLSMV'}"`;
  if (o.estimator === 'MLR' && !boot) a += ', estimator = "MLR"';
  if (o.missing === 'fiml') {
    if (o.estimator === 'WLSMV') a += ', missing = "pairwise"';
    // with fixed.x = TRUE, lavaan still drops every case with a missing covariate
    else a += structure(d).roles.ovx.length ? ', missing = "fiml", fixed.x = FALSE' : ', missing = "fiml"';
  }
  return a;
}

/** The fit measures that belong to the estimator: robust (MLR) or scaled (WLSMV) versions. */
export const fitMeasureNames = (o: ROptions = ML) => (o.estimator === 'ML' ? '"chisq", "df", "cfi", "rmsea", "srmr"'
  : o.estimator === 'MLR' ? '"chisq.scaled", "df.scaled", "cfi.robust", "rmsea.robust", "srmr"'
    : '"chisq.scaled", "df.scaled", "cfi.scaled", "rmsea.scaled", "srmr"');

/** model <- "…" — the model part of the R code, or '' for an empty drawing. */
export function modelString(d: Diagram, opts: { effects?: boolean } = {}): string {
  const lines = modelLines(d, opts);
  return lines.length ? `model <- "\n${lines.map(l => (l ? '  ' + l : '')).join('\n')}\n"` : '';
}

export function toLavaan(d: Diagram, opts: { effects?: boolean; r?: ROptions } = {}): string {
  const s = structure(d), r = opts.r ?? ML;
  const effects = opts.effects !== false && mediationPaths(s).length > 0;
  const m = modelString(d, { effects });
  if (!m) return '# draw your model to see its lavaan syntax';
  if (interactions(d).length) return `library(modsem)\n\n${m}\n\n`
    + `# a latent interaction: estimated with modsem (Slupphaug, Mehmetoglu & Mittner, 2025)\n`
    + (r.estimator !== 'ML' ? `# LMS is a maximum likelihood method: ${r.estimator} does not apply here\n` : '')
    + `fit_lms <- modsem(model, data = my_data, method = "lms")       # latent moderated structural equations (Klein & Moosbrugger, 2000)\n`
    + `summary(fit_lms, standardized = TRUE)\n`
    + `# alternatives: method = "qml" (quasi-maximum likelihood), method = "dblcent" (double-centred product indicators)`;
  const fn = s.reg.length ? 'sem' : 'cfa';
  const pre = rPrelude(d, r);
  const why = r.estimator === 'MLR' ? '\n# MLR: the same estimates as ML, with standard errors and a chi-square that are robust to non-normal data'
    : r.estimator === 'WLSMV' ? '\n# WLSMV: estimates, standard errors and fit for ordinal items' : '';
  const fiml = r.missing === 'fiml' && r.estimator !== 'WLSMV' ? '\n# FIML: every case contributes the values it has; nobody is dropped for a missing answer' : '';
  const boot = effects ? `\n\n# indirect effects: bootstrap confidence intervals instead of the normal-theory (Sobel) test\n`
    + `fit_boot <- ${fn}(model, data = my_data${fitArgs(d, r, true)}, se = "bootstrap", bootstrap = 2000)\n`
    + `parameterEstimates(fit_boot, boot.ci.type = "perc", standardized = TRUE)` : '';
  return `${m}\n\n${pre ? pre + '\n\n' : ''}${why || fiml ? (why + fiml).slice(1) + '\n' : ''}fit <- ${fn}(model, data = my_data${fitArgs(d, r)})\nsummary(fit, fit.measures = TRUE, standardized = TRUE)${boot}`;
}

export interface Parsed { diagram: Diagram; skipped: string[]; modifiers: string[] }

/** Read lavaan model syntax (=~, ~, ~~) into a drawing. Modifiers such as 1*x or a*x are dropped;
 *  intercepts, variances, defined parameters and constraints are reported as skipped. */
export function fromLavaan(text: string): Parsed {
  // R code: the model is the first quoted string that contains a formula
  const quoted = [...text.matchAll(/(['"])([\s\S]*?)\1/g)].find(m => m[2].includes('~'));
  const body = (quoted ? quoted[2] : text).replace(/[#!].*$/gm, '');
  const raw = body.split(/[\n;]/).map(l => l.trim()).filter(Boolean);
  const stmts: string[] = [];
  const opRe = /=~|~~|~|:=|==|<|>/;
  raw.forEach(l => {
    const prev = stmts.length - 1;
    if (prev >= 0 && (stmts[prev].endsWith('+') || l.startsWith('+') || !opRe.test(l))) stmts[prev] += ' ' + l;
    else stmts.push(l);
  });
  const skipped: string[] = [];
  const nodes = new Map<string, DNode>();
  const latent = new Set<string>();
  interface Mods { fix?: number; free?: boolean; label?: string }
  const rel: ({ op: Op; lhs: string; rhs: string } & Mods)[] = [];
  const varMods = new Map<string, Mods>();
  const interTerms: { y: string; x: string; z: string }[] = [];
  const name = (t: string) => (t.includes('*') ? t.slice(t.lastIndexOf('*') + 1).trim() : t.trim());
  const modifiers: string[] = [];
  const isName = (t: string) => /^[A-Za-z.][A-Za-z0-9_.]*$/.test(t);
  /** 0.5*x → fix, NA*x → free, a*x → label; anything else (c(), start(), …) is reported and dropped. */
  const readMods = (raw: string, where: string): Mods => {
    const parts = raw.split('*').map(x => x.trim());
    const out: Mods = {};
    parts.slice(0, -1).forEach(mo => {
      if (/^-?\d*\.?\d+(e-?\d+)?$/i.test(mo)) out.fix = Number(mo);
      else if (mo === 'NA') out.free = true;
      else if (isName(mo)) out.label = mo;
      else modifiers.push(`${where} ${raw}`);
    });
    return out;
  };
  stmts.forEach(st => {
    const m = st.match(/^(.+?)\s*(=~|~~|~)\s*(.+)$/);
    if (!m || /:=|==|<|>|\|/.test(st)) { skipped.push(st); return; }
    const [, lhsRaw, op, rhsRaw] = m;
    const lhs = name(lhsRaw);
    if (!isName(lhs)) { skipped.push(st); return; }
    rhsRaw.split('+').map(x => x.trim()).filter(Boolean).forEach(raw => {
      const t = name(raw);
      const inter = op === '~' && t.match(/^([A-Za-z.][A-Za-z0-9_.]*):([A-Za-z.][A-Za-z0-9_.]*)$/);
      if (inter) { interTerms.push({ y: lhs, x: inter[1], z: inter[2] }); return; }
      if (t === '1' || /^\d/.test(t)) { skipped.push(`${lhs} ${op} ${raw}`); return; }
      if (!isName(t)) { skipped.push(`${lhs} ${op} ${raw}`); return; }
      const mods = readMods(raw, `${lhs} ${op}`);
      if (op === '~~' && t === lhs) { varMods.set(lhs, { ...(varMods.get(lhs) ?? {}), ...mods }); return; }
      // the same term twice (NA*x + a*x) adds its modifiers to one arrow
      const same = rel.find(r => r.op === op && r.lhs === lhs && r.rhs === t);
      if (same) Object.assign(same, mods); else rel.push({ op: op as Op, lhs, rhs: t, ...mods });
    });
    if (op === '=~') latent.add(lhs);
  });
  const node = (name: string) => {
    if (!nodes.has(name)) nodes.set(name, { id: uid('n'), kind: latent.has(name) ? 'latent' : 'observed', label: name, x: 0, y: 0 });
    return nodes.get(name)!.id;
  };
  rel.filter(r => r.op === '=~').forEach(r => node(r.lhs));
  let d: Diagram = { nodes: [], edges: [] };
  const edges: DEdge[] = [];
  const mods = (r: Mods) => ({ ...(r.fix !== undefined ? { fix: r.fix } : {}), ...(r.free ? { free: true } : {}), ...(r.label ? { label: r.label } : {}) });
  rel.forEach(r => {
    if (r.op === '=~') edges.push({ id: uid('e'), kind: 'loading', from: node(r.lhs), to: node(r.rhs), ...mods(r) });
    if (r.op === '~') edges.push({ id: uid('e'), kind: 'path', from: node(r.rhs), to: node(r.lhs), ...mods(r) });
    if (r.op === '~~') edges.push({ id: uid('e'), kind: 'cov', from: node(r.lhs), to: node(r.rhs), ...mods(r) });
  });
  // X:Z on Y — the path X → Y is moderated by Z
  interTerms.forEach(it => {
    const x = node(it.x), y = node(it.y), z = node(it.z);
    const e = edges.find(q => q.kind === 'path' && q.from === x && q.to === y);
    if (e) e.moderator = z; else edges.push({ id: uid('e'), kind: 'path', from: x, to: y, moderator: z });
  });
  varMods.forEach((vm, v) => {
    if (!nodes.has(v)) { skipped.push(`${v} ~~ ${v}`); return; }
    const n = nodes.get(v)!;
    if (vm.fix !== undefined) n.varFix = vm.fix;
    if (vm.label) n.varLabel = vm.label;
  });
  d = { nodes: [...nodes.values()], edges, ...(/std\.lv\s*=\s*TRUE/.test(text) ? { stdlv: true } : {}) };
  // drop exact duplicates (a covariance written twice, once each way)
  d.edges = d.edges.filter((e, i) => d.edges.findIndex(x => x.kind === e.kind && ((x.from === e.from && x.to === e.to) || (e.kind === 'cov' && x.from === e.to && x.to === e.from))) === i);
  return { diagram: tidy(d), skipped, modifiers };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const SLOT = 132;          // horizontal room per item box
export const ROW = { factor: 110, items: 330 };   // within a band

/** Tidy layout: factors in a row, ordered from causes to effects, each one's items underneath it.
 *  Higher-order factors sit above, covariates and observed outcomes join the factor row.
 *  A model wider than maxWidth wraps into several bands, so it stays readable on a narrow screen. */
export function tidy(d: Diagram, maxWidth = 1240): Diagram {
  const s = structure(d);
  const byId = new Map(d.nodes.map(n => [n.id, n]));
  const isLat = (id: string) => byId.get(id)?.kind === 'latent';
  const hasHigher = s.higher.length > 0;
  const top = hasHigher ? 140 : 0;                      // room for higher-order factors in each band
  const bandH = top + 420;

  // depth along regression paths (bounded, so feedback loops terminate)
  const depth = new Map<string, number>();
  d.nodes.forEach(n => depth.set(n.id, 0));
  for (let k = 0; k < d.nodes.length; k++)
    s.reg.forEach(e => { if (depth.get(e.to)! < depth.get(e.from)! + 1 && depth.get(e.from)! < d.nodes.length) depth.set(e.to, depth.get(e.from)! + 1); });

  const firstOrder = d.nodes.filter(n => isLat(n.id) && !s.higher.includes(n.id));
  const loose = d.nodes.filter(n => !isLat(n.id) && s.observed.includes(n.id) && !s.load.some(e => e.to === n.id));  // covariates and observed outcomes
  const rowItems = [...firstOrder, ...loose].sort((a, b) => depth.get(a.id)! - depth.get(b.id)!);

  // each factor with its items (or a lone box) is one block; blocks fill bands left to right
  const taken = new Set<string>();
  const blocks = rowItems.map(n => {
    if (!isLat(n.id)) return { n, items: [] as string[], w: SLOT };
    const items = s.load.filter(e => e.from === n.id && !isLat(e.to)).map(e => e.to).filter(id => !taken.has(id));
    items.forEach(id => taken.add(id));
    return { n, items, w: Math.max(items.length, 1.4) * SLOT + 20 };
  });
  const pos = new Map<string, { x: number; y: number }>();
  let band = 0, cursor = 70;
  blocks.forEach(b => {
    if (cursor > 70 && cursor + b.w > maxWidth) { band++; cursor = 70; }
    const y0 = band * bandH + top;
    if (!b.items.length && !isLat(b.n.id)) pos.set(b.n.id, { x: cursor + SLOT / 2, y: y0 + ROW.factor });
    else {
      const span = b.w - 20;
      pos.set(b.n.id, { x: cursor + span / 2, y: y0 + ROW.factor });
      b.items.forEach((id, k) => pos.set(id, { x: cursor + SLOT * (k + 0.5), y: y0 + ROW.items }));
    }
    cursor += b.w;
  });
  s.higher.forEach(h => {
    const kids = s.load.filter(e => e.from === h).map(e => pos.get(e.to)).filter(Boolean) as { x: number; y: number }[];
    const x = kids.length ? kids.reduce((a, k) => a + k.x, 0) / kids.length : cursor + 90;
    const y = kids.length ? Math.min(...kids.map(k => k.y)) - 140 : 80;
    pos.set(h, { x, y: Math.max(60, y) });
  });
  const rest = d.nodes.filter(n => !pos.has(n.id));
  const yRest = (band + 1) * bandH + 30;
  rest.forEach((n, k) => pos.set(n.id, { x: 70 + SLOT * ((k % 8) + 0.5), y: yRest + Math.floor(k / 8) * 80 }));
  return { ...d, nodes: d.nodes.map(n => ({ ...n, ...(pos.get(n.id) ?? {}) })) };
}

export function example(): Diagram {
  const d = fromLavaan(`
    T =~ trust1 + trust2 + trust3 + trust4
    V =~ vacc1 + vacc2 + vacc3
    V ~ T`).diagram;
  return { ...d, nodes: d.nodes.map(n => ({ ...n, label: n.label === 'T' ? 'Trust in science' : n.label === 'V' ? 'Vaccine intention' : n.label })) };
}
