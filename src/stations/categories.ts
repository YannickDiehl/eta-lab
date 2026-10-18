// Station 2.4: what happens to a correlation when answers fall into a few boxes.
// Two standard-normal attitudes correlate at ρ; each is recorded on c ordered categories with
// thresholds τ (shifted by `skew`, which piles answers up at the top). The Pearson correlation of
// the recorded scores is computed exactly from bivariate-normal orthant probabilities — it is
// what ML and MLR analyse; ρ itself is what WLSMV estimates (the polychoric correlation).

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf, |error| < 1.5e-7). */
export function pnorm(x: number) {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Inverse standard normal CDF (Acklam's rational approximation, |relative error| < 1.2e-9). */
export function qnorm(p: number) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - lo) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** P(Z1 ≤ a, Z2 ≤ b) for standard normals with correlation ρ, by integrating over the correlation (Simpson). */
export function pbinorm(a: number, b: number, rho: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    if (a === -Infinity || b === -Infinity) return 0;
    if (a === Infinity) return pnorm(b);
    return pnorm(a);
  }
  const m = 120, h = rho / m;
  const f = (r: number) => Math.exp(-(a * a - 2 * r * a * b + b * b) / (2 * (1 - r * r))) / Math.sqrt(1 - r * r);
  let s = f(0) + f(rho);
  for (let k = 1; k < m; k++) s += (k % 2 ? 4 : 2) * f(k * h);
  return pnorm(a) * pnorm(b) + (s * h / 3) / (2 * Math.PI);
}

/** Thresholds for c categories: equal shares at skew 0; positive skew piles answers into the top boxes. */
export const thresholds = (c: number, skew: number) => Array.from({ length: c - 1 }, (_, k) => qnorm((k + 1) / c) - skew);

/** Share of answers in each category. */
export function shares(c: number, skew: number) {
  const t = [-Infinity, ...thresholds(c, skew), Infinity];
  return Array.from({ length: c }, (_, k) => pnorm(t[k + 1]) - pnorm(t[k]));
}

/** Pearson correlation of the recorded scores 1…c (both items alike). Score = 1 + Σ_k 1{Z > τ_k}. */
export function pearsonOfCategories(rho: number, c: number, skew: number) {
  const t = thresholds(c, skew);
  let cov = 0, v = 0;
  for (const tk of t) for (const tl of t) {
    const pk = 1 - pnorm(tk), pl = 1 - pnorm(tl);
    // P(Z1 > τk, Z2 > τl) = Φ2(−τk, −τl; ρ)
    cov += pbinorm(-tk, -tl, rho) - pk * pl;
    v += (1 - pnorm(Math.max(tk, tl))) - pk * pl;
  }
  return cov / v;
}
