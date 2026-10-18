// ---------------------------------------------------------------------------
// Confirmatory factor analysis on a covariance (here: correlation) matrix.
//
//   Σ(θ) = Λ Φ Λᵀ + Θ        factor variances fixed to 1 (std.lv), Φ = factor correlations
//   F_ML  = ln|Σ| − ln|S| + tr(S Σ⁻¹) − p
//   F_ULS = ½ tr[(S − Σ)²]
//   χ²    = n · F_ML          (lavaan with sample.cov.rescale = FALSE)
//
// Parameters are kept in one vector so the optimizer, the landscape view and
// the standard errors all work on the same object.
// ---------------------------------------------------------------------------
import { add, inverse, logDet, multiply, subtract, trace, transpose, zeros, type Matrix } from './linalg.ts';

export type ParamKind = 'loading' | 'factorCor' | 'residualVar' | 'residualCov';
export interface Param { kind: ParamKind; i: number; j: number; label: string }

export interface ModelSpec {
  items: string[];
  factors: string[];
  /** pattern[i][f] = true if item i loads on factor f */
  pattern: boolean[][];
  /** freed residual covariances as item index pairs */
  residualCovs?: [number, number][];
}

export type Estimator = 'ML' | 'ULS';

export function parameters(spec: ModelSpec): Param[] {
  const ps: Param[] = [];
  spec.pattern.forEach((row, i) => row.forEach((free, f) => {
    if (free) ps.push({ kind: 'loading', i, j: f, label: `${spec.factors[f]} =~ ${spec.items[i]}` });
  }));
  for (let a = 0; a < spec.factors.length; a++)
    for (let b = a + 1; b < spec.factors.length; b++)
      ps.push({ kind: 'factorCor', i: a, j: b, label: `${spec.factors[a]} ~~ ${spec.factors[b]}` });
  spec.items.forEach((it, i) => ps.push({ kind: 'residualVar', i, j: i, label: `${it} ~~ ${it}` }));
  (spec.residualCovs ?? []).forEach(([a, b]) =>
    ps.push({ kind: 'residualCov', i: a, j: b, label: `${spec.items[a]} ~~ ${spec.items[b]}` }));
  return ps;
}

export function implied(spec: ModelSpec, params: Param[], x: number[]): Matrix {
  const p = spec.items.length, k = spec.factors.length;
  const L = zeros(p, k), Phi = zeros(k), Th = zeros(p);
  for (let f = 0; f < k; f++) Phi[f][f] = 1;
  params.forEach((par, idx) => {
    const v = x[idx];
    if (par.kind === 'loading') L[par.i][par.j] = v;
    else if (par.kind === 'factorCor') { Phi[par.i][par.j] = v; Phi[par.j][par.i] = v; }
    else if (par.kind === 'residualVar') Th[par.i][par.i] = v;
    else { Th[par.i][par.j] = v; Th[par.j][par.i] = v; }
  });
  return add(multiply(multiply(L, Phi), transpose(L)), Th);
}

export function discrepancy(S: Matrix, Sigma: Matrix, estimator: Estimator = 'ML'): number {
  if (estimator === 'ULS') {
    const R = subtract(S, Sigma);
    return 0.5 * trace(multiply(R, R));
  }
  const ld = logDet(Sigma);
  if (!Number.isFinite(ld)) return Infinity;
  let inv: Matrix;
  try { inv = inverse(Sigma); } catch { return Infinity; }
  return ld - logDet(S) + trace(multiply(S, inv)) - S.length;
}

export function objective(spec: ModelSpec, params: Param[], S: Matrix, estimator: Estimator = 'ML') {
  return (x: number[]) => discrepancy(S, implied(spec, params, x), estimator);
}

export function startValues(params: Param[]): number[] {
  return params.map(p => (p.kind === 'loading' ? 0.5 : p.kind === 'factorCor' ? 0.3 : p.kind === 'residualVar' ? 0.75 : 0));
}

/** Degrees of freedom: unique variances/covariances minus free parameters. */
export const degreesOfFreedom = (p: number, q: number) => (p * (p + 1)) / 2 - q;

/** One-factor model on all items — the workhorse of Part II. */
export function oneFactor(items: string[], factor = 'η'): ModelSpec {
  return { items, factors: [factor], pattern: items.map(() => [true]) };
}
