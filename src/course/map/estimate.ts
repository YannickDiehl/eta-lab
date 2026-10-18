// The map of SEM · estimation, computed in the browser. The small model of the matrix workshop
// (TRCO =~ ipfrule + ipbhprp, UNIV =~ ipeqopt + ipudrst) is fitted to the covariance matrix S
// lavaan reports for the Dutch data (divisor N). Same F_ML as lavaan (which prints fmin = F_ML/2),
// so the browser's minimum is lavaan's estimate; tests in course/map.test.ts check it.
import { discrepancy, type Estimator } from '../../math/cfa.ts';
import { cholesky, inverse, multiply, trace, type Matrix } from '../../math/linalg.ts';
import { gradient, hessian, minimize } from '../../math/optimize.ts';
import { pbinorm, pnorm, qnorm } from '../../stations/categories.ts';

/** Free parameters in lavaan's order: λ₂₁ λ₄₂ θ₁₁ θ₂₂ θ₃₃ θ₄₄ ψ₁₁ ψ₂₂ ψ₂₁. */
export const TOY_PARAMS = ['l21', 'l42', 't1', 't2', 't3', 't4', 'p11', 'p22', 'p21'] as const;
export type ToyKey = typeof TOY_PARAMS[number];
export const TOY_LABEL: Record<ToyKey, string> = { l21: 'λ₂₁', l42: 'λ₄₂', t1: 'θ₁₁', t2: 'θ₂₂', t3: 'θ₃₃', t4: 'θ₄₄', p11: 'ψ₁₁', p22: 'ψ₂₂', p21: 'ψ₂₁' };
export const TOY_RANGE: Record<ToyKey, [number, number]> = { l21: [-1, 2.5], l42: [-1, 2.5], t1: [0.02, 1.5], t2: [0.02, 1.5], t3: [0.02, 1.5], t4: [0.02, 1.5], p11: [0.02, 1.2], p22: [0.02, 1.2], p21: [-0.4, 0.6] };

export function toySigma(x: number[]): Matrix {
  const [l21, l42, t1, t2, t3, t4, p11, p22, p21] = x;
  const L = [[1, 0], [l21, 0], [0, 1], [0, l42]];
  const P = [[p11, p21], [p21, p22]];
  const T = [t1, t2, t3, t4];
  return L.map((a, i) => L.map((b, j) => a[0] * P[0][0] * b[0] + a[0] * P[0][1] * b[1] + a[1] * P[1][0] * b[0] + a[1] * P[1][1] * b[1] + (i === j ? T[i] : 0)));
}

/** F as a function of the parameter vector; Infinity where Σ is not positive definite (no covariance matrix can be). */
export const toyF = (S: Matrix, est: Estimator = 'ML') => (x: number[]) => {
  const Sig = toySigma(x);
  if (!cholesky(Sig)) return Infinity;
  return discrepancy(S, Sig, est);
};

export function fitToy(S: Matrix, start: number[], opts: { maxIter?: number; est?: Estimator } = {}) {
  return minimize(toyF(S, opts.est), start, { maxIter: opts.maxIter, tol: 1e-13 });
}

/**
 * Standard errors from the curvature. lavaan's default for ML with complete data is the expected
 * information, I_jk = ½ tr(Σ⁻¹ ∂Σ/∂θ_j Σ⁻¹ ∂Σ/∂θ_k), Cov(θ̂) = (N·I)⁻¹; `observed` uses the Hessian of
 * F_ML instead (I = ½H), as lavaan does with MLR or FIML.
 */
export function toyInformation(x: number[], S?: Matrix, observed = false): Matrix {
  if (observed && S) return hessian(toyF(S), x).map(r => r.map(v => v / 2));
  const Si = inverse(toySigma(x)), h = 1e-6;
  const D = x.map((_, j) => { const a = x.slice(), b = x.slice(); a[j] += h; b[j] -= h; const A = toySigma(a), B = toySigma(b); return multiply(Si, A.map((r, i) => r.map((v, k) => (v - B[i][k]) / (2 * h)))); });
  return D.map(Dj => D.map(Dk => 0.5 * trace(multiply(Dj, Dk))));
}
export function toySE(S: Matrix, x: number[], n: number, observed = false) {
  const inv = inverse(toyInformation(x, S, observed).map(r => r.map(v => n * v)));
  return inv.map((r, i) => Math.sqrt(Math.max(0, r[i])));
}

/**
 * The profile of one parameter: for each fixed value, the other parameters re-estimated,
 * and N·(F − F_min) — the χ² difference a likelihood-ratio test would report.
 */
export function profile(S: Matrix, xhat: number[], k: number, values: number[], n: number) {
  const F = toyF(S), fmin = F(xhat);
  const others = (v: number, y: number[]) => { const z = y.slice(0, k).concat([v], y.slice(k)); return z; };
  const out: { v: number; d: number }[] = [];
  // walk outwards from the estimate in both directions, warm-starting each fit
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => Math.abs(a.v - xhat[k]) - Math.abs(b.v - xhat[k]));
  const rest0 = xhat.filter((_, i) => i !== k);
  const warm = new Map<number, number[]>();
  for (const { v, i } of order) {
    const near = [...warm.entries()].sort((a, b) => Math.abs(values[a[0]] - v) - Math.abs(values[b[0]] - v))[0]?.[1] ?? rest0;
    const r = minimize(y => F(others(v, y)), near, { tol: 1e-12 });
    warm.set(i, r.x);
    out[i] = { v, d: n * (r.value - fmin) };
  }
  return out;
}

/** Wald, likelihood ratio and score statistic for "parameter k = value". */
export function threeTests(S: Matrix, xhat: number[], k: number, value: number, n: number) {
  const se = toySE(S, xhat, n)[k];
  const wald = ((xhat[k] - value) / se) ** 2;
  const F = toyF(S);
  const rest0 = xhat.filter((_, i) => i !== k);
  const with0 = (y: number[]) => y.slice(0, k).concat([value], y.slice(k));
  const r = minimize(y => F(with0(y)), rest0, { tol: 1e-13 });
  const lr = n * (r.value - F(xhat));
  // score test at the restricted estimate, with the expected information as lavaan: (N/4)·g′I⁻¹g, g the gradient of F
  const xr = with0(r.x);
  const g = gradient(F, xr, 1e-6), Ii = inverse(toyInformation(xr));
  const score = (n / 4) * g.reduce((s, gi, i) => s + gi * Ii[i].reduce((t, h, j) => t + h * g[j], 0), 0);
  return { se, wald, lr, score, restricted: xr };
}

/** Standardized loadings λ·√ψ / √σᵢᵢ — for comparing estimators across rescaled items. */
export function stdLoadings(x: number[]) {
  const S = toySigma(x);
  const [l21, l42, , , , , p11, p22] = x;
  return [1 * Math.sqrt(p11) / Math.sqrt(S[0][0]), l21 * Math.sqrt(p11) / Math.sqrt(S[1][1]), 1 * Math.sqrt(p22) / Math.sqrt(S[2][2]), l42 * Math.sqrt(p22) / Math.sqrt(S[3][3])];
}

/** Rescale item i of S by a factor c (D S D with D = diag(1,…,c,…,1)). */
export function rescale(S: Matrix, i: number, c: number): Matrix {
  return S.map((r, a) => r.map((v, b) => v * (a === i ? c : 1) * (b === i ? c : 1)));
}

/** Start values scaled with item i in a rescaled S: loadings and variances that involve item i. */
export function rescaleStart(x: number[], i: number, c: number) {
  const y = x.slice();
  if (i === 0) { y[0] = x[0] / c; y[2] = x[2] * c * c; y[6] = x[6] * c * c; y[8] = x[8] * c; }   // marker item: the factor's unit changes
  if (i === 1) { y[0] = x[0] * c; y[3] = x[3] * c * c; }
  return y;
}

// ---------------------------------------------------------------- ordinal data
/** Thresholds from category counts: qnorm of the cumulative shares. */
export const thresholdsFromCounts = (counts: number[]) => {
  const n = counts.reduce((a, b) => a + b, 0);
  let c = 0;
  return counts.slice(0, -1).map(k => { c += k; return qnorm(c / n); });
};

/** Cell probabilities of two ordinal items cut from a bivariate normal with correlation ρ. */
export function cellProbs(ta: number[], tb: number[], rho: number) {
  const A = [-Infinity, ...ta, Infinity], B = [-Infinity, ...tb, Infinity];
  const F = A.map(a => B.map(b => (a === -Infinity || b === -Infinity ? 0 : a === Infinity ? pnorm(b) : b === Infinity ? pnorm(a) : pbinorm(a, b, rho))));
  return ta.concat([0]).map((_, i) => tb.concat([0]).map((_, j) => Math.max(1e-12, F[i + 1][j + 1] - F[i][j + 1] - F[i + 1][j] + F[i][j])));
}

export const logLik = (counts: number[][], probs: number[][]) => counts.reduce((s, r, i) => s + r.reduce((t, c, j) => t + c * Math.log(probs[i][j]), 0), 0);

/** Pearson correlation of the category scores 1…c in a cross table. */
export function pearsonOfTable(t: number[][]) {
  const n = t.flat().reduce((a, b) => a + b, 0);
  let ma = 0, mb = 0;
  t.forEach((r, i) => r.forEach((c, j) => { ma += c * (i + 1); mb += c * (j + 1); }));
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  t.forEach((r, i) => r.forEach((c, j) => { sab += c * (i + 1 - ma) * (j + 1 - mb); saa += c * (i + 1 - ma) ** 2; sbb += c * (j + 1 - mb) ** 2; }));
  return sab / Math.sqrt(saa * sbb);
}
