// The R outputs of Day 1 (public/data/day1.json, written by scripts/day1-outputs.R with the
// course's own pipeline: sjlabelled/sjmisc, easystats, MVN, lavaan with MLR and FIML).
import { useEffect, useState } from 'react';

export interface Frq { item: string; label: string; counts: number[]; missing: number }
export interface Describe { Variable: string; Mean: number; SD: number; IQR: number; Min: number; Max: number; Skewness: number; Kurtosis: number; n: number; n_Missing: number }
export interface Cor { Parameter1: string; Parameter2: string; r: number; CI_low: number; CI_high: number; p: number; n_Obs: number }
export interface ItemScale { Item: string; Missings: number; Mean: number; SD: number; Skewness: number; Difficulty: number; Discrimination: number; 'alpha if deleted': number }
export interface Est { lhs: string; op: string; rhs: string; est: number; se: number; z: number | null; pvalue: number | null; std: number }
export interface MI { lhs: string; op: string; rhs: string; mi: number; epc: number; sepc: number }

export interface ItemSet {
  factor: string; items: string[]; n: number; model: string;
  frq: Frq[]; describe: Describe[]; mvn: string; correlation: Cor[];
  itemscale: ItemScale[]; itemscale_text: string; itemscale_alpha: number | null;
  summary: string; fit: Record<string, number>; estimates: Est[]; mi: MI[];
  residuals: number[][]; resid_names: string[];
  means: { lhs: string; est: number; se: number }[]; mean_summary: string;
  item_means: Record<string, number>;
}
export interface Day1 { source: string; versions: Record<string, string>; trco: ItemSet; univ: ItemSet }

let cache: Promise<Day1> | null = null;
export function useDay1() {
  const [d, setD] = useState<Day1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    cache ??= fetch(`${import.meta.env.BASE_URL}data/day1.json`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Day1>; });
    cache.then(setD).catch(e => setError((e as Error).message));
  }, []);
  return { d, error };
}

export const loading = (s: ItemSet) => s.estimates.filter(e => e.op === '=~');
export const residualVar = (s: ItemSet, item: string) => s.estimates.find(e => e.op === '~~' && e.lhs === item && e.rhs === item);
export const factorVar = (s: ItemSet) => s.estimates.find(e => e.op === '~~' && e.lhs === s.factor && e.rhs === s.factor);
export const f2 = (v: number) => v.toFixed(2).replace(/^(-?)0\./, '$1.');
export const f3 = (v: number) => v.toFixed(3).replace(/^(-?)0\./, '$1.');
