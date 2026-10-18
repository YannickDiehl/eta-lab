// One source for the rules of thumb, so the badge, the results, the stations, the report and
// the course pages never disagree. CFI/TLI after Hu & Bentler (1999); RMSEA .05/.08 after
// Browne & Cudeck (1993); SRMR .08 after Hu & Bentler (1999), .05 as the course's "good";
// χ²/df after the course slides and worksheet (Day 2); ΔCFI after Chen (2007).
export const CUTOFFS = {
  cfi: { good: 0.95, fair: 0.90 },
  tli: { good: 0.95, fair: 0.90 },
  rmsea: { good: 0.05, fair: 0.08 },
  srmr: { good: 0.05, fair: 0.08 },
  deltaCfi: 0.01,
  chiDf: { good: 2, fair: 3 },
} as const;

export type Light = 'good' | 'fair' | 'poor';
type Index = keyof Omit<typeof CUTOFFS, 'deltaCfi' | 'chiDf'>;

export function light(k: Index, v: number): Light {
  const c = CUTOFFS[k];
  if (k === 'cfi' || k === 'tli') return v >= c.good ? 'good' : v >= c.fair ? 'fair' : 'poor';
  return v <= c.good ? 'good' : v <= c.fair ? 'fair' : 'poor';
}

/** The overall verdict from CFI, RMSEA and SRMR read together: poor if any is poor, good only if all are. */
export function fitVerdict(f: { cfi: number; rmsea: number; srmr: number }): Light {
  const ls = (['cfi', 'rmsea', 'srmr'] as const).map(k => light(k, f[k]));
  return ls.includes('poor') ? 'poor' : ls.every(l => l === 'good') ? 'good' : 'fair';
}

const d2 = (v: number) => v.toFixed(2).replace(/^0/, '');
export const CUTOFF_SOURCE = 'Hu & Bentler (1999); Browne & Cudeck (1993) for RMSEA';
export const CUTOFF_TEXT = `good: CFI/TLI ≥ ${d2(CUTOFFS.cfi.good)}, RMSEA ≤ ${d2(CUTOFFS.rmsea.good)}, SRMR ≤ ${d2(CUTOFFS.srmr.good)} · acceptable: CFI/TLI ≥ ${d2(CUTOFFS.cfi.fair)}, RMSEA and SRMR ≤ ${d2(CUTOFFS.rmsea.fair)}`;

/** Chen's (2007) rule in one sentence, for every place that judges a step of a ladder. */
/** The course's line on observed sum or mean scores across groups (Days 4 and 5). With the sum
 *  S = Σ y_i of k items: E(S_g) = Σ τ_ig + (Σ λ_ig) κ_g and Var(S_g) = (Σ λ_ig)² φ_g + Σ θ_ig.
 *  A mean difference in S reflects κ only if intercepts and loadings are equal for every item in
 *  the score; a released item shifts the sum. Variances, reliabilities, correlations and
 *  standardized differences also contain the residual variances θ. */
export const SUM_SCORE_RULE = 'Observed sum or mean scores: comparing their means needs full scalar invariance of every item in the score — partial invariance is not enough, because a released item shifts the sum. Comparing their variances, correlations, reliabilities or standardized differences (Cohen’s d) needs strict invariance as well, because the residual variances are part of the score.';

export const CHEN_RULE = 'ΔCFI is the main criterion: a step costs too much when CFI drops by more than .010 (samples above 300; .005 below). Chen (2007) confirms it with a rise in RMSEA above .015 or in SRMR beyond its limit (Day 4, section 6).';
