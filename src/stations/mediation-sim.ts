// Station 13's sandbox: X → M → Y with standardized variables. The paths set the
// population; n sets the standard errors. The indirect effect a·b gets a delta-method
// (Sobel) interval and a Monte Carlo interval (Preacher & Selig, 2012) — the two disagree
// exactly when the product is skewed, which is why the course reports bootstrap intervals.
import { normals, rng } from '../math/stats.ts';

export interface Paths { a: number; b: number; c: number; n: number }   // c: the direct effect c′

/** R² of Y from X and M, and whether the population is possible (residual variance > 0). */
export function r2Y({ a, b, c }: Paths) { return c * c + b * b + 2 * a * b * c; }
export const possible = (p: Paths) => r2Y(p) < 0.98;

export function effects(p: Paths) {
  const { a, b, c, n } = p;
  const seA = Math.sqrt((1 - a * a) / (n - 2));
  const seB = Math.sqrt((1 - r2Y(p)) / ((n - 3) * (1 - a * a)));
  const ab = a * b;
  const seAB = Math.sqrt(a * a * seB * seB + b * b * seA * seA);
  return { seA, seB, seC: seB, ab, seAB, z: ab / seAB, total: c + ab, sobel: [ab - 1.96 * seAB, ab + 1.96 * seAB] as [number, number] };
}

/** Draws of a·b from the sampling distributions of a and b. */
export function monteCarlo(p: Paths, draws = 4000, seed = 2027) {
  const e = effects(p), u = rng(seed);
  const za = normals(u, draws), zb = normals(u, draws);
  const out = za.map((z, i) => (p.a + z * e.seA) * (p.b + zb[i] * e.seB)).sort((x, y) => x - y);
  const q = (pr: number) => out[Math.min(out.length - 1, Math.max(0, Math.round(pr * (out.length - 1))))];
  return { draws: out, ci: [q(0.025), q(0.975)] as [number, number] };
}
