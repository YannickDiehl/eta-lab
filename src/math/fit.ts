// Global fit, as reported by lavaan (ML, likelihood "normal", no rescaling).
import { logDet, type Matrix } from './linalg.ts';
import { degreesOfFreedom, discrepancy, implied, objective, parameters, startValues, type Estimator, type ModelSpec } from './cfa.ts';
import { minimize, standardErrors } from './optimize.ts';

export interface FitIndices { chisq: number; df: number; rmsea: number; cfi: number; tli: number; srmr: number; baselineChisq: number; baselineDf: number }

/** Independence model: all covariances zero, variances free. */
export function baseline(S: Matrix, n: number) {
  const logDiag = S.reduce((s, row, i) => s + Math.log(row[i]), 0);
  return { chisq: n * (logDiag - logDet(S)), df: (S.length * (S.length - 1)) / 2 };
}

export function fitIndices(S: Matrix, Sigma: Matrix, n: number, df: number): FitIndices {
  const chisq = n * discrepancy(S, Sigma, 'ML');
  const b = baseline(S, n);
  const rmsea = df > 0 ? Math.sqrt(Math.max(chisq - df, 0) / (df * n)) : 0;
  const cfiDen = Math.max(b.chisq - b.df, chisq - df, 0);
  const cfi = cfiDen === 0 ? 1 : 1 - Math.max(chisq - df, 0) / cfiDen;
  const tli = df > 0 ? (b.chisq / b.df - chisq / df) / (b.chisq / b.df - 1) : 1;
  let sum = 0, count = 0;
  for (let i = 0; i < S.length; i++)
    for (let j = 0; j <= i; j++) {
      const r = S[i][j] / Math.sqrt(S[i][i] * S[j][j]) - Sigma[i][j] / Math.sqrt(Sigma[i][i] * Sigma[j][j]);
      sum += r * r; count++;
    }
  return { chisq, df, rmsea, cfi, tli, srmr: Math.sqrt(sum / count), baselineChisq: b.chisq, baselineDf: b.df };
}

export interface Estimate {
  spec: ModelSpec; x: number[]; se: number[]; Sigma: Matrix; fit: FitIndices; path: number[][]; iterations: number;
}

/** Fit a model end to end: estimate, standard errors, implied matrix and fit indices. */
export function estimate(spec: ModelSpec, S: Matrix, n: number, opts: { estimator?: Estimator; start?: number[] } = {}): Estimate {
  const params = parameters(spec);
  const f = objective(spec, params, S, opts.estimator ?? 'ML');
  const res = minimize(f, opts.start ?? startValues(params));
  // flip sign so that loadings are positive on average (the factor's direction is arbitrary)
  let x = res.x;
  const loadSum = params.reduce((s, p, i) => (p.kind === 'loading' ? s + x[i] : s), 0);
  if (loadSum < 0 && spec.factors.length === 1) x = x.map((v, i) => (params[i].kind === 'loading' ? -v : v));
  const se = (opts.estimator ?? 'ML') === 'ML' ? standardErrors(objective(spec, params, S, 'ML'), x, n) : x.map(() => NaN);
  const Sigma = implied(spec, params, x);
  const df = degreesOfFreedom(spec.items.length, params.length);
  return { spec, x, se, Sigma, fit: fitIndices(S, Sigma, n, df), path: res.path, iterations: res.iterations };
}
