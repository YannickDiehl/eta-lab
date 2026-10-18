// The R outputs of Day 5 (public/data/day5.json, written by scripts/day5-outputs.R): latent means
// against mean scores, the modification cascade and its replication, alignment, a second-order
// factor (conservation in Belgium), a bifactor model, the MTMM model on simulated data, and the
// week-1 probe (two values across the Benelux).
import { useEffect, useState } from 'react';

export type Fit = Record<string, number>;
export interface Est { lhs: string; op: string; rhs: string; group: number; est: number; se: number; std: number }
export interface Lrt { dchisq: number; ddf: number; p: number }
export interface Step { step: number; what: string; kind?: string; index?: number; fit: Fit }
export interface LatentMean { group: string; std: number; se: number; p: number | null; eff: number }
export interface Day5 {
  source: string; groups: string[];
  means: {
    score: { cntry: string; n: number; mean: number; sd: number }[];
    item_means: Record<string, number | string>[];
    t: { t: number; df: number; p: number; d: number };
    latent: Record<'scalar' | 'partial', { fit: Fit; means: LatentMean[] }>;
  };
  cascade: { full: Step[]; half_a: Step[]; half_b: Step[] };
  alignment: { means: number[]; variances: number[]; r2: number[];   // R² of loadings, intercepts
    lambda_aligned: number[][]; nu_aligned: number[][]; lambda_config: number[][]; nu_config: number[][] };
  higher: {
    first: { fit: Fit; cor: number[][] };
    second: { fit: Fit; est: Est[]; r2: number[]; summary: string; disturbance: { factor: string; est: number; se: number; p: number }[] };
    nl: { fit: Fit; cor: number[][]; warning: string };
  };
  bifactor: { fit: Fit; correlated: Fit; cor: number[][]; general: { item: string; std: number }[]; specific: { factor: string; item: string; std: number }[]; omega_h: number; omega_total: number; lrt: Lrt; omega_h_raw: number };
  mtmm: { fits: Record<'traits' | 'ctcm' | 'cu', Fit>; trait_cor: Record<'traits' | 'ctcm' | 'cu', number[]>; ctcm_std: Est[]; r: number[][]; names: string[]; true_cor: number[];
    ctcm_true: { fit: Fit; trait_cor: number[]; method_cor: number[] } };
  probe: {
    base: Record<string, Fit>; fits: Record<'config' | 'metric' | 'scalar' | 'partial', Fit>;
    lrt: Record<'metric' | 'scalar' | 'partial', Lrt>;
    score: { item: string; op: string; X2: number }[]; released: string[];
    tau: { fit: Fit; lrt: Lrt };
    omega: Record<string, number[]>; means: { factor: string; group: string; std: number; p: number | null }[];
    compare_text: string;
  };
  cascade_final: { model: string; free: string[] };
  method_factor: { without: { fit: Fit; cor: number[][] }; with: { fit: Fit; cor: number[][]; loadings: number[] }; names: string[] };
}

let cache: Promise<Day5> | null = null;
export function useDay5() {
  const [d, setD] = useState<Day5 | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    cache ??= fetch(`${import.meta.env.BASE_URL}data/day5.json`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Day5>; });
    cache.then(setD).catch(e => setError((e as Error).message));
  }, []);
  return { d, error };
}

export const COUNTRY: Record<string, string> = { BE: 'Belgium', LU: 'Luxembourg', NL: 'the Netherlands' };
export const sgn = (v: number, d = 2) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d).replace(/^0\./, '.');
export const f2 = (v: number) => v.toFixed(2).replace(/^(-?)0\./, '$1.');
export const f3 = (v: number) => v.toFixed(3).replace(/^(-?)0\./, '$1.');
