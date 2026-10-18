// Estimation off the main thread, so the sheet stays smooth while the numbers update.
//   fit    the model at its rung (and, with groups, every rung of the ladder)
//   probe  partial invariance: refit with each single equality of a kind released
import { fitModel, type GroupStats } from '../math/sem.ts';
import type { Diagram } from '../model/diagram.ts';
import { EQUAL, LEVELS, locks, type Kind, type Level } from '../model/invariance.ts';
import { structure } from '../model/diagram.ts';

export interface EstimateJob { type: 'fit'; id: number; d: Diagram; groups: GroupStats[]; level: Level; free: string[]; ladder: boolean }
export interface ProbeJob { type: 'probe'; id: number; d: Diagram; groups: GroupStats[]; level: Level; free: string[]; kind: Kind }
export interface ProbeRow { key: string; partial: string; chisq: number; cfi: number }
export interface CompareJob { type: 'compare'; id: number; models: { id: string; d: Diagram }[]; groups: GroupStats[]; level: Level; free: string[] }
export interface CompareRow { id: string; ok: boolean; error?: string; chisq?: number; df?: number; cfi?: number; rmsea?: number; aic?: number; bic?: number; vars?: string[] }

self.onmessage = (e: MessageEvent<EstimateJob | ProbeJob | CompareJob>) => {
  const job = e.data;
  const t0 = performance.now();
  if (job.type === 'compare') {
    const rows: CompareRow[] = job.models.map(m => {
      const r = fitModel(m.d, { groups: job.groups, level: job.level, free: job.free });
      if (!r.ok) return { id: m.id, ok: false, error: r.error };
      return { id: m.id, ok: true, chisq: r.chisq, df: r.df, cfi: r.cfi, rmsea: r.rmsea, aic: r.aic, bic: r.bic, vars: structure(m.d).observed.map(v => r.names.get(v)!).sort() };
    });
    self.postMessage({ type: 'compare', id: job.id, rows });
    return;
  }
  if (job.type === 'probe') {
    const candidates = locks(structure(job.d)).filter(l => l.kind === job.kind && EQUAL[job.level].includes(l.kind) && !job.free.includes(l.key));
    const rows: ProbeRow[] = [];
    for (const l of candidates) {
      const r = fitModel(job.d, { groups: job.groups, level: job.level, free: [...job.free, l.key] });
      if (r.ok) rows.push({ key: l.key, partial: l.partial, chisq: r.chisq, cfi: r.cfi });
    }
    self.postMessage({ type: 'probe', id: job.id, rows, ms: performance.now() - t0 });
    return;
  }
  const { id, d, groups, level, free, ladder } = job;
  const main = fitModel(d, { groups, level, free });
  // with several groups: every rung of the ladder, for the comparison table
  const rungs = ladder && groups.length > 1 && main.ok
    ? LEVELS.map(l => (l === level ? main : fitModel(d, { groups, level: l, free })))
    : null;
  self.postMessage({ type: 'fit', id, main, rungs, ms: performance.now() - t0 });
};
