// Two workspaces, stored only in this browser (localStorage):
//   project   "Your model" — the learner's own research model, carried through every station
//   practice  the exercise of the day — example models and tasks load here, never into the project
// plus the answers to the daily project steps.
import { useCallback, useEffect, useState } from 'react';
import { ML, tidy, uid, type Diagram, type DEdge, type DNode, type ROptions } from './model/diagram.ts';
import { NO_GROUPS, type Groups } from './model/invariance.ts';
import type { Grouping } from './data/course.ts';

/** Which data the studio estimates the model on. Own files stay in memory only (see studio/owndata.ts). */
export type DataChoice =
  | { source: 'course'; round: string; sample: string; grouping: Grouping }
  | { source: 'own'; name: string; grouping: string | null };

/** A model kept for comparison (Results → Compare models). */
export interface Snapshot { id: string; name: string; diagram: Diagram }

/** A task in progress (studio/tasks.ts): the answers given so far, by step. */
export interface TaskState { id: string; answers: Record<string, string> }

/** r: how the R code estimates (the studio itself always uses ML on complete cases).
 *  base: the example model as loaded — changes against it need a reason (the logbook).
 *  reasons: why a change was made, by change key (see studio/logbook.ts). */
export interface YourModel {
  question: string; n: number; diagram: Diagram; groups: Groups; data: DataChoice | null; snapshots: Snapshot[]; r: ROptions;
  base?: Diagram; reasons: Record<string, string>; task?: TaskState;
}
export type Track = 'project' | 'practice';
/** Answers to the daily project steps, by step id (course/days.ts). */
export type ProjectSteps = Record<string, Record<string, string>>;

const KEY = 'eta-lab.course.v3';
const V2 = 'eta-lab.your-model.v2';
const OLD = 'eta-lab.your-model.v1';
export const EMPTY: YourModel = { question: '', n: 1000, diagram: { nodes: [], edges: [] }, groups: NO_GROUPS, data: null, snapshots: [], r: ML, reasons: {} };

/** Turn the earlier form (construct, items, outcome) into a drawn model. */
function migrate(old: { question?: string; construct?: string; items?: string[]; outcome?: string; n?: number }): YourModel {
  const nodes: DNode[] = [], edges: DEdge[] = [];
  const items = (old.items ?? []).map(s => s.trim()).filter(Boolean);
  if (old.construct?.trim() || items.length) {
    const f: DNode = { id: uid('n'), kind: 'latent', label: old.construct?.trim() || 'Construct', x: 0, y: 0 };
    nodes.push(f);
    items.forEach(l => { const it: DNode = { id: uid('n'), kind: 'observed', label: l, x: 0, y: 0 }; nodes.push(it); edges.push({ id: uid('e'), kind: 'loading', from: f.id, to: it.id }); });
    if (old.outcome?.trim()) {
      const o: DNode = { id: uid('n'), kind: 'latent', label: old.outcome.trim(), x: 0, y: 0 };
      nodes.push(o); edges.push({ id: uid('e'), kind: 'path', from: f.id, to: o.id });
    }
  }
  return { ...EMPTY, question: old.question ?? '', n: old.n ?? 1000, diagram: tidy({ nodes, edges }) };
}

/** Repair a stored workspace: a damaged or hand-edited record must not take the app down. */
function clean(parsed: Partial<YourModel> | null | undefined): YourModel {
  if (!parsed || typeof parsed !== 'object') return EMPTY;
  const m: YourModel = { ...EMPTY, ...parsed, groups: { ...NO_GROUPS, ...(parsed.groups ?? {}) }, r: { ...ML, ...(parsed.r ?? {}) } };
  if (!Array.isArray(m.groups.names) || !Array.isArray(m.groups.free)) m.groups = NO_GROUPS;
  if (!Array.isArray(m.snapshots)) m.snapshots = [];
  if (!m.reasons || typeof m.reasons !== 'object') m.reasons = {};
  const ok = (d?: Diagram) => !!d && Array.isArray(d.nodes) && Array.isArray(d.edges);
  if (!ok(m.diagram)) m.diagram = EMPTY.diagram;
  if (m.base && !ok(m.base)) delete m.base;
  return m;
}

interface Stored { project: YourModel; practice: YourModel; track: Track; steps: ProjectSteps }
function load(): Stored {
  const fresh: Stored = { project: EMPTY, practice: EMPTY, track: 'project', steps: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { project: clean(p.project), practice: clean(p.practice), track: p.track === 'practice' ? 'practice' : 'project', steps: p.steps && typeof p.steps === 'object' ? p.steps : {} };
    }
    // earlier versions held one model: it becomes the project
    const v2 = localStorage.getItem(V2);
    if (v2) return { ...fresh, project: clean(JSON.parse(v2)) };
    const old = localStorage.getItem(OLD);
    return old ? { ...fresh, project: migrate(JSON.parse(old)) } : fresh;
  } catch {
    return fresh;
  }
}

export function useYourModel() {
  const [st, setSt] = useState<Stored>(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* storage unavailable: keep in memory */ }
  }, [st]);
  const update = useCallback((patch: Partial<YourModel>) => setSt(s => ({ ...s, project: { ...s.project, ...patch } })), []);
  const updatePractice = useCallback((patch: Partial<YourModel>) => setSt(s => ({ ...s, practice: { ...s.practice, ...patch } })), []);
  const setTrack = useCallback((track: Track) => setSt(s => ({ ...s, track })), []);
  const setStep = useCallback((id: string, answers: Record<string, string>) => setSt(s => ({ ...s, steps: { ...s.steps, [id]: { ...(s.steps[id] ?? {}), ...answers } } })), []);
  return { model: st.project, update, practice: st.practice, updatePractice, track: st.track, setTrack, steps: st.steps, setStep };
}

/** The learner's main construct: the first latent variable that has items. */
function primary(m: YourModel) {
  const d = m.diagram;
  const lat = d.nodes.filter(n => n.kind === 'latent');
  return lat.find(l => d.edges.some(e => e.kind === 'loading' && e.from === l.id)) ?? lat[0];
}
export const namedItems = (m: YourModel) => {
  const p = primary(m);
  if (!p) return [];
  const byId = new Map(m.diagram.nodes.map(n => [n.id, n]));
  return m.diagram.edges.filter(e => e.kind === 'loading' && e.from === p.id).map(e => byId.get(e.to)?.label || 'item');
};
export const constructName = (m: YourModel) => primary(m)?.label.trim() || 'your construct';
export const outcomeName = (m: YourModel) => {
  const p = primary(m);
  if (!p) return '';
  const e = m.diagram.edges.find(x => x.kind === 'path' && x.from === p.id);
  return e ? m.diagram.nodes.find(n => n.id === e.to)?.label ?? '' : '';
};

// The practice workspace holds one model at a time. Before a task or example model replaces it,
// the current one is kept in a slot per task (or "free"), so going back to a task resumes it.
const SLOTS = 'eta-lab.practice-slots.v1';
export function stashPractice(m: YourModel) {
  if (!m.diagram.nodes.length) return;
  try {
    const all = JSON.parse(localStorage.getItem(SLOTS) ?? '{}');
    all[m.task?.id ?? 'free'] = m;
    localStorage.setItem(SLOTS, JSON.stringify(all));
  } catch { /* storage unavailable: nothing kept */ }
}
export function stashedPractice(key: string): YourModel | null {
  try {
    const m = JSON.parse(localStorage.getItem(SLOTS) ?? '{}')[key];
    return m ? clean(m) : null;
  } catch { return null; }
}
export function dropStash(key: string) {
  try {
    const all = JSON.parse(localStorage.getItem(SLOTS) ?? '{}');
    delete all[key];
    localStorage.setItem(SLOTS, JSON.stringify(all));
  } catch { /* ignore */ }
}

// Which stations have been "played" (for the progress dots).
const DONE = 'eta-lab.done.v1';
export function markDone(id: string) {
  try {
    const s = new Set<string>(JSON.parse(localStorage.getItem(DONE) ?? '[]'));
    s.add(id);
    localStorage.setItem(DONE, JSON.stringify([...s]));
    window.dispatchEvent(new Event('eta-done'));
  } catch { /* ignore */ }
}
export function doneSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DONE) ?? '[]')); } catch { return new Set(); }
}
