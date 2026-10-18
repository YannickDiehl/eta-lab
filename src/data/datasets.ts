// ESS correlation matrices (aggregates only; built by scripts/reference.R).
import raw from './datasets.json' with { type: 'json' };

export interface Dataset { id: string; label: string; n: number; items: string[]; S: number[][]; means: number[]; sds: number[] }

export const DATASETS: Dataset[] = raw.datasets as Dataset[];
export const ITEM_TEXT: Record<string, string> = raw.labels as Record<string, string>;
export const SHORT: Record<string, string> = { imptrad: 'tradition', ipfrule: 'rules', ipbhprp: 'behave', ipmodst: 'modest' };
export const byId = (id: string) => DATASETS.find(d => d.id === id) ?? DATASETS[0];
