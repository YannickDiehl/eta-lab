// The studio's estimator against lavaan 0.6-21 on the course data (scripts/sem-reference.R).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromLavaan, structure } from '../model/diagram.ts';
import { fitModel, type Fitted } from './sem.ts';
import { groupsFor, type CourseData, type Grouping } from '../data/course.ts';

const data = JSON.parse(readFileSync(new URL('../../public/data/course-data.json', import.meta.url), 'utf8')) as CourseData;
interface RefParam { group: number; lhs: string; op: string; rhs: string; est: number; se: number; std: number }
interface Ref {
  id: string; round: string; sample: string; grouping: Grouping; model: string; equal: string[]; partial: string[];
  fit: Record<string, number>; params: RefParam[]; r2: Record<string, number>[]; stdlv: boolean;
  mi: { group: number; lhs: string; op: string; rhs: string; mi: number; epc: number; sepc: number }[];
  residuals: { names: string[]; cov: number[][]; mean: number[] }[];
  defined: { name: string; rhs: string; est: number; se: number; std: number }[];
}
/** lavaan's defined parameters (:=) and the effect η Lab reports for them: from, to, which part, group. */
const DEFINED: Record<string, [string, string, 'indirect' | 'total', number]> = {
  ind_un: ['UN', 'Allow', 'indirect', 0], total_un: ['UN', 'Allow', 'total', 0],
  ind_age: ['agea', 'Allow', 'indirect', 0], total_age: ['agea', 'Allow', 'total', 0],
  ind_g1: ['UN', 'Allow', 'indirect', 0], ind_g3: ['UN', 'Allow', 'indirect', 2],
};
const refs = JSON.parse(readFileSync(new URL('./sem-reference.json', import.meta.url), 'utf8')) as Ref[];
const LEVEL: Record<number, 'configural' | 'metric' | 'scalar' | 'strict'> = { 0: 'configural', 1: 'metric', 2: 'scalar', 3: 'strict' };

const close = (a: number, b: number, tol: number, what: string) =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: η Lab ${a}, lavaan ${b}`);

for (const ref of refs) {
  test(`estimates match lavaan: ${ref.id}`, () => {
    const d = fromLavaan(ref.model).diagram;
    if (ref.stdlv) d.stdlv = true;
    const groups = groupsFor(data, ref.round, ref.sample, ref.grouping);
    // partial invariance: translate lavaan's group.partial strings into η Lab's lock keys
    const byName = new Map(d.nodes.map(n => [n.label, n.id]));
    const free = ref.partial.map(s => {
      const m = s.match(/^(\w+)(=~|~~|~1)(\w*)$/)!;
      if (m[2] === '~1') return `int:${byName.get(m[1])}`;
      if (m[2] === '~~') return `res:${byName.get(m[1])}`;
      const e = d.edges.find(x => x.from === byName.get(m[1]) && x.to === byName.get(m[3]))!;
      return `load:${e.id}`;
    });
    const r = fitModel(d, { groups, level: LEVEL[ref.equal.length], free });
    assert.ok(r.ok, !r.ok ? r.error : '');
    const f = r as Fitted;
    assert.equal(f.df, ref.fit.df, 'df');
    close(f.chisq, ref.fit.chisq, 1e-4, 'chisq');
    close(f.baseline.chisq, ref.fit['baseline.chisq'], 1e-4, 'baseline chisq');
    assert.equal(f.baseline.df, ref.fit['baseline.df'], 'baseline df');
    for (const k of ['cfi', 'tli', 'rmsea', 'srmr'] as const) close(f[k], ref.fit[k], 2e-4, k);

    const id = (nm: string) => byName.get(nm)!;
    for (const q of ref.params) {
      const g = q.group - 1;
      const mine = f.params.find(x => x.group === g && x.op === q.op &&
        ((x.lhs === id(q.lhs) && (q.op === '~1' || x.rhs === id(q.rhs))) || (q.op === '~~' && x.lhs === id(q.rhs) && x.rhs === id(q.lhs))));
      assert.ok(mine, `missing parameter ${q.lhs} ${q.op} ${q.rhs} (group ${q.group})`);
      const what = `${ref.id}: ${q.lhs} ${q.op} ${q.rhs} [g${q.group}]`;
      close(mine.est, q.est, 2e-3, `${what} est`);
      if (q.se > 0) close(mine.se, q.se, 2e-3, `${what} se`);
      if (Number.isFinite(q.std)) close(mine.std, q.std, 2e-3, `${what} std`);
    }
    close(f.logl, ref.fit.logl, 1e-6, 'logl');
    close(f.aic, ref.fit.aic, 1e-6, 'AIC');
    close(f.bic, ref.fit.bic, 1e-6, 'BIC');
    // residual correlations (cor.bentler), every cell
    (Array.isArray(ref.residuals) ? ref.residuals : Object.values(ref.residuals) as Ref['residuals']).forEach((rg, g) => rg.names.forEach((a, i) => rg.names.forEach((b, j) => {
      const ia = f.residuals.order.indexOf(id(a)), ib = f.residuals.order.indexOf(id(b));
      close(f.residuals.groups[g].cov[ia][ib], rg.cov[i][j], 1e-3, `${ref.id} residual ${a},${b}`);
    })));
    // modification indices: every one lavaan lists for loadings, covariances and paths — except
    //  · paths that would make a covariate an outcome (η Lab does not offer them), and
    //  · models with df ≤ 1, where any added parameter uses up the model and lavaan's values are unstable
    //    (in day 2 it reports MI = 12 for a change that can lower χ² = 0.59 at most; η Lab gives 0.59)
    const covariates = new Set(structure(d).roles.ovx.map(v => d.nodes.find(n => n.id === v)!.label));
    for (const q of ref.mi.filter(q => ['=~', '~~', '~'].includes(q.op) && !(q.op === '~' && covariates.has(q.lhs)) && ref.fit.df > 1)) {
      const mine = f.mi.find(x => x.group === q.group - 1 && x.op === q.op &&
        ((x.lhs === id(q.lhs) && x.rhs === id(q.rhs)) || (q.op === '~~' && x.lhs === id(q.rhs) && x.rhs === id(q.lhs))));
      assert.ok(mine, `${ref.id}: no modification index for ${q.lhs} ${q.op} ${q.rhs}`);
      if (Number.isNaN(mine.mi)) continue;            // not identifiable if freed: lavaan prints numerical noise there
      close(mine.mi, q.mi, 3e-3, `${ref.id} MI ${q.lhs} ${q.op} ${q.rhs}`);
      close(mine.epc, q.epc, 3e-3, `${ref.id} EPC ${q.lhs} ${q.op} ${q.rhs}`);
      // lavaan prints sEPC = 0 for a variance fixed to 0; η Lab expresses it as a share of the total variance
      if (q.lhs !== q.rhs && typeof q.sepc === 'number') close(mine.sepc, q.sepc, 3e-3, `${ref.id} sEPC ${q.lhs} ${q.op} ${q.rhs}`);
      if (typeof q.sepc !== 'number') assert.ok(Number.isNaN(mine.sepc), `${ref.id} sEPC ${q.lhs} ${q.op} ${q.rhs} should be undefined`);
    }
    // indirect and total effects against lavaan's := parameters (delta method)
    for (const q of ref.defined ?? []) {
      const [from, to, part, g] = DEFINED[q.name];
      const set = f.effects.find(x => x.group === g && x.from === id(from) && x.to === id(to));
      assert.ok(set, `${ref.id}: no effects from ${from} to ${to}`);
      close(set[part].est, q.est, 2e-3, `${ref.id} ${q.name} est`);
      close(set[part].se, q.se, 3e-3, `${ref.id} ${q.name} se`);
      close(set[part].std, q.std, 3e-3, `${ref.id} ${q.name} std`);
    }
    // lavaan: one R² table, or one per group keyed by the group's label; NA when a variance is negative
    const r2 = (Array.isArray(ref.r2) ? ref.r2 : Object.values(ref.r2)) as Record<string, number | string>[];
    r2.forEach((rr, g) => Object.entries(rr).forEach(([nm, v]) => { if (typeof v === 'number') close(f.r2[g][id(nm)], v, 2e-3, `${ref.id} R² ${nm} [g${g + 1}]`); }));
  });
}

test('items that are not in the data are named', () => {
  const r = fitModel(fromLavaan('F =~ imptrad + ipmodst + notthere').diagram, { groups: groupsFor(data, 'ess2004', 'NL', 'none') });
  assert.equal(r.ok, false);
  assert.deepEqual(!r.ok && r.missing, ['notthere']);
});

test('a negative factor variance is reported as a Heywood case', () => {
  const ref = refs.find(x => x.id === 'day5-higher-order')!;
  const d = fromLavaan(ref.model).diagram;
  const r = fitModel(d, { groups: groupsFor(data, ref.round, ref.sample, 'none') }) as Fitted;
  const neg = ref.params.filter(q => q.op === '~~' && q.lhs === q.rhs && q.est < 0).map(q => d.nodes.find(n => n.label === q.lhs)!.id);
  assert.deepEqual(r.heywood.sort(), neg.sort());
});
