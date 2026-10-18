// The R outputs of Day 4 (public/data/day4.json, written by scripts/day4-outputs.R with the
// η Lab pipeline): tradition/conformity across Belgium, Luxembourg and the Netherlands —
// baseline models per country, configural, metric, scalar and partial scalar models, score
// tests, latent means, and the universalism/benevolence ladder for the homework.
import { useEffect, useState } from 'react';

export type Fit = Record<string, number>;
export interface GEst { lhs: string; op: string; rhs: string; group: number; est: number; se: number; z: number | null; pvalue: number | null; std: number }
export interface Score { lhs: string; rhs: string; X2: number; p: number; kind: 'loading' | 'intercept'; item: string; g1: string; g2: string }
export interface Mean { group: string; est?: number; se?: number; pvalue?: number | null; std: number; std_se: number }
export type ModelKey = 'config' | 'metric' | 'scalar' | 'partial' | 'partial2' | 'partial3';
export interface Day4 {
  source: string; groups: string[]; items: string[]; model: string; n: number; n_group: number[];
  desc: { group: string; n: number; items: { item: string; counts: number[]; missing: number; mean: number; sd: number }[] }[];
  baseline: { group: string; n: number; fit: Fit; estimates: GEst[] }[]; baseline_summary: string;
  fits: Record<ModelKey, Fit>; estimates: Record<ModelKey, GEst[]>;
  lrt: Record<'metric' | 'scalar' | 'partial' | 'partial2' | 'partial3', { dchisq: number; ddf: number; p: number }>;
  compare_text: string; compare_partial_text: string; compare_partial3_text: string;
  config_summary: string; scalar_summary: string;
  score_scalar: Score[]; score_partial: Score[]; score_text: string; partable_text: string;
  means: Record<'scalar' | 'partial' | 'partial2' | 'partial3', Mean[]>;
  unbe: { fits: Record<'config' | 'metric' | 'scalar' | 'partial' | 'partial2', Fit>; score: Score[]; score2: Score[]; freed: string[]; means: Record<'scalar' | 'partial' | 'partial2', Mean[]> };
  score_total: number; score_partial_text: string; effect_means: { group: string; est: number; se: number }[];
}

let cache: Promise<Day4> | null = null;
export function useDay4() {
  const [d, setD] = useState<Day4 | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    cache ??= fetch(`${import.meta.env.BASE_URL}data/day4.json`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Day4>; });
    cache.then(setD).catch(e => setError((e as Error).message));
  }, []);
  return { d, error };
}

export const COUNTRY: Record<string, string> = { BE: 'Belgium', LU: 'Luxembourg', NL: 'the Netherlands' };
export const GROUP_COLOR = ['var(--g1)', 'var(--g2)', 'var(--g3)'];
export const pe = (e: GEst[], op: string, lhs: string, rhs: string, group: number) => e.find(x => x.op === op && x.lhs === lhs && x.rhs === rhs && x.group === group);
export const loadingOf = (e: GEst[], item: string, g: number) => pe(e, '=~', 'TRCO', item, g)!;
export const interceptOf = (e: GEst[], item: string, g: number) => pe(e, '~1', item, '', g)!;
export const meanOf = (e: GEst[], g: number) => pe(e, '~1', 'TRCO', '', g)?.est ?? 0;
/** The partial model for a set of released intercepts. */
export const partialKey = (rules: boolean, modest: boolean): 'scalar' | 'partial' | 'partial2' | 'partial3' =>
  rules && modest ? 'partial3' : rules ? 'partial' : modest ? 'partial2' : 'scalar';
export const sgn = (v: number, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d).replace(/^0\./, '.');
