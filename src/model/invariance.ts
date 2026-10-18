// ---------------------------------------------------------------------------
// Measurement invariance: the drawn model in several groups, with the ladder
//
//   configural  same pattern in every group, all numbers free
//   metric      + loadings equal                  (group.equal = "loadings")
//   scalar      + intercepts equal                (+ "intercepts"; lavaan then frees the
//                                                   factor means in groups 2, 3, …)
//   strict      + residual variances equal        (+ "residuals")
//
// Any single equality can be released again (partial invariance, group.partial).
// Counting follows lavaan's multigroup defaults (meanstructure, fixed.x); checked
// against lavaan by scripts/random-models.ts + scripts/crosscheck.R.
// ---------------------------------------------------------------------------
import { analyse, fitArgs, fitMeasureNames, ML, rPrelude, type Diagram, type ROptions, type Structure } from './diagram.ts';

export type Level = 'configural' | 'metric' | 'scalar' | 'strict';
export const LEVELS: Level[] = ['configural', 'metric', 'scalar', 'strict'];
export type Kind = 'loading' | 'intercept' | 'residual';
export const EQUAL: Record<Level, Kind[]> = {
  configural: [], metric: ['loading'], scalar: ['loading', 'intercept'], strict: ['loading', 'intercept', 'residual'],
};
export const GROUP_EQUAL: Record<Kind, string> = { loading: 'loadings', intercept: 'intercepts', residual: 'residuals' };

export interface Groups { on: boolean; variable: string; names: string[]; level: Level; free: string[] }
export const NO_GROUPS: Groups = { on: false, variable: 'cntry', names: ['GB', 'DE'], level: 'scalar', free: [] };

/** One equality across groups that the ladder can impose — and the learner can release. */
export interface Lock {
  key: string;            // load:<edge id> · int:<node id> · res:<node id>
  kind: Kind;
  node: string;           // the item it belongs to (for loadings: the indicator)
  factor?: string;        // for loadings: the factor
  edge?: string;
  partial: string;        // as lavaan's group.partial wants it, e.g. "F=~x3", "x3~1", "x3~~x3"
}

export function locks(s: Structure): Lock[] {
  const nm = (id: string) => s.names.get(id)!;
  const out: Lock[] = [];
  // a labelled parameter is already one parameter in every group; group.equal does not touch it
  s.params.filter(p => p.role === 'loading' && p.free && !p.label).forEach(p =>
    out.push({ key: `load:${p.edge}`, kind: 'loading', node: p.rhs, factor: p.lhs, edge: p.edge, partial: `${nm(p.lhs)}=~${nm(p.rhs)}` }));
  const ovx = new Set(s.roles.ovx);
  s.observed.filter(v => !ovx.has(v)).forEach(v => out.push({ key: `int:${v}`, kind: 'intercept', node: v, partial: `${nm(v)}~1` }));
  s.params.filter(p => p.role === 'variance' && p.free && !p.label && s.observed.includes(p.lhs) && !ovx.has(p.lhs)).forEach(p =>
    out.push({ key: `res:${p.lhs}`, kind: 'residual', node: p.lhs, partial: `${nm(p.lhs)}~~${nm(p.lhs)}` }));
  return out;
}

export interface Rung {
  level: Level;
  knowns: number; q: number; df: number;
  equal: number;          // equalities in force at this level (after releases)
  released: number;       // equalities of this level's kinds that were released
  freedMeans: number;     // factor means lavaan frees in groups 2, 3, …
}
export interface Ladder { G: number; rungs: Rung[]; locks: Lock[]; s: Structure; notes: { level: 'ok' | 'info' | 'warn'; text: string }[] }

export function ladder(d: Diagram, G: number, free: Set<string> | string[] = [], level: Level = 'scalar'): Ladder {
  const released = new Set(free);
  const a = analyse(d), s = a.s;
  const all = locks(s);
  const p = s.observed.length, kx = s.roles.ovx.length;
  // per group: covariances and means of the items; the model: its single-group parameters,
  // the item intercepts, and (fixed.x) the covariates' moments taken from the data
  const knownsG = (p * (p + 1)) / 2 + p;
  // labelled free parameters are shared by all groups: they count once, not once per group
  const labelled = new Set(s.params.filter(x => x.free && x.label).map(x => x.label!)).size;
  const qG = a.q - labelled + (p - kx) + kx;
  const stdlvVars = s.params.filter(x => x.stdlvFixed).length;
  const rungs = LEVELS.map(level => {
    const kinds = EQUAL[level];
    const mine = all.filter(l => kinds.includes(l.kind));
    const equal = mine.filter(l => !released.has(l.key)).length;
    const freedMeans = kinds.includes('intercept') ? s.latent.length : 0;
    // with std.lv, equal loadings free the factor variances in groups 2, 3, …
    const freedVars = kinds.includes('loading') ? stdlvVars : 0;
    const q = G * qG + labelled - (G - 1) * equal + (G - 1) * (freedMeans + freedVars);
    const knowns = G * knownsG;
    return { level, knowns, q, df: knowns - q, equal, released: mine.length - equal, freedMeans };
  });

  // ---- notes for η about the chosen level
  const notes: Ladder['notes'] = [];
  const label = (id: string) => d.nodes.find(n => n.id === id)?.label || 'item';
  const kinds = EQUAL[level];
  if (G < 2) notes.push({ level: 'warn', text: 'Name at least two groups to compare.' });
  if (!s.latent.length) notes.push({ level: 'info', text: 'Invariance is about factors: draw a factor with its items first.' });
  s.latent.forEach(f => {
    const items = s.load.filter(e => e.from === f && s.observed.includes(e.to)).map(e => e.to);
    if (!items.length) return;
    if (kinds.includes('loading')) {
      const fixed = all.filter(l => l.kind === 'loading' && l.factor === f && !released.has(l.key)).length + 1;   // + the marker, equal by construction
      if (fixed < 2 && items.length > 1) notes.push({ level: 'warn', text: `${label(f)} keeps only its marker loading equal. With fewer than two equal loadings, “one unit of ${label(f)}” no longer means the same in every group.` });
    }
    if (kinds.includes('intercept')) {
      const anchors = items.filter(v => !released.has(`int:${v}`)).length;
      if (anchors === 0) notes.push({ level: 'warn', text: `No intercept of ${label(f)} is equal across groups, so its mean difference is not identified. Keep at least one — better two — anchors.` });
      else if (anchors === 1 && items.length > 1) notes.push({ level: 'info', text: `${label(f)}’s mean comparison rests on a single equal intercept. Two anchors are the usual minimum for partial invariance.` });
    }
  });
  const rel = all.filter(l => released.has(l.key) && kinds.includes(l.kind));
  if (rel.length) notes.push({ level: 'info', text: `You released ${rel.length} of ${all.filter(l => kinds.includes(l.kind)).length} equalities (partial invariance). Each release needs a substantive reason — not just a better fit.` });
  return { G, rungs, locks: all, s, notes };
}

export const MEANING: Record<Level, { adds: string; compare: string; eta: string }> = {
  configural: {
    adds: 'same pattern', compare: 'nothing yet',
    eta: 'Every group gets the same drawing, but all numbers are estimated separately. If this fits, the construct has the same shape everywhere — but no number can be compared yet.',
  },
  metric: {
    adds: '+ equal loadings λ', compare: 'relations: correlations, regression paths',
    eta: 'Loadings are equal, so one unit of the factor means the same in every group. Now relationships — covariances and regression paths — can be compared.',
  },
  scalar: {
    adds: '+ equal intercepts τ', compare: 'factor means',
    eta: 'Intercepts are equal too: people with the same factor level give the same expected answer in every group. Only now can factor means be compared — lavaan frees them in groups 2, 3, … and fixes them to 0 in the first.',
  },
  strict: {
    adds: '+ equal residuals θ', compare: 'observed sum scores',
    eta: 'Residual variances are equal: the items are equally noisy everywhere. Needed only if you want to compare observed sum scores; latent comparisons do not require it.',
  },
};

/** R code for the ladder up to the chosen level. Ordinal items (WLSMV) go through semTools::measEq.syntax,
 *  which identifies thresholds and latent responses the way Wu & Estabrook (2016) propose. */
export function ladderSyntax(d: Diagram, g: Groups, r: ROptions = ML): string {
  const s = analyse(d).s;
  const fn = s.reg.length ? 'sem' : 'cfa';
  const free = new Set(g.free);
  const lk = locks(s);
  const v = g.variable.trim() || 'group';
  const upto = LEVELS.slice(0, LEVELS.indexOf(g.level) + 1);
  const pad = Math.max(...upto.map(l => l.length));
  const ordinal = r.estimator === 'WLSMV';
  const lines = [`# measurement invariance across ${v} (${g.names.filter(Boolean).join(', ')})`];
  const pre = rPrelude(d, r);
  if (ordinal) lines.unshift('library(semTools)', '', '# ordinal items: identified as Wu & Estabrook (2016) propose; thresholds play the part of intercepts');
  if (pre) lines.push(pre);
  const indent = ' '.repeat(pad + 8);
  // ordinal items: thresholds take the place of intercepts (scalar = equal thresholds and loadings)
  const ORDINAL: Record<Level, string[]> = { configural: [], metric: ['"loadings"'], scalar: ['"thresholds"', '"loadings"'], strict: ['"thresholds"', '"loadings"', '"residuals"'] };
  const released: string[] = [];
  upto.forEach(level => {
    const kinds = EQUAL[level];
    const eq = ordinal ? ORDINAL[level] : kinds.map(k => `"${GROUP_EQUAL[k]}"`);
    const rel = lk.filter(l => kinds.includes(l.kind) && free.has(l.key));
    // a released intercept of an ordinal item means releasing its thresholds ("item|t1", "item|t2", …)
    const partial = rel.filter(l => !(ordinal && l.kind === 'intercept')).map(l => `"${l.partial}"`);
    if (ordinal) rel.filter(l => l.kind === 'intercept').forEach(l => { const it = l.partial.split('~')[0].trim(); if (!released.includes(it)) released.push(it); });
    let call: string;
    if (ordinal) {
      call = `fit_${level}${' '.repeat(pad - level.length)} <- measEq.syntax(model, data = my_data, group = "${v}", ordered = ordered_items,\n`
        + `${indent}parameterization = "theta", ID.fac = "std.lv", ID.cat = "Wu.Estabrook.2016",\n`
        + `${indent}group.equal = ${eq.length === 0 ? '"configural"' : eq.length === 1 ? eq[0] : `c(${eq.join(', ')})`}`;
      if (r.missing === 'fiml') call += ', missing = "pairwise"';
      if (partial.length) call += `,\n${indent}group.partial = c(${partial.join(', ')})`;
      lines.push(call + ', return.fit = TRUE)');
      return;
    }
    call = `fit_${level}${' '.repeat(pad - level.length)} <- ${fn}(model, data = my_data, group = "${v}"${fitArgs(d, r)}`;
    if (eq.length) call += `,\n${indent}group.equal = ${eq.length === 1 ? eq[0] : `c(${eq.join(', ')})`}`;
    if (partial.length) call += `,\n${indent}group.partial = c(${partial.join(', ')})`;
    lines.push(call + ')');
  });
  if (released.length) lines.push(`# partial: to release ${released.join(', ')}, add its thresholds to group.partial, e.g. "${released[0]}|t1", "${released[0]}|t2", …`);
  const fits = upto.map(l => `fit_${l}`).join(', ');
  lines.push('', `# nested tests: a significant chi-square difference means the added equalities do not hold${r.estimator === 'ML' ? '' : ' (scaled for ' + r.estimator + ')'}`,
    `lavTestLRT(${fits})`,
    '# changes in fit: a drop in CFI of more than .01 is a common warning sign (Cheung & Rensvold, 2002)',
    `sapply(list(${upto.map(l => `${l} = fit_${l}`).join(', ')}),\n       fitMeasures, fit.measures = c(${fitMeasureNames(r)}))`);
  return lines.join('\n');
}
