// The course data: aggregated ESS statistics (public/data/course-data.json, written by
// scripts/course-data.R) and how to turn them into the groups the estimator works with.
import type { GroupStats } from '../math/sem.ts';

export interface VariableInfo { name: string; block: string; group: string; label: string; scale: string }
export interface Block { label: string; n: number; raw: number; means: number[]; cov: number[] }   // cov: lower triangle, column-major
export interface Sample { id: string; label: string; all: Block; groups: Record<'country' | 'gender' | 'age', Record<string, Block & { label: string }> | undefined> }
/** A round of data. Simulated rounds bring their own variables. */
export interface Round { id: string; label: string; samples: Sample[]; variables?: VariableInfo[]; simulated?: boolean; note?: string }
export interface CourseData { source: string; variables: VariableInfo[]; rounds: Round[] }

export type Grouping = 'none' | 'country' | 'gender' | 'age';
export const GROUPING_LABEL: Record<Grouping, string> = { none: 'one group', country: 'country', gender: 'gender', age: 'age group' };

/** Unpack a column-major lower triangle into a full symmetric matrix. */
export function unpack(tri: number[], k: number): number[][] {
  const M = Array.from({ length: k }, () => new Array(k).fill(0));
  let t = 0;
  for (let j = 0; j < k; j++) for (let i = j; i < k; i++) { M[i][j] = tri[t]; M[j][i] = tri[t]; t++; }
  return M;
}

export const variablesOf = (data: CourseData, round?: Round) => round?.variables ?? data.variables;

export function blockStats(data: CourseData, b: Block, label: string, round?: Round): GroupStats {
  const names = variablesOf(data, round).map(v => v.name);
  return { label, n: b.n, names, means: b.means, cov: unpack(b.cov, names.length) };
}

/** The groups for a sample and a grouping: one group, or one per country / gender / age group. */
export function groupsFor(data: CourseData, roundId: string, sampleId: string, grouping: Grouping): GroupStats[] {
  const round = data.rounds.find(r => r.id === roundId) ?? data.rounds[0];
  const sample = round.samples.find(s => s.id === sampleId) ?? round.samples[0];
  if (grouping === 'none') return [blockStats(data, sample.all, sample.label, round)];
  const g = sample.groups?.[grouping];
  if (!g) return [blockStats(data, sample.all, sample.label, round)];
  return Object.values(g).map(b => blockStats(data, b, b.label, round));
}

let cache: Promise<CourseData> | null = null;
export function loadCourseData(): Promise<CourseData> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/course-data.json`).then(r => {
    if (!r.ok) throw new Error(`course data: ${r.status}`);
    return r.json() as Promise<CourseData>;
  });
  return cache;
}
