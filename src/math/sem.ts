// ---------------------------------------------------------------------------
// A general SEM estimator (maximum likelihood) for any model drawn in the studio,
// in one group or several, with the equalities of the invariance ladder.
//
// The model is written in RAM form, all variables in one vector v = (observed, latent):
//     v = A v + ε,   Cov(ε) = S,   E(ε) = m
//     Σ = F (I − A)⁻¹ S (I − A)⁻ᵀ Fᵀ,   μ = F (I − A)⁻¹ m
// A holds loadings and regressions, S variances and covariances, m intercepts and
// latent means; F picks the observed variables. Parameters follow lavaan's defaults
// for sem() exactly as diagram.ts counts them (marker loading 1, lone indicator's
// residual 0, fixed.x covariates, automatic covariances), and with several groups the
// mean structure is added and lavaan's group.equal / group.partial is applied.
//
//   F_ML = Σ_g (n_g/N) [ log|Σ| − log|S_g| + tr(S_g Σ⁻¹) − p + (ȳ − μ)ᵀ Σ⁻¹ (ȳ − μ) ]
//   χ² = N · F_ML,  S_g the sample covariance rescaled to (n_g − 1)/n_g as lavaan does
//
// Standard errors come from the expected information, as in lavaan (se = "standard").
// Checked against lavaan by src/math/sem.test.ts (values from scripts/sem-reference.R).
// ---------------------------------------------------------------------------
import { structure, type Diagram, type Structure } from '../model/diagram.ts';
import { EQUAL, locks, type Level } from '../model/invariance.ts';
import { cholesky, inverse, logDet, type Matrix } from './linalg.ts';
import { minimize } from './optimize.ts';
import { chisqP } from './stats.ts';

/** Summary statistics of one group, with the sample covariance matrix on n − 1. */
export interface GroupStats { label: string; n: number; names: string[]; means: number[]; cov: Matrix }

export interface FitRequest { groups: GroupStats[]; level?: Level; free?: string[] }

type Op = '=~' | '~' | '~~' | '~1';
export interface EstParam {
  group: number; op: Op; lhs: string; rhs: string;      // node ids (rhs '' for ~1)
  est: number; se: number; z: number; p: number; std: number;
  free: boolean; equal: boolean;                          // equal: held equal across groups
  key?: string; edge?: string;
}
export interface Fitted {
  ok: true;
  N: number; G: number; converged: boolean; iterations: number;
  chisq: number; df: number; pvalue: number; cfi: number; tli: number; rmsea: number; srmr: number;
  baseline: { chisq: number; df: number };
  params: EstParam[];
  r2: Record<string, number>[];                           // per group: node id → R²
  heywood: string[];                                      // node ids with a negative variance
  unidentified: boolean;                                  // the information matrix is singular: some parameter is not pinned down by the data
  names: Map<string, string>;
  mi: ModIndex[];                                         // largest first
  residuals: { order: string[]; groups: { cov: Matrix; mean: number[] }[] };   // residual correlations, observed in model order
  logl: number; aic: number; bic: number; npar: number;
  effects: EffectSet[];                                   // pairs with at least one indirect path
}
/** One effect with its delta-method (Sobel) standard error. */
export interface Eff { est: number; se: number; z: number; p: number; std: number }
/** How X affects Y: directly, through each mediator chain, and in total (course day 7). */
export interface EffectSet { group: number; from: string; to: string; direct: Eff | null; specific: (Eff & { path: string[] })[]; indirect: Eff; total: Eff }

/** A modification index: how much χ² would drop if this parameter were freed (and by how much it would change). */
export interface ModIndex { group: number; op: Op; lhs: string; rhs: string; mi: number; epc: number; sepc: number }
export interface FitError { ok: false; error: string; missing?: string[] }

interface Slot { group: number; mat: 'A' | 'S' | 'm'; r: number; c: number; theta: number; value: number; op: Op; lhs: string; rhs: string; key?: string; edge?: string; equal: boolean; dataFixed?: boolean; userFixed?: boolean }

const normP = (z: number) => {
  // two-sided p-value of a standard normal z (Abramowitz–Stegun 7.1.26)
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 1 - erf;
};

const mm = (A: Matrix, B: Matrix): Matrix => {
  const n = A.length, k = B.length, m = B[0].length, out: Matrix = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) { const Ai = A[i], Oi = out[i]; for (let l = 0; l < k; l++) { const a = Ai[l]; if (a !== 0) { const Bl = B[l]; for (let j = 0; j < m; j++) Oi[j] += a * Bl[j]; } } }
  return out;
};
const tr = (A: Matrix): Matrix => A[0].map((_, j) => A.map(r => r[j]));

export function fitModel(d: Diagram, req: FitRequest): Fitted | FitError {
  const s: Structure = structure(d);
  if (!s.observed.length) return { ok: false, error: 'Draw a model first.' };
  const G = req.groups.length;
  if (!G) return { ok: false, error: 'No data.' };
  const obs = s.observed, lat = s.latent, vars = [...obs, ...lat], p = obs.length, n = vars.length;
  const at = new Map(vars.map((v, i) => [v, i]));
  const name = (id: string) => s.names.get(id)!;
  // data columns for the boxes
  const missing = obs.filter(v => !req.groups[0].names.includes(name(v))).map(name);
  if (missing.length) return { ok: false, error: 'Some boxes are not variables in the data.', missing };
  const ms = G > 1;                                        // several groups: means enter the model
  const level: Level = ms ? (req.level ?? 'configural') : 'configural';
  const kinds = EQUAL[level];
  const released = new Set(req.free ?? []);
  const lockOf = new Map(locks(s).map(l => [l.key, l]));
  const ovx = new Set(s.roles.ovx);

  // per group: sample statistics in model order, rescaled like lavaan
  const data = req.groups.map(g => {
    const idx = obs.map(v => g.names.indexOf(name(v)));
    const f = (g.n - 1) / g.n;
    const S = idx.map(i => idx.map(j => g.cov[i][j] * f));
    const ybar = idx.map(i => g.means[i]);
    return { n: g.n, S, ybar, logdetS: logDet(S), label: g.label };
  });
  const N = data.reduce((a, g) => a + g.n, 0);
  if (data.some(g => !Number.isFinite(g.logdetS))) return { ok: false, error: 'The data matrix of these variables is singular (a variable is constant or duplicated).' };

  // ---- parameter slots
  const slots: Slot[] = [];
  const shared = new Map<string, number>();
  let nTheta = 0;
  const newTheta = (key: string | undefined, eq: boolean) => {
    if (eq && key && shared.has(key)) return shared.get(key)!;
    const t = nTheta++;
    if (eq && key) shared.set(key, t);
    return t;
  };
  const isEqual = (key?: string) => {
    if (!ms || !key) return false;
    const l = lockOf.get(key);
    return !!l && kinds.includes(l.kind) && !released.has(key);
  };
  for (let g = 0; g < G; g++) {
    const D = data[g];
    for (const q of s.params) {
      const li = at.get(q.lhs)!, ri = at.get(q.rhs)!;
      let mat: Slot['mat'], r: number, c: number, key: string | undefined;
      if (q.role === 'loading') { mat = 'A'; r = ri; c = li; key = `load:${q.edge}`; }
      else if (q.role === 'regression') { mat = 'A'; r = li; c = ri; }
      else { mat = 'S'; r = li; c = ri; if (q.role === 'variance' && li < p) key = `res:${q.lhs}`; }
      const eq = isEqual(key);
      let value = 0, theta = -1;
      if (typeof q.fixed === 'number') {
        // std.lv: a factor variance fixed to 1 is estimated in groups 2, 3, … once the loadings are equal
        if (q.stdlvFixed && ms && g > 0 && kinds.includes('loading')) theta = newTheta(undefined, false);
        else value = q.fixed;
      } else if (q.fixed === 'data') { value = D.S[li][ri]; }
      else if (q.label) theta = newTheta(`lab:${q.label}`, true);          // one parameter for the label, in every group
      else theta = newTheta(key, eq);
      slots.push({ group: g, mat, r, c, theta, value, op: q.op, lhs: q.lhs, rhs: q.rhs, key, edge: q.edge, equal: (eq || (!!q.label && ms)) && theta >= 0, dataFixed: q.fixed === 'data', userFixed: typeof q.fixed === 'number' && !q.auto });
    }
    if (ms) {
      obs.forEach((v, i) => {
        if (ovx.has(v)) { slots.push({ group: g, mat: 'm', r: i, c: 0, theta: -1, value: D.ybar[i], op: '~1', lhs: v, rhs: '', equal: false }); return; }
        const key = `int:${v}`, eq = isEqual(key);
        slots.push({ group: g, mat: 'm', r: i, c: 0, theta: newTheta(key, eq), value: 0, op: '~1', lhs: v, rhs: '', key, equal: eq });
      });
      const meansFree = kinds.includes('intercept') && g > 0;
      lat.forEach((v, j) => slots.push({ group: g, mat: 'm', r: p + j, c: 0, theta: meansFree ? newTheta(undefined, false) : -1, value: 0, op: '~1', lhs: v, rhs: '', equal: false }));
    }
  }

  // ---- start values (from the first group that uses the parameter)
  const x0 = new Array(nTheta).fill(NaN);
  for (const sl of slots) {
    if (sl.theta < 0 || !Number.isNaN(x0[sl.theta])) continue;
    const D = data[sl.group];
    const varOf = (i: number) => (i < p ? D.S[i][i] : 1);
    let v = 0;
    if (sl.mat === 'A' && sl.op === '=~') {
      // λ_j ≈ cov(x_j, marker) / var(marker), the marker being the factor's first indicator
      const f = sl.c, marker = s.load.find(e => e.from === vars[f]);
      const mi = marker ? at.get(marker.to)! : -1;
      v = d.stdlv && sl.r < p ? Math.sqrt(Math.max(0.05, 0.5 * D.S[sl.r][sl.r]))
        : mi >= 0 && mi < p && sl.r < p ? Math.max(0.2, Math.min(3, D.S[sl.r][mi] / Math.max(1e-6, 0.5 * D.S[mi][mi]))) : 1;
    } else if (sl.mat === 'S' && sl.r === sl.c) {
      if (sl.r < p) v = 0.5 * varOf(sl.r);
      else if (d.stdlv) v = 1;
      else { const marker = s.load.find(e => e.from === vars[sl.r]); const mi = marker ? at.get(marker.to)! : -1; v = mi >= 0 && mi < p ? 0.5 * D.S[mi][mi] : 0.3; }
    } else if (sl.mat === 'm' && sl.r < p) v = D.ybar[sl.r];
    x0[sl.theta] = v;
  }

  // ---- model matrices for one group
  const build = (x: number[], g: number) => {
    const A: Matrix = Array.from({ length: n }, () => new Array(n).fill(0));
    const S: Matrix = Array.from({ length: n }, () => new Array(n).fill(0));
    const m = new Array(n).fill(0);
    for (const sl of slots) {
      if (sl.group !== g) continue;
      const v = sl.theta >= 0 ? x[sl.theta] : sl.value;
      if (sl.mat === 'A') A[sl.r][sl.c] = v;
      else if (sl.mat === 'S') { S[sl.r][sl.c] = v; S[sl.c][sl.r] = v; }
      else m[sl.r] = v;
    }
    return { A, S, m };
  };
  const implied = (x: number[], g: number) => {
    const { A, S, m } = build(x, g);
    const IA = A.map((row, i) => row.map((v, j) => (i === j ? 1 : 0) - v));
    let B: Matrix;
    try { B = inverse(IA); } catch { return null; }
    const C = mm(mm(B, S), tr(B));
    const Sigma = C.slice(0, p).map(r => r.slice(0, p));
    const muAll = B.map(r => r.reduce((a, v, j) => a + v * m[j], 0));
    return { A, S, m, B, C, Sigma, muAll, mu: muAll.slice(0, p) };
  };

  const fg = (x: number[], g: number) => {
    const I = implied(x, g);
    if (!I) return { F: Infinity, I: null, Sinv: null };
    // Σ must be positive definite (a determinant alone can be positive for an indefinite matrix)
    const L = cholesky(I.Sigma);
    if (!L) return { F: Infinity, I, Sinv: null };
    const ld = 2 * L.reduce((a, row, i) => a + Math.log(row[i]), 0);
    let Sinv: Matrix;
    try { Sinv = inverse(I.Sigma); } catch { return { F: Infinity, I, Sinv: null }; }
    const D = data[g];
    let trace = 0;
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) trace += D.S[i][j] * Sinv[j][i];
    let F = ld - D.logdetS + trace - p;
    if (ms) { const v = D.ybar.map((y, i) => y - I.mu[i]); for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) F += v[i] * Sinv[i][j] * v[j]; }
    return { F, I, Sinv };
  };
  const objective = (x: number[]) => {
    let F = 0;
    for (let g = 0; g < G; g++) { const r = fg(x, g); if (!Number.isFinite(r.F)) return Infinity; F += (data[g].n / N) * r.F; }
    return F;
  };
  /** The pieces of ∂F_g: dF/dA_ij = 2 GA_ij − 2 r_i μ_j, dF/dS_ij = 2 Y_ij (i ≠ j) or Y_ii, dF/dm_i = −2 r_i. */
  const gradParts = (x: number[], g: number) => {
    const { I, Sinv } = fg(x, g);
    if (!I || !Sinv) return null;
    const D = data[g];
    const v = D.ybar.map((y, i) => y - I.mu[i]);
    // W = Σ⁻¹ − Σ⁻¹ (S + v vᵀ) Σ⁻¹, embedded in the full variable space
    const SS = D.S.map((r, i) => r.map((val, j) => val + (ms ? v[i] * v[j] : 0)));
    const SiSS = mm(Sinv, SS), SiSSSi = mm(SiSS, Sinv);
    const Wf: Matrix = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) Wf[i][j] = Sinv[i][j] - SiSSSi[i][j];
    const Bt = tr(I.B);
    const GA = mm(mm(Bt, Wf), I.C);
    const Y = mm(mm(Bt, Wf), I.B);
    const u = ms ? Sinv.map(r => r.reduce((a, val, j) => a + val * v[j], 0)) : new Array(p).fill(0);
    const rvec = Bt.map(row => row.reduce((a, val, j) => a + (j < p ? val * u[j] : 0), 0));   // Bᵀ Fᵀ Σ⁻¹ v
    return { I, Sinv, GA, Y, rvec };
  };
  const grad = (x: number[]) => {
    const out = new Array(nTheta).fill(0);
    for (let g = 0; g < G; g++) {
      const gp = gradParts(x, g);
      if (!gp) return out.map(() => NaN);
      const { I, GA, Y, rvec } = gp, w = data[g].n / N;
      for (const sl of slots) {
        if (sl.group !== g || sl.theta < 0) continue;
        let dv: number;
        if (sl.mat === 'A') dv = 2 * GA[sl.r][sl.c] - (ms ? 2 * rvec[sl.r] * I.muAll[sl.c] : 0);
        else if (sl.mat === 'S') dv = sl.r === sl.c ? Y[sl.r][sl.r] : 2 * Y[sl.r][sl.c];
        else dv = -2 * rvec[sl.r];
        out[sl.theta] += w * dv;
      }
    }
    return out;
  };

  const res = minimize(objective, x0, { grad, maxIter: 2000, tol: 1e-12 });
  let x = res.x;
  // a second polish from the optimum (BFGS restarts with a fresh curvature estimate)
  const polish = minimize(objective, x, { grad, maxIter: 500, tol: 1e-14 });
  if (polish.value <= res.value) x = polish.x;
  const Fmin = objective(x);
  if (!Number.isFinite(Fmin)) return { ok: false, error: 'The estimation did not find an admissible solution. Is the model identified?' };

  // ---- expected information and standard errors
  const info: Matrix = Array.from({ length: nTheta }, () => new Array(nTheta).fill(0));
  const perGroup: { P: (Matrix | null)[]; dM: (number[] | null)[] }[] = [];
  for (let g = 0; g < G; g++) {
    const { I, Sinv } = fg(x, g);
    if (!I || !Sinv) continue;
    const w = data[g].n / N, B = I.B, C = I.C;
    const dS: (Matrix | null)[] = new Array(nTheta).fill(null), dM: (number[] | null)[] = new Array(nTheta).fill(null);
    const addTo = (t: number, f: (r: number, c: number) => number, fm?: (r: number) => number) => {
      if (!dS[t]) dS[t] = Array.from({ length: p }, () => new Array(p).fill(0));
      for (let r = 0; r < p; r++) for (let c = 0; c < p; c++) dS[t]![r][c] += f(r, c);
      if (ms && fm) { if (!dM[t]) dM[t] = new Array(p).fill(0); for (let r = 0; r < p; r++) dM[t]![r] += fm(r); }
    };
    for (const sl of slots) {
      if (sl.group !== g || sl.theta < 0) continue;
      const i = sl.r, j = sl.c;
      if (sl.mat === 'A') addTo(sl.theta, (r, c) => B[r][i] * C[j][c] + C[r][j] * B[c][i], r => B[r][i] * I.muAll[j]);
      else if (sl.mat === 'S') addTo(sl.theta, i === j ? (r, c) => B[r][i] * B[c][i] : (r, c) => B[r][i] * B[c][j] + B[r][j] * B[c][i], () => 0);
      else { if (!dS[sl.theta]) dS[sl.theta] = Array.from({ length: p }, () => new Array(p).fill(0)); if (ms) { if (!dM[sl.theta]) dM[sl.theta] = new Array(p).fill(0); for (let r = 0; r < p; r++) dM[sl.theta]![r] += B[r][i]; } }
    }
    const P = dS.map(m => (m ? mm(Sinv, m) : null));
    perGroup[g] = { P, dM };
    for (let a = 0; a < nTheta; a++) {
      if (!P[a]) continue;
      for (let b = a; b < nTheta; b++) {
        if (!P[b]) continue;
        let t = 0;
        const Pa = P[a]!, Pb = P[b]!;
        for (let r = 0; r < p; r++) for (let c = 0; c < p; c++) t += Pa[r][c] * Pb[c][r];
        let val = 0.5 * t;
        if (ms && dM[a] && dM[b]) for (let r = 0; r < p; r++) for (let c = 0; c < p; c++) val += dM[a]![r] * Sinv[r][c] * dM[b]![c];
        info[a][b] += w * val; if (a !== b) info[b][a] += w * val;
      }
    }
  }
  let se: number[], infoInv: Matrix | null = null;
  try {
    infoInv = inverse(info);
    se = infoInv.map((row, i) => (row[i] > 0 ? Math.sqrt(row[i] / N) : NaN));
    // a (near-)singular information matrix: the inverse explodes or turns indefinite
    if (se.some(v => !Number.isFinite(v) || v > 1e6)) infoInv = null;
  } catch { se = new Array(nTheta).fill(NaN); }

  // ---- fit
  const chisq = Math.max(0, N * Fmin);
  const kx = s.roles.ovx.length;
  const knowns = G * ((p * (p + 1)) / 2 + (ms ? p : 0));
  const dataFixed = G * ((kx * (kx + 1)) / 2 + (ms ? kx : 0));
  const df = knowns - nTheta - dataFixed;
  // baseline: variances (and means) free, covariates keep their covariances
  const xIdx = obs.map((v, i) => (ovx.has(v) ? i : -1)).filter(i => i >= 0);
  let Fb = 0;
  data.forEach(D => {
    const Sb = D.S.map((r, i) => r.map((val, j) => (i === j || (xIdx.includes(i) && xIdx.includes(j)) ? val : 0)));
    const Sbi = inverse(Sb);
    let t = 0; for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) t += D.S[i][j] * Sbi[j][i];
    Fb += (D.n / N) * (logDet(Sb) - D.logdetS + t - p);
  });
  const bChisq = N * Fb, bDf = G * ((p * (p - 1)) / 2 - (kx * (kx - 1)) / 2);
  const cfiDen = Math.max(bChisq - bDf, chisq - df, 0);
  const cfi = cfiDen === 0 ? 1 : 1 - Math.max(chisq - df, 0) / cfiDen;
  const tli = df > 0 && bDf > 0 ? (bChisq / bDf - chisq / df) / (bChisq / bDf - 1) : 1;
  const rmsea = df > 0 ? Math.sqrt(Math.max(chisq - df, 0) / (df * N)) * Math.sqrt(G) : 0;
  let srmr = 0;
  data.forEach((D, g) => {
    const I = implied(x, g)!;
    let sum = 0, count = 0;
    for (let i = 0; i < p; i++) for (let j = 0; j <= i; j++) {
      // Bentler's SRMR, as lavaan reports it: both matrices scaled by the sample standard deviations
      const r = (D.S[i][j] - I.Sigma[i][j]) / Math.sqrt(D.S[i][i] * D.S[j][j]);
      sum += r * r; count++;
    }
    if (ms) for (let i = 0; i < p; i++) { const r = (D.ybar[i] - I.mu[i]) / Math.sqrt(D.S[i][i]); sum += r * r; count++; }
    srmr += (D.n / N) * Math.sqrt(sum / count);
  });

  // ---- estimates, standardized (std.all), R²
  const r2: Record<string, number>[] = [];
  const heywood = new Set<string>();
  const params: EstParam[] = [];
  for (let g = 0; g < G; g++) {
    const I = implied(x, g)!;
    const sd = I.C.map((r, i) => Math.sqrt(Math.max(r[i], 1e-12)));
    const rr: Record<string, number> = {};
    vars.forEach((v, i) => {
      const endo = I.A[i].some(a => a !== 0);
      if (endo) rr[v] = 1 - I.S[i][i] / I.C[i][i];
      if (I.S[i][i] < 0) heywood.add(v);
    });
    r2.push(rr);
    for (const sl of slots) {
      if (sl.group !== g) continue;
      const est = sl.theta >= 0 ? x[sl.theta] : sl.value;
      const e = sl.theta >= 0 ? se[sl.theta] : 0;
      let std: number;
      if (sl.mat === 'A') std = est * sd[sl.c] / sd[sl.r];
      else if (sl.mat === 'S') {
        // variances relative to the total, covariances as correlations of the (residual) terms
        if (sl.r === sl.c) std = est / I.C[sl.r][sl.r];
        else std = est / Math.sqrt(Math.max(I.S[sl.r][sl.r], 1e-12) * Math.max(I.S[sl.c][sl.c], 1e-12));
      } else std = est / sd[sl.r];
      const z = e > 0 ? est / e : NaN;
      params.push({ group: g, op: sl.op, lhs: sl.lhs, rhs: sl.rhs, est, se: e, z, p: Number.isFinite(z) ? normP(z) : NaN, std, free: sl.theta >= 0, equal: sl.equal, key: sl.key, edge: sl.edge });
    }
  }
  // ---- modification indices: score test for each parameter that is fixed to 0 (one at a time, expected information)
  const mi: ModIndex[] = [];
  const indicators = new Set(s.load.map(e => e.to)), structural = vars.filter(v => !indicators.has(v) || lat.includes(v));
  for (let g = 0; g < G && infoInv; g++) {
    const gp = gradParts(x, g), pg = perGroup[g];
    if (!gp || !pg) continue;
    const { I, Sinv, GA, Y, rvec } = gp, B = I.B, C = I.C, w = data[g].n / N;
    const hasA = new Set(slots.filter(sl => sl.group === g && sl.mat === 'A').map(sl => `${sl.r},${sl.c}`));
    const hasS = new Set(slots.filter(sl => sl.group === g && sl.mat === 'S').flatMap(sl => [`${sl.r},${sl.c}`, `${sl.c},${sl.r}`]));
    const cands: { op: Op; lhs: string; rhs: string; mat: 'A' | 'S'; i: number; j: number }[] = [];
    lat.forEach(f => obs.forEach(x => { if (indicators.has(x) && !hasA.has(`${at.get(x)},${at.get(f)}`)) cands.push({ op: '=~', lhs: f, rhs: x, mat: 'A', i: at.get(x)!, j: at.get(f)! }); }));
    // parameters fixed to a value (markers, user-fixed values, std.lv variances) can be freed as well
    for (const sl of slots) {
      if (sl.group !== g || sl.theta >= 0 || sl.mat === 'm' || sl.dataFixed) continue;
      if (sl.mat === 'S' && sl.r === sl.c && !sl.userFixed) continue;     // a variance only when the user fixed it (x ~~ 0*x)
      cands.push({ op: sl.op as Op, lhs: sl.lhs, rhs: sl.rhs, mat: sl.mat, i: sl.r, j: sl.c });
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const bothObs = i < p && j < p, bothLat = i >= p && j >= p;
      if (!(bothObs || bothLat) || hasS.has(`${i},${j}`)) continue;
      if (bothObs && (ovx.has(vars[i]) || ovx.has(vars[j]))) continue;
      cands.push({ op: '~~', lhs: vars[i], rhs: vars[j], mat: 'S', i, j });
    }
    // a covariate (fixed.x) is not an outcome: age is not caused by attitudes
    structural.filter(y => !ovx.has(y)).forEach(y => structural.forEach(xv => {
      if (y === xv || hasA.has(`${at.get(y)},${at.get(xv)}`)) return;     // the reverse of an existing path is a candidate too
      cands.push({ op: '~', lhs: y, rhs: xv, mat: 'A', i: at.get(y)!, j: at.get(xv)! });
    }));
    const sd = C.map((r, i) => Math.sqrt(Math.max(r[i], 1e-12)));
    for (const c of cands) {
      const { i, j } = c;
      const dS: Matrix = Array.from({ length: p }, () => new Array(p).fill(0));
      const dMu = new Array(p).fill(0);
      for (let r = 0; r < p; r++) for (let q = 0; q < p; q++)
        dS[r][q] = c.mat === 'A' ? B[r][i] * C[j][q] + C[r][j] * B[q][i] : i === j ? B[r][i] * B[q][i] : B[r][i] * B[q][j] + B[r][j] * B[q][i];
      if (ms && c.mat === 'A') for (let r = 0; r < p; r++) dMu[r] = B[r][i] * I.muAll[j];
      const score = 0.5 * w * (c.mat === 'A' ? 2 * GA[i][j] - (ms ? 2 * rvec[i] * I.muAll[j] : 0) : i === j ? Y[i][i] : 2 * Y[i][j]);
      const Pc = mm(Sinv, dS);
      const cross = (Pa: Matrix | null, dMa: number[] | null) => {
        let v = 0;
        if (Pa) for (let r = 0; r < p; r++) for (let q = 0; q < p; q++) v += Pc[r][q] * Pa[q][r];
        v *= 0.5;
        if (ms && dMa) for (let r = 0; r < p; r++) for (let q = 0; q < p; q++) v += dMu[r] * Sinv[r][q] * dMa[q];
        return w * v;
      };
      const Ipp = cross(Pc, dMu);
      const Ipt = pg.P.map((Pa, a) => cross(Pa, pg.dM[a]));
      let quad = 0;
      for (let a = 0; a < nTheta; a++) { if (!Ipt[a]) continue; for (let b = 0; b < nTheta; b++) quad += Ipt[a] * infoInv[a][b] * Ipt[b]; }
      const V = Ipp - quad;
      // freeing this parameter would leave it unidentified: no information beyond what the model already uses
      if (!(V > 1e-8 * Math.max(Ipp, 1e-12))) { mi.push({ group: g, op: c.op, lhs: c.lhs, rhs: c.rhs, mi: NaN, epc: NaN, sepc: NaN }); continue; }
      const m = N * score * score / V, epc = -score / V;
      const sepc = c.mat === 'A' ? epc * sd[j] / sd[i]
        : i === j ? epc / I.C[i][i]                                   // a variance: as a share of the total variance
          : I.S[i][i] > 1e-10 && I.S[j][j] > 1e-10 ? epc / Math.sqrt(I.S[i][i] * I.S[j][j]) : NaN;   // no residual variance: no standardized value
      mi.push({ group: g, op: c.op, lhs: c.lhs, rhs: c.rhs, mi: m, epc, sepc });
    }
  }
  mi.sort((a, b) => (Number.isNaN(a.mi) ? -1 : a.mi) < (Number.isNaN(b.mi) ? -1 : b.mi) ? 1 : -1);

  // ---- effect decomposition: direct, specific indirect (products along each path), total; delta-method SEs
  const effects: EffectSet[] = [];
  const vcov = infoInv ? infoInv.map(r => r.map(v => v / N)) : null;
  for (let g = 0; g < G; g++) {
    const regs = slots.filter(sl => sl.group === g && sl.op === '~');
    const out = new Map<number, number[]>();
    regs.forEach(sl => out.set(sl.c, [...(out.get(sl.c) ?? []), sl.r]));
    const coef = (th: number[], r: number, c: number) => { const sl = regs.find(q => q.r === r && q.c === c)!; return sl.theta >= 0 ? th[sl.theta] : sl.value; };
    const I = implied(x, g)!;
    const sd = I.C.map((r, i) => Math.sqrt(Math.max(r[i], 1e-12)));
    const sources = [...new Set(regs.map(sl => sl.c))];
    for (const from of sources) {
      // every simple path from `from` (depth-first, capped so that dense models stay fast)
      const paths: number[][] = [];
      const walk = (node: number, path: number[]) => {
        if (paths.length > 200) return;
        for (const nx of out.get(node) ?? []) {
          if (path.includes(nx)) continue;
          const np = [...path, nx];
          paths.push(np);
          walk(nx, np);
        }
      };
      walk(from, [from]);
      const targets = [...new Set(paths.filter(pp => pp.length > 2).map(pp => pp[pp.length - 1]))];
      for (const to of targets) {
        const mine = paths.filter(pp => pp[pp.length - 1] === to);
        const prod = (th: number[], pp: number[]) => pp.slice(1).reduce((a, v, k) => a * coef(th, v, pp[k]), 1);
        const used = [...new Set(mine.flatMap(pp => pp.slice(1).map((v, k) => regs.find(q => q.r === v && q.c === pp[k])!.theta).filter(tt => tt >= 0)))];
        const eff = (f: (th: number[]) => number): Eff => {
          const est = f(x);
          let se = NaN;
          if (vcov) {
            // gradient of the effect in the parameters it uses, then gᵀ V g
            const gr = used.map(tt => { const h = 1e-6 * Math.max(1, Math.abs(x[tt])); const a = x.slice(), b = x.slice(); a[tt] += h; b[tt] -= h; return (f(a) - f(b)) / (2 * h); });
            let v = 0; used.forEach((ta, i) => used.forEach((tb, j) => { v += gr[i] * vcov[ta][tb] * gr[j]; }));
            se = Math.sqrt(Math.max(v, 0));
          }
          const z = se > 0 ? est / se : NaN;
          return { est, se, z, p: Number.isFinite(z) ? normP(z) : NaN, std: est * sd[from] / sd[to] };
        };
        const direct = mine.find(pp => pp.length === 2);
        const ind = mine.filter(pp => pp.length > 2);
        effects.push({
          group: g, from: vars[from], to: vars[to],
          direct: direct ? eff(th => prod(th, direct)) : null,
          specific: ind.map(pp => ({ ...eff(th => prod(th, pp)), path: pp.map(i => vars[i]) })),
          indirect: eff(th => ind.reduce((a, pp) => a + prod(th, pp), 0)),
          total: eff(th => mine.reduce((a, pp) => a + prod(th, pp), 0)),
        });
      }
    }
  }

  // ---- residual correlations (Bentler: both matrices scaled by the sample standard deviations), log-likelihood
  const residuals = data.map((D, g) => {
    const I = implied(x, g)!;
    return {
      cov: D.S.map((r, i) => r.map((v, j) => (v - I.Sigma[i][j]) / Math.sqrt(D.S[i][i] * D.S[j][j]))),
      mean: ms ? D.ybar.map((y, i) => (y - I.mu[i]) / Math.sqrt(D.S[i][i])) : [],
    };
  });
  // lavaan conditions on fixed.x covariates: their own (perfectly fitted) part leaves the likelihood
  let logl = 0;
  data.forEach((D, g) => {
    const r = fg(x, g);
    logl += -(D.n / 2) * (p * Math.log(2 * Math.PI) + r.F + D.logdetS + p);
    if (xIdx.length) {
      const Sx = xIdx.map(i => xIdx.map(j => D.S[i][j]));
      logl -= -(D.n / 2) * (xIdx.length * Math.log(2 * Math.PI) + logDet(Sx) + xIdx.length);
    }
  });
  const k = nTheta;

  return {
    unidentified: !infoInv || se.some(v => !Number.isFinite(v) || v > 1e6),
    mi, effects, residuals: { order: obs, groups: residuals }, logl, aic: -2 * logl + 2 * k, bic: -2 * logl + k * Math.log(N), npar: k,
    ok: true, N, G, converged: res.converged, iterations: res.iterations + polish.iterations,
    chisq, df, pvalue: df > 0 ? chisqP(chisq, df) : NaN, cfi, tli, rmsea, srmr,
    baseline: { chisq: bChisq, df: bDf }, params, r2, heywood: [...heywood], names: s.names,
  };
}

/** Covariance matrix (n − 1) and means of complete cases — for the learner's own data. */
export function statsFrom(rows: number[][], names: string[], label: string): GroupStats {
  const ok = rows.filter(r => r.every(v => Number.isFinite(v)));
  const n = ok.length, k = names.length;
  const means = names.map((_, j) => ok.reduce((a, r) => a + r[j], 0) / Math.max(n, 1));
  const cov: Matrix = Array.from({ length: k }, () => new Array(k).fill(0));
  for (const r of ok) for (let i = 0; i < k; i++) for (let j = 0; j <= i; j++) cov[i][j] += (r[i] - means[i]) * (r[j] - means[j]);
  for (let i = 0; i < k; i++) for (let j = 0; j <= i; j++) { cov[i][j] /= Math.max(n - 1, 1); cov[j][i] = cov[i][j]; }
  return { label, n, names, means, cov };
}
