// The R outputs of Day 2 (public/data/day2.json, written by scripts/day2-outputs.R with the
// η Lab pipeline): the two-factor model of tradition/conformity and universalism with ML,
// MLR and WLSMV, its observed and implied matrices, local fit, nested comparisons, and the
// homework on alternative identifications.
import { useEffect, useState } from 'react';
import type { Est, MI } from '../day1/data.ts';

export type Fit = Record<string, number>;
export interface Lrt { model: string; df: number; aic: number; bic: number; chisq: number; dchisq: number | null; ddf: number | null; p: number | null }
export interface Day2 {
  source: string; items: string[]; model: string; n: number; n_ord: number;
  frq: { item: string; counts: number[]; missing: number }[]; mvn: string;
  S: number[][]; Sigma: number[][]; R_obs: number[][]; R_imp: number[][]; resid_cor: number[][]; resid_z: number[][];
  ml: { fit: Fit; estimates: Est[]; summary: string };
  mlr: { fit: Fit; estimates: Est[]; summary: string };
  mi: MI[]; mi_text: string;
  one: { fit: Fit; estimates: Est[] };
  lrt_1v2: Lrt[]; lrt_1v2_text: string; cmp_1v2_text: string;
  freed: string; mod: { fit: Fit; estimates: Est[] };
  lrt_mod: Lrt[]; lrt_mod_text: string; cmp_mod_text: string;
  ord: { fit: Fit; estimates: Est[]; R_poly: number[][]; thresholds: { item: string; t: number; value: number }[]; summary: string };
  ident: Record<'first' | 'fourth' | 'fixed', { estimates: Est[]; chisq: number }>;
}

let cache: Promise<Day2> | null = null;
export function useDay2() {
  const [d, setD] = useState<Day2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    cache ??= fetch(`${import.meta.env.BASE_URL}data/day2.json`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Day2>; });
    cache.then(setD).catch(e => setError((e as Error).message));
  }, []);
  return { d, error };
}

export const FACTORS = { TRCO: ['ipmodst', 'imptrad', 'ipfrule', 'ipbhprp'], UNIV: ['ipeqopt', 'ipudrst', 'impenv'] } as const;
export const factorOf = (item: string) => ((FACTORS.TRCO as readonly string[]).includes(item) ? 'TRCO' : 'UNIV');
export const loadings = (e: Est[]) => e.filter(x => x.op === '=~');
export const est = (e: Est[], lhs: string, op: string, rhs: string) => e.find(x => x.lhs === lhs && x.op === op && x.rhs === rhs);
export const factorCor = (e: Est[]) => est(e, 'TRCO', '~~', 'UNIV')?.std ?? NaN;
