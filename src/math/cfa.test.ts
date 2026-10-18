// The JS engine must reproduce lavaan (scripts/reference.R) on the ESS datasets.
import test from 'node:test';
import assert from 'node:assert/strict';
import datasets from '../data/datasets.json' with { type: 'json' };
import reference from './reference.json' with { type: 'json' };
import { oneFactor, parameters } from './cfa.ts';
import { estimate } from './fit.ts';

type Ref = { lambda: number[]; lambda_se: number[]; theta: number[]; chisq: number; df: number; rmsea: number; cfi: number; tli: number; srmr: number;
  baseline_chisq: number; lambda_uls: number[]; freed: { lhs: string; rhs: string; chisq: number; df: number } };
const refs = reference as Record<string, Ref>;

const close = (a: number, b: number, tol: number, what: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: got ${a}, expected ${b}`);

for (const d of datasets.datasets) {
  const ref = refs[d.id];
  const spec = oneFactor(d.items);

  test(`${d.id}: ML estimates, SEs and fit match lavaan`, () => {
    const est = estimate(spec, d.S, d.n);
    const params = parameters(spec);
    const lam = est.x.filter((_, i) => params[i].kind === 'loading');
    const se = est.se.filter((_, i) => params[i].kind === 'loading');
    const th = est.x.filter((_, i) => params[i].kind === 'residualVar');
    lam.forEach((v, i) => close(v, ref.lambda[i], 2e-4, `lambda ${i}`));
    se.forEach((v, i) => close(v, ref.lambda_se[i], 2e-4, `se ${i}`));
    th.forEach((v, i) => close(v, ref.theta[i], 2e-4, `theta ${i}`));
    close(est.fit.chisq, ref.chisq, 5e-3, 'chisq');
    assert.equal(est.fit.df, ref.df);
    close(est.fit.rmsea, ref.rmsea, 1e-4, 'rmsea');
    close(est.fit.cfi, ref.cfi, 1e-4, 'cfi');
    close(est.fit.tli, ref.tli, 1e-4, 'tli');
    close(est.fit.srmr, ref.srmr, 1e-4, 'srmr');
    close(est.fit.baselineChisq, ref.baseline_chisq, 1e-2, 'baseline chisq');
  });

  test(`${d.id}: ULS estimates match lavaan`, () => {
    const est = estimate(spec, d.S, d.n, { estimator: 'ULS' });
    const params = parameters(spec);
    est.x.filter((_, i) => params[i].kind === 'loading').forEach((v, i) => close(v, ref.lambda_uls[i], 5e-4, `uls lambda ${i}`));
  });

  test(`${d.id}: freeing the largest-MI residual covariance matches lavaan`, () => {
    const a = d.items.indexOf(ref.freed.lhs), b = d.items.indexOf(ref.freed.rhs);
    const est = estimate({ ...spec, residualCovs: [[a, b]] }, d.S, d.n);
    close(est.fit.chisq, ref.freed.chisq, 5e-3, 'freed chisq');
    assert.equal(est.fit.df, ref.freed.df);
  });
}
