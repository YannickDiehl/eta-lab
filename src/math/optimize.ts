// Quasi-Newton (BFGS) minimisation with numerical gradients and a backtracking
// line search. Every iterate is recorded, so the UI can replay the path.
import { inverse, type Matrix } from './linalg.ts';

export type Fn = (x: number[]) => number;

export function gradient(f: Fn, x: number[], h = 1e-6): number[] {
  return x.map((_, i) => {
    const a = x.slice(), b = x.slice();
    a[i] += h; b[i] -= h;
    return (f(a) - f(b)) / (2 * h);
  });
}

export function hessian(f: Fn, x: number[], h = 1e-4): Matrix {
  const n = x.length, H: Matrix = Array.from({ length: n }, () => Array(n).fill(0));
  const fx = f(x);
  for (let i = 0; i < n; i++)
    for (let j = i; j < n; j++) {
      let v: number;
      if (i === j) {
        const a = x.slice(), b = x.slice();
        a[i] += h; b[i] -= h;
        v = (f(a) - 2 * fx + f(b)) / (h * h);
      } else {
        const pp = x.slice(), pm = x.slice(), mp = x.slice(), mm = x.slice();
        pp[i] += h; pp[j] += h; pm[i] += h; pm[j] -= h; mp[i] -= h; mp[j] += h; mm[i] -= h; mm[j] -= h;
        v = (f(pp) - f(pm) - f(mp) + f(mm)) / (4 * h * h);
      }
      H[i][j] = v; H[j][i] = v;
    }
  return H;
}

export interface OptimResult { x: number[]; value: number; path: number[][]; iterations: number; converged: boolean }

export function minimize(f: Fn, x0: number[], opts: { maxIter?: number; tol?: number; grad?: (x: number[]) => number[] } = {}): OptimResult {
  const maxIter = opts.maxIter ?? 400, tol = opts.tol ?? 1e-9, n = x0.length;
  const grad = opts.grad ?? ((v: number[]) => gradient(f, v));
  let x = x0.slice(), fx = f(x), g = grad(x);
  let B: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))); // inverse Hessian approx
  const path = [x.slice()];
  for (let it = 0; it < maxIter; it++) {
    const d = B.map(row => -row.reduce((s, v, j) => s + v * g[j], 0));
    let step = 1, xn = x, fn = fx;
    const slope = d.reduce((s, v, i) => s + v * g[i], 0);
    while (step > 1e-10) {
      xn = x.map((v, i) => v + step * d[i]);
      fn = f(xn);
      if (Number.isFinite(fn) && fn <= fx + 1e-4 * step * slope) break;
      step *= 0.5;
    }
    if (step <= 1e-10) return { x, value: fx, path, iterations: it, converged: true };
    const gn = grad(xn);
    const s = xn.map((v, i) => v - x[i]), y = gn.map((v, i) => v - g[i]);
    const sy = s.reduce((acc, v, i) => acc + v * y[i], 0);
    if (sy > 1e-12) {
      const By = B.map(row => row.reduce((acc, v, j) => acc + v * y[j], 0));
      const yBy = y.reduce((acc, v, i) => acc + v * By[i], 0);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          B[i][j] += ((sy + yBy) * s[i] * s[j]) / (sy * sy) - (By[i] * s[j] + s[i] * By[j]) / sy;
    }
    const improvement = fx - fn;
    x = xn; fx = fn; g = gn; path.push(x.slice());
    if (Math.abs(improvement) < tol && Math.hypot(...g) < 1e-5) return { x, value: fx, path, iterations: it + 1, converged: true };
  }
  return { x, value: fx, path, iterations: maxIter, converged: false };
}

/** Standard errors for ML: Cov(θ̂) = (2/n) · H⁻¹, with H the Hessian of F_ML at the optimum. */
export function standardErrors(f: Fn, x: number[], n: number): number[] {
  const H = hessian(f, x);
  try {
    const inv = inverse(H);
    return inv.map((row, i) => Math.sqrt(Math.max(0, (2 / n) * row[i])));
  } catch {
    return x.map(() => NaN);
  }
}
