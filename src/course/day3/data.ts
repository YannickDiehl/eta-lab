// The R outputs of Day 3 (public/data/day3.json, written by scripts/day3-outputs.R with the
// η Lab pipeline): the restriction ladder for tradition/conformity and for universalism,
// reliability, identification by hand, and the simultaneous CFA of tradition/conformity,
// universalism and attitudes toward immigration (the Netherlands, ESS 2004).
import { useEffect, useState } from 'react';

export type Fit = Record<string, number>;
export interface Est { lhs: string; op: string; rhs: string; label: string; est: number; se: number; std: number }
export interface Lrt { dchisq: number; ddf: number; p: number }
export type Level = 'congeneric' | 'tau' | 'parallel' | 'strict';
export const LEVELS: Level[] = ['congeneric', 'tau', 'parallel', 'strict'];
export const LEVEL_NAME: Record<Level, string> = { congeneric: 'congeneric', tau: 'tau-equivalent', parallel: 'parallel', strict: 'strictly parallel' };
export interface Ladder {
  fits: Record<Level, Fit>; estimates: Record<Level, Est[]>;
  lrt: Record<'tau' | 'parallel' | 'strict', Lrt> & { adapted?: Lrt };
  compare_text: string;
}
export interface Day3 {
  source: string; n: number; item_means: Record<string, number>[];
  trco: Ladder & { tau_adapted: Fit; tau_adapted_est: Est[]; tau2_same: boolean; tau2_est: Est[]; strict_summary: string };
  univ: Ladder;
  reliability: Record<'trco' | 'univ', { omega_congeneric: number; alpha: number; omega_tau: number }>;
  omega_def: { est: number; se: number }[];
  by_hand: { r: number[][]; items: string[]; lambda: number[]; lavaan: number[] };
  univ_score: { par: string; with: string; X2: number; p: number }[];
  univ_strict_partial: Fit; univ_strict_partial_lrt: Lrt;
  vcov_max: Record<'trco' | 'scfa', { r: number; a: string; b: string }>;
  univ_plabels: { item: string; plabel: string }[]; univ_release: { item: string; chisq: number }[]; n_scfa: number;
  studio: { n: number; fit: Record<string, number>; mi: { lhs: string; op: string; rhs: string; mi: number }[] };
  scfa: {
    fit: Fit; estimates: Est[]; separate: Record<'trco' | 'univ' | 'allow', Fit>;
    resid: { a: string; b: string; z: number }[]; n_resid: number;
    factor_cor: { names: string[]; values: number[][] };
    summary: string; mi: { lhs: string; op: string; rhs: string; mi: number; epc: number; sepc: number }[]; mi_text: string;
    cross: { par: string; fit: Fit; est: Est[]; lrt: Lrt }; cov: { par: string; fit: Fit; lrt: Lrt }; compare_text: string;
  };
}

let cache: Promise<Day3> | null = null;
export function useDay3() {
  const [d, setD] = useState<Day3 | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    cache ??= fetch(`${import.meta.env.BASE_URL}data/day3.json`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Day3>; });
    cache.then(setD).catch(e => setError((e as Error).message));
  }, []);
  return { d, error };
}

export const TRCO_ITEMS = ['ipmodst', 'imptrad', 'ipfrule', 'ipbhprp'];
export const UNIV_ITEMS = ['ipeqopt', 'ipudrst', 'impenv'];
export const ALLOW_ITEMS = ['imsmetn', 'imdfetn', 'impcntr'];
export const pick = (e: Est[], op: string, lhs: string, rhs: string) => e.find(x => x.op === op && x.lhs === lhs && x.rhs === rhs);
export const sgn = (v: number, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d).replace(/^0\./, '.');
