// Small dense linear algebra for symmetric model matrices (p ≤ 12).

export type Matrix = number[][];

export const zeros = (r: number, c = r): Matrix => Array.from({ length: r }, () => Array(c).fill(0));
export const identity = (n: number): Matrix => zeros(n).map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));
export const clone = (A: Matrix): Matrix => A.map(row => row.slice());
export const transpose = (A: Matrix): Matrix => A[0].map((_, j) => A.map(row => row[j]));

export function multiply(A: Matrix, B: Matrix): Matrix {
  const out = zeros(A.length, B[0].length);
  for (let i = 0; i < A.length; i++)
    for (let k = 0; k < B.length; k++) {
      const a = A[i][k];
      if (a === 0) continue;
      for (let j = 0; j < B[0].length; j++) out[i][j] += a * B[k][j];
    }
  return out;
}

export const add = (A: Matrix, B: Matrix): Matrix => A.map((row, i) => row.map((v, j) => v + B[i][j]));
export const subtract = (A: Matrix, B: Matrix): Matrix => A.map((row, i) => row.map((v, j) => v - B[i][j]));
export const trace = (A: Matrix): number => A.reduce((s, row, i) => s + row[i], 0);

/** Log-determinant via LU with partial pivoting; NaN if singular or the determinant is ≤ 0. */
export function logDet(A: Matrix): number {
  const a = clone(A), n = a.length;
  let sign = 1, log = 0;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
    if (Math.abs(a[p][i]) < 1e-14) return NaN;
    if (p !== i) { [a[p], a[i]] = [a[i], a[p]]; sign = -sign; }
    const piv = a[i][i];
    if (piv < 0) sign = -sign;
    log += Math.log(Math.abs(piv));
    for (let r = i + 1; r < n; r++) {
      const f = a[r][i] / piv;
      if (f !== 0) for (let c = i; c < n; c++) a[r][c] -= f * a[i][c];
    }
  }
  return sign > 0 ? log : NaN;
}

/** Inverse via Gauss–Jordan; throws if singular. */
export function inverse(A: Matrix): Matrix {
  const n = A.length, a = A.map((row, i) => [...row, ...identity(n)[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
    if (Math.abs(a[p][i]) < 1e-14) throw new Error('singular matrix');
    [a[p], a[i]] = [a[i], a[p]];
    const v = a[i][i];
    for (let c = 0; c < 2 * n; c++) a[i][c] /= v;
    for (let r = 0; r < n; r++) if (r !== i) {
      const f = a[r][i];
      if (f !== 0) for (let c = 0; c < 2 * n; c++) a[r][c] -= f * a[i][c];
    }
  }
  return a.map(row => row.slice(n));
}

/** Cholesky factor L (lower) with L Lᵀ = A; null if A is not positive definite. */
export function cholesky(A: Matrix): Matrix | null {
  const n = A.length, L = zeros(n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) { if (s <= 1e-12) return null; L[i][i] = Math.sqrt(s); }
      else L[i][j] = s / L[j][j];
    }
  return L;
}
