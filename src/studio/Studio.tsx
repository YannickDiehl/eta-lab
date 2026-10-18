// "Your model" as a studio: the sheet fills the screen, η and the lavaan code live beside it
// and change while you build. Stations stay one click away.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eta, type Mood } from '../eta/Eta.tsx';
import { analyse, example, fromLavaan, ML, modelString, toLavaan, uid, type Diagram, type Note } from '../model/diagram.ts';
import { ladder, ladderSyntax, LEVELS, NO_GROUPS, type Groups, type Level } from '../model/invariance.ts';
import { GroupsPanel } from '../model/GroupsPanel.tsx';
import { dropStash, EMPTY, stashedPractice, stashPractice, type DataChoice, type ProjectSteps, type Track, type YourModel } from '../state.ts';
import { groupsFor, loadCourseData, type CourseData } from '../data/course.ts';
import { fitModel, type Fitted, type GroupStats } from '../math/sem.ts';
import { Canvas, fmtNum, type CanvasHandle, type EstView } from './Canvas.tsx';
import { DataPanel } from './DataPanel.tsx';
import { ResultsPanel, type Estimation } from './ResultsPanel.tsx';
import { CompareModels, describeMI, EffectsTable, LatentMeans, ResidualMatrix, StrainList } from './Diagnostics.tsx';
import type { ModIndex } from '../math/sem.ts';
import { onOwnData, ownData, ownGroups } from './owndata.ts';
import { TEMPLATES, templateDiagram, type Template } from './templates.ts';
import { ROptionsBar } from './ROptionsBar.tsx';
import { quartoReport } from './report.ts';
import { fitVerdict } from '../math/cutoffs.ts';
import { changes as listChanges, edgeKey, logComments, releases } from './logbook.ts';
import { taskById, TASKS, type TaskContext } from './tasks.ts';
import { KINDS } from '../course/day1/project.tsx';
import { USES } from '../course/day3.tsx';
import { COMPARE } from '../course/day4.tsx';
import { PLANS } from '../course/day5.tsx';
import { Logbook, TaskCard } from './TaskCard.tsx';
import { decodeModel, encodeModel, linkCode, modelFile, shareLink, validShared, type Shared } from './share.ts';
import type { CompareRow, ProbeRow } from './estimate.worker.ts';

type Tab = 'eta' | 'data' | 'results' | 'code' | 'groups';
const GROUP_VAR = { country: 'cntry', gender: 'gndr', age: 'agegroup' } as const;
const MOOD: Record<string, Mood> = { empty: 'curious', under: 'worried', just: 'thinking', over: 'pleased' };

/** Lines that are new since the last render light up briefly. */
function useFresh(lines: string[]) {
  const prev = useRef<string[]>(lines), stamp = useRef(0);
  const fresh = useMemo(() => {
    const before = new Set(prev.current);
    stamp.current++;
    return new Set(lines.map((l, i) => (l.trim() && !before.has(l) ? i : -1)).filter(i => i >= 0));
  }, [lines.join('\n')]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { prev.current = lines; });
  return { fresh, stamp: stamp.current };
}

interface StudioProps {
  project: YourModel; practice: YourModel;
  updateProject: (p: Partial<YourModel>) => void; updatePractice: (p: Partial<YourModel>) => void;
  track: Track; setTrack: (t: Track) => void; back: string;
  steps?: ProjectSteps;
}

/** An example model in the practice workspace: its original version is kept as the base for the logbook. */
function practiceFrom(diagram: Diagram, patch: Partial<YourModel> = {}): YourModel {
  // every field is set, so nothing of the previous exercise (a task, its answers) survives the merge
  return { ...EMPTY, task: undefined, diagram, base: diagram, ...patch };
}

export function Studio({ project, practice, updateProject, updatePractice, track, setTrack, back, steps }: StudioProps) {
  const model = track === 'project' ? project : practice;
  const update = track === 'project' ? updateProject : updatePractice;
  const d = model.diagram, g = model.groups, G = g.names.length, ropts = model.r ?? ML;
  const a = useMemo(() => analyse(d), [d]);
  const lad = useMemo(() => ladder(d, G, g.free, g.level), [d, G, g.free, g.level]);
  const ready = a.s.latent.length > 0 && !a.blocked;
  const grouped = g.on && ready;
  const [tab, setTab] = useState<Tab>('eta');
  const [open, setOpen] = useState(() => window.innerWidth >= 980);
  const [showDefaults, setShowDefaults] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [paste, setPaste] = useState('');
  const [report, setReport] = useState<{ skipped: string[]; modifiers: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const canvas = useRef<CanvasHandle | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedFactor = selected.length === 1 ? d.nodes.find(n => n.id === selected[0] && n.kind === 'latent')?.label ?? null : null;

  // ---- data: the ESS data (loaded when needed) or the learner's own file (memory only)
  const choice = model.data;
  const [course, setCourse] = useState<CourseData | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [own, setOwn] = useState(ownData);
  useEffect(() => onOwnData(() => setOwn(ownData())), []);
  const wantCourse = choice?.source === 'course' || tab === 'data';
  useEffect(() => {
    if (!wantCourse || course) return;
    loadCourseData().then(setCourse).catch(e => setCourseError(`The ESS data could not be loaded (${(e as Error).message}).`));
  }, [wantCourse, course]);
  const stats: GroupStats[] | null = useMemo(() => {
    if (!choice) return null;
    if (choice.source === 'course') return course ? groupsFor(course, choice.round, choice.sample, choice.grouping) : null;
    if (!own) return null;
    const names = a.s.observed.map(id => a.s.names.get(id)!).filter(nm => own.columns.includes(nm));
    return ownGroups(own, names, choice.grouping);
  }, [choice, course, own, a]);
  const setChoice = (c: DataChoice | null, base: Groups = g, upd: (p: Partial<YourModel>) => void = update) => {
    let groups = base;
    if (c?.source === 'course' && course) {
      groups = c.grouping === 'none' ? { ...base, on: false }
        : { ...base, on: true, variable: GROUP_VAR[c.grouping], names: groupsFor(course, c.round, c.sample, c.grouping).map(x => x.label) };
    }
    if (c?.source === 'own' && own) groups = c.grouping ? { ...base, on: true, variable: c.grouping, names: ownGroups(own, [], c.grouping).map(x => x.label.replace(/^.* = /, '')) } : { ...base, on: false };
    upd({ data: c, groups });
  };

  // ---- estimation in a worker, whenever the model (not just its layout) or the data change
  const [est, setEst] = useState<Estimation | null>(null);
  const [estGroup, setEstGroup] = useState(0);
  const [std, setStd] = useState(true);
  const [showEst, setShowEst] = useState(true);
  const worker = useRef<Worker | null>(null), job = useRef(0), probeJob = useRef(0), probeLevel = useRef<Level>('scalar');
  const [probe, setProbe] = useState<{ rows: ProbeRow[] | null; level: Level } | null>(null);
  const compareJob = useRef(0);
  const [compare, setCompare] = useState<CompareRow[] | null>(null);
  useEffect(() => {
    const w = new Worker(new URL('./estimate.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<(Estimation & { type: 'fit'; id: number }) | { type: 'probe'; id: number; rows: ProbeRow[] } | { type: 'compare'; id: number; rows: CompareRow[] }>) => {
      const m = e.data;
      if (m.type === 'probe') { if (m.id === probeJob.current) setProbe({ rows: m.rows, level: probeLevel.current }); return; }
      if (m.type === 'compare') { if (m.id === compareJob.current) setCompare(m.rows); return; }
      if (m.id === job.current) setEst(m);
    };
    worker.current = w;
    return () => w.terminate();
  }, []);
  const modelKey = JSON.stringify([d.nodes.map(n => [n.id, n.kind, n.label]), d.edges.map(e => [e.kind, e.from, e.to])]);
  const estLevel = stats && stats.length > 1 ? g.level : 'configural';
  useEffect(() => {
    if (!stats || !a.s.observed.length || a.blocked) { job.current++; setEst(null); return; }
    const id = ++job.current;
    setProbe(null);
    const timer = setTimeout(() => worker.current?.postMessage({ type: 'fit', id, d, groups: stats, level: estLevel, free: g.free, ladder: stats.length > 1 }), 200);
    return () => clearTimeout(timer);
  }, [modelKey, stats, estLevel, g.free.join('|')]);   // eslint-disable-line react-hooks/exhaustive-deps
  /** Partial invariance: which single equality of this rung costs the most fit? */
  const runProbe = () => {
    if (!stats || stats.length < 2) return;
    const kind = ({ configural: null, metric: 'loading', scalar: 'intercept', strict: 'residual' } as const)[g.level];
    if (!kind) return;
    const id = ++probeJob.current;
    probeLevel.current = g.level;
    setProbe({ rows: null, level: g.level });
    worker.current?.postMessage({ type: 'probe', id, d, groups: stats, level: g.level, free: g.free, kind });
  };
  // ---- models kept for comparison: refit on the current data whenever data or snapshots change
  const snapshots = model.snapshots;
  const snapKey = snapshots.map(x => x.id).join('|');
  useEffect(() => {
    if (!stats || !snapshots.length) { setCompare(null); return; }
    const id = ++compareJob.current;
    const timer = setTimeout(() => worker.current?.postMessage({ type: 'compare', id, models: snapshots.map(x => ({ id: x.id, d: x.diagram })), groups: stats, level: estLevel, free: g.free }), 300);
    return () => clearTimeout(timer);
  }, [snapKey, stats, estLevel, g.free.join('|')]);   // eslint-disable-line react-hooks/exhaustive-deps
  const keepModel = () => update({ snapshots: [...snapshots, { id: uid('s'), name: `Model ${String.fromCharCode(65 + snapshots.length)}`, diagram: d }] });
  /** Add (or free) the parameter a modification index points to. */
  const addFromMI = (q: ModIndex, reason: string) => {
    const desc = describeMI(q, d);
    if (desc.edge) {
      update({ diagram: { ...d, edges: d.edges.map(e => (e.id === desc.edge!.id ? (({ fix: _f, ...rest }) => rest)(e) : e)) }, reasons: { ...model.reasons, [edgeKey(d, desc.edge)]: reason } });
      return;
    }
    const edge = q.op === '=~' ? { id: uid('e'), kind: 'loading' as const, from: q.lhs, to: q.rhs }
      : q.op === '~' ? { id: uid('e'), kind: 'path' as const, from: q.rhs, to: q.lhs }
        : { id: uid('e'), kind: 'cov' as const, from: q.lhs, to: q.rhs };
    update({ diagram: { ...d, edges: [...d.edges, edge] }, reasons: { ...model.reasons, [edgeKey(d, edge)]: reason } });
  };
  // ---- the logbook: changes against the example model (or added from an index), each with a reason
  const reasons = model.reasons ?? {};
  const released = useMemo(() => (g.on ? releases(d, lad.locks, g.free) : []), [d, lad.locks, g.free, g.on]);
  const log = useMemo(() => listChanges(d, model.base, reasons, released), [d, model.base, reasons, released]);
  const setReason = (key: string, text: string) => update({ reasons: { ...reasons, [key]: text } });

  // ---- tasks: the day's exercise, in the practice workspace
  const task = track === 'practice' ? taskById(model.task?.id) : null;
  // the hash listener below is set up once: it reads the current practice through a ref
  const practiceRef = useRef(practice);
  practiceRef.current = practice;
  const freshTask = (id: string) => {
    const t = taskById(id);
    if (!t) return;
    const dg = fromLavaan(t.syntax).diagram;
    updatePractice(practiceFrom(dg, { question: t.question, groups: t.groups ? { ...t.groups, free: [] } : { ...NO_GROUPS, on: false }, data: t.data, task: { id, answers: {} } }));
    setTimeout(() => canvas.current?.fit(), 80);
  };
  const startTask = (id: string) => {
    if (!taskById(id)) return;
    setTrack('practice');
    const cur = practiceRef.current;
    if (cur.task?.id === id) return;                         // resume, never wipe a task in progress
    stashPractice(cur);                                       // keep what was on the sheet
    const saved = stashedPractice(id);
    if (saved) { updatePractice(saved); setTimeout(() => canvas.current?.fit(), 80); return; }
    freshTask(id);
  };
  useEffect(() => {
    const take = () => {
      const m = /[?&]task=([\w-]+)/.exec(window.location.hash);
      if (!m) return;
      history.replaceState(null, '', '#/model');
      startTask(m[1]);
    };
    take();
    window.addEventListener('hashchange', take);
    return () => window.removeEventListener('hashchange', take);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  /** An example model opens in the practice workspace: the project stays untouched. */
  const loadTemplate = (tm: Template, data: CourseData | null = course) => {
    const base = { ...practice.groups, free: [] };
    stashPractice(practice);                                  // a task in progress waits in its slot
    const dg = templateDiagram(tm);
    updatePractice(practiceFrom(dg, { groups: base, question: tm.title, r: practice.r ?? ML }));
    setTrack('practice');
    // the data the template belongs to: its own round, or back to the ESS when leaving simulated data
    const prev = practice.data?.source === 'course' ? practice.data : null;
    const cur = prev ?? { source: 'course' as const, round: 'ess2004', sample: 'pooled', grouping: 'none' as const };
    const curSim = !!data?.rounds.find(r => r.id === cur.round)?.simulated;
    const round = tm.round ?? (curSim ? 'ess2004' : cur.round);
    const grouping = tm.grouping ?? 'none';
    const sample = tm.sample ?? (round !== cur.round || grouping === 'country' ? 'pooled' : cur.sample);
    const c = { source: 'course' as const, round, sample, grouping };
    const groups = grouping === 'none' || !data ? { ...base, on: false }
      : { ...base, on: true, variable: GROUP_VAR[grouping], names: groupsFor(data, round, sample, grouping).map(x => x.label) };
    updatePractice({ data: c, groups });
    setTimeout(() => canvas.current?.fit(), 80);
  };
  // #/model?template=<title>: an example model from a day page
  useEffect(() => {
    const take = () => {
      const m = /[?&]template=([^&]+)/.exec(window.location.hash);
      if (!m) return;
      history.replaceState(null, '', '#/model');
      const tm = TEMPLATES.find(t => t.title === decodeURIComponent(m[1]));
      if (tm) loadCourseData().then(data => { setCourse(c => c ?? data); loadTemplate(tm, data); }).catch(() => loadTemplate(tm, null));
    };
    take();
    window.addEventListener('hashchange', take);
    return () => window.removeEventListener('hashchange', take);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const setAnswer = (step: string, value: string) => update({ task: { id: model.task!.id, answers: { ...(model.task?.answers ?? {}), [step]: value } } });
  // the example model's own fit, for the task's comparisons (small models: fine on the main thread)
  const baseFit = useMemo(() => {
    if (!task || !model.base || !stats) return null;
    const r = fitModel(model.base, { groups: stats });
    return r.ok ? r : null;
  }, [task, model.base, stats]);
  // a task may try other releases than the ones on the sheet: small refits, cached per model and data
  const statsId = useMemo(() => Math.random(), [stats]);
  const refitCache = useRef(new Map<string, Fitted | null>());
  const refit = (level: Level, free: string[], stdlv = false): Fitted | null => {
    if (!stats || stats.length < 2) return null;
    const key = JSON.stringify([modelKey, statsId, level, [...free].sort(), stdlv]);
    if (!refitCache.current.has(key)) {
      if (refitCache.current.size > 200) refitCache.current.clear();
      const r = fitModel(stdlv ? { ...d, stdlv: true } : d, { groups: stats, level, free });
      refitCache.current.set(key, r.ok ? r : null);
    }
    return refitCache.current.get(key) ?? null;
  };
  const labelOf = (name: string) => {
    const round = choice?.source === 'course' ? course?.rounds.find(x => x.id === choice.round) : undefined;
    return (round?.variables ?? course?.variables)?.find(v => v.name === name)?.label ?? name;
  };
  const fitted = est?.main.ok ? est.main : null;
  const gi = fitted ? Math.min(estGroup, fitted.G - 1) : 0;
  const estView: EstView | undefined = useMemo(() => {
    if (!showEst || !fitted) return undefined;
    const byEdge: EstView['byEdge'] = new Map();
    const edgeOf = new Map(d.edges.map(e => [e.id, e]));
    fitted.params.filter(q => q.group === gi && q.edge).forEach(q => {
      const e = edgeOf.get(q.edge!);
      // a label or a fixed value shows in front of the number: "a .52", "=1 .72"
      const pre = [e?.label, e?.fix !== undefined ? `=${e.fix}` : ''].filter(Boolean).join(' ');
      byEdge.set(q.edge!, { text: `${pre ? pre + ' ' : ''}${fmtNum(std ? q.std : q.est, std)}`, weak: q.free && q.p >= .05, equal: q.equal || !!e?.label, fixed: !q.free });
    });
    return { byEdge, r2: fitted.r2[gi] ?? {} };
  }, [fitted, gi, std, showEst, d]);
  // η's remarks from the estimation, pinned to the shapes they concern
  const estNotes: Note[] = [];
  if (est && !est.main.ok && est.main.missing) est.main.missing.forEach(nm => {
    const node = d.nodes.find(n => a.s.names.get(n.id) === nm);
    estNotes.push({ level: 'warn', node: node?.id, text: `“${nm}” is not a variable in the data. Rename the box to a column of the data, or drag a variable in from the Data tab.` });
  });
  fitted?.heywood.forEach(id => estNotes.push({ level: 'warn', node: id, text: `${d.nodes.find(n => n.id === id)?.label ?? 'A variable'} gets a negative variance (a Heywood case). The model asks the data for more than they hold — often too few items or a factor that is not needed.` }));
  const notes = [...estNotes, ...a.notes];

  // the studio owns the whole window
  useEffect(() => {
    document.body.classList.add('studio-open');
    return () => document.body.classList.remove('studio-open');
  }, []);

  const rawSyntax = grouped ? `${modelString(d)}\n\n${ladderSyntax(d, g, ropts)}` : toLavaan(d, { r: ropts });
  // the reasons stand right under the model, where a reader of the code looks for them
  const comments = logComments(log, reasons);
  const syntax = comments ? rawSyntax.replace(/^(model <- "[\s\S]*?\n")/, `$1\n\n${comments}`) : rawSyntax;
  const lines = syntax.split('\n');
  const { fresh, stamp } = useFresh(lines);
  const setGroups = (next: Groups) => update({ groups: next });
  const toggleLock = (key: string) => setGroups({ ...g, free: g.free.includes(key) ? g.free.filter(k => k !== key) : [...g.free, key] });
  const show = (t: Tab) => { setTab(t); setOpen(true); };
  const mood: Mood = notes.some(n => n.level === 'warn') && a.status !== 'empty' ? 'worried' : MOOD[a.status];
  const rung = lad.rungs[LEVELS.indexOf(g.level)];

  const draw = () => {
    const r = fromLavaan(paste);
    if (!r.diagram.nodes.length) { setReport({ skipped: r.skipped.length ? r.skipped : ['nothing I could read — use =~, ~ and ~~'], modifiers: [] }); return; }
    update({ diagram: r.diagram }); setReport({ skipped: r.skipped, modifiers: r.modifiers }); setImporting(false); setPaste('');
  };
  const copy = async () => { try { await navigator.clipboard.writeText(syntax); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } };
  const download = () => {
    const header = `# ${model.question || 'My SEM'}\n# drawn in η Lab — replace my_data with your data frame\nlibrary(lavaan)\n\n`;
    const url = URL.createObjectURL(new Blob([header + syntax + '\n'], { type: 'text/plain' })), link = document.createElement('a');
    link.href = url; link.download = 'my-model.R'; link.click(); URL.revokeObjectURL(url);
  };
  // ---- sharing: the model as a link or a file; opening one keeps the previous model one click away
  const [linked, setLinked] = useState(false);
  const [opened, setOpened] = useState<{ from: 'link' | 'file' | 'bad'; before: Shared | null } | null>(null);
  const latest = useRef(model);
  latest.current = model;
  const openShared = (m: Shared, from: 'link' | 'file') => {
    const cur = latest.current;
    const before: Shared | null = cur.diagram.nodes.length ? { question: cur.question, n: cur.n, diagram: cur.diagram, groups: cur.groups, data: cur.data, r: cur.r ?? ML, reasons: cur.reasons ?? {}, base: cur.base } : null;
    update({ ...m, base: m.base, task: undefined });
    setOpened({ from, before });
    setTimeout(() => canvas.current?.fit(), 60);
  };
  useEffect(() => {
    const take = async () => {
      const code = linkCode();
      if (!code) return;
      history.replaceState(null, '', '#/model');           // a reload must not open the link again
      const m = await decodeModel(code);
      if (m) openShared(m, 'link'); else setOpened({ from: 'bad', before: null });
    };
    take();
    window.addEventListener('hashchange', take);
    return () => window.removeEventListener('hashchange', take);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareLink(await encodeModel(model))); setLinked(true); setTimeout(() => setLinked(false), 1800); } catch { setLinked(false); }
  };
  const fileName = (ext: string) => `${(model.question.trim() || 'my-model').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'my-model'}${ext}`;
  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  /** The Quarto report: question, drawing, η Lab's numbers and the R code that reproduces them. */
  const writeReport = async () => {
    const png = await canvas.current?.image('png');
    const image = png ? await new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(png); }) : undefined;
    const round = choice?.source === 'course' ? course?.rounds.find(x => x.id === choice.round) : undefined;
    const sample = choice?.source === 'course' ? round?.samples.find(x => x.id === choice.sample) : undefined;
    const data = choice?.source === 'course' ? { label: [round?.label, sample?.label].filter(Boolean).join(' · ') || 'the ESS data', own: false }
      : choice?.source === 'own' ? { label: `your file ${choice.name}`, own: true } : undefined;
    const plan: { label: string; text: string }[] = [];
    if (track === 'project') {
      const d2 = steps?.d2;
      if (d2?.accept?.trim()) plan.push({ label: 'Changes I would accept (written before looking at any modification index):', text: d2.accept.trim() });
      // the other pre-commitments of the project steps, in the order of the days
      const d0 = steps?.d0, d1 = steps?.d1, d3 = steps?.d3, d4 = steps?.d4, d5 = steps?.d5;
      if (d0?.constructs?.trim()) plan.unshift({ label: 'Constructs and items (Day 0):', text: d0.constructs.trim() });
      const kind = KINDS.find(k => k.id === d1?.kind);
      if (d1?.construct?.trim() && kind) plan.push({ label: 'The main construct (Day 1):', text: `${d1.construct.trim()}${d1.items?.trim() ? ` — ${d1.items.trim()}` : ''}. ${kind.label}${d1.why?.trim() ? `: ${d1.why.trim()}` : ''}` });
      const use = USES.find(u => u.id === d3?.use);
      if (use) plan.push({ label: 'How the constructs are used (Day 3):', text: use.label });
      if (d3?.overlap?.trim()) plan.push({ label: 'Items that might share more than their factors, named before testing (Day 3):', text: d3.overlap.trim() });
      const cmp = COMPARE.find(c => c.id === d4?.compare);
      if (cmp) plan.push({ label: 'What the groups are compared on (Day 4):', text: [cmp.label, d4?.variable && d4?.groups ? `${d4.variable}: ${d4.groups}` : ''].filter(Boolean).join(' — ') });
      if (d4?.items?.trim()) plan.push({ label: 'Items that might be read differently across groups, named before testing — the only candidates for release (Day 4):', text: d4.items.trim() });
      const pl = PLANS.find(p => p.id === d5?.plan);
      if (pl) plan.push({ label: 'Mean comparisons (Day 5):', text: pl.label });
      Object.entries(steps ?? {}).filter(([k, v]) => k !== 'd2' && v.note?.trim()).forEach(([k, v]) => plan.push({ label: `Day ${k.slice(1)}:`, text: v.note!.trim() }));
    }
    const qmd = quartoReport({
      question: model.question, diagram: d, r: ropts, syntax, data, image, plan,
      log: log.map(c => ({ sign: c.sign, text: c.text, code: c.code, reason: reasons[c.key] ?? '' })),
      est: fitted && est ? { main: fitted, rungs: est.rungs, groups: stats?.map(x => x.label) ?? [], level: estLevel } : undefined,
    });
    save(new Blob([qmd], { type: 'text/markdown' }), fileName('.qmd'));
  };
  const fileInput = useRef<HTMLInputElement | null>(null);
  const openFile = async (f: File | undefined) => {
    if (!f) return;
    try { const m = validShared(JSON.parse(await f.text())); if (m) openShared(m, 'file'); else setOpened({ from: 'bad', before: null }); } catch { setOpened({ from: 'bad', before: null }); }
  };
  const focusNote = (id: string) => { setHighlight(id); canvas.current?.focusNode(id); show('eta'); setTimeout(() => setHighlight(h => (h === id ? null : h)), 1600); };

  const taskCtx: TaskContext | null = task ? {
    a, d, base: model.base, fit: fitted, baseFit, changes: log, reasons,
    answers: model.task?.answers ?? {}, snapshots: snapshots.length, label: labelOf,
    g, locks: lad.locks, rungs: est?.rungs ?? null, refit,
  } : null;
  const keepCourse = () => { if (model.base) update({ snapshots: [...snapshots, { id: uid('s'), name: 'Example model', diagram: model.base }] }); };

  const empty = (
    <div className="st-empty card">
      <Eta mood="curious" size={84} />
      <div>
        <p className="st-empty-title">Start your model</p>
        <p className="hint" style={{ margin: '0 0 12px' }}>Drag a <b>Factor</b> from the left onto the sheet (or press <kbd>F</kbd>), name it, and press <kbd>Tab</kbd> to give it items. Pull the dots on a shape to draw arrows.</p>
        <div className="row">
          <button className="btn primary" onClick={() => update({ diagram: example() })}>Load the example</button>
          <button className="btn" onClick={() => { show('code'); setImporting(true); }}>Paste lavaan syntax</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="st">
      <header className="st-top">
        <a className="st-back" href={`#/${back}${back.startsWith('day/') ? '#try' : ''}`} title={back.startsWith('day/') ? 'Back to the day' : 'Back'}><Eta size={30} mood="neutral" /><span>← {back.startsWith('day/') ? `Day ${back.slice(4)}` : back === 'start' ? 'Start' : 'Back'}</span></a>
        <span className="seg st-track" role="group" aria-label="Workspace">
          <button aria-pressed={track === 'project'} onClick={() => setTrack('project')} title="Your own research model — the stations apply their ideas to it">My project</button>
          <button aria-pressed={track === 'practice'} onClick={() => setTrack('practice')} title="Example models and the day's task — your project stays untouched">Exercises</button>
        </span>
        <input className="st-q" type="text" value={model.question} onChange={e => update({ question: e.target.value })}
          placeholder={track === 'project' ? 'Your research question…' : 'The question of this exercise…'} aria-label="Research question" />
        <label className="st-n">n <input type="number" min={50} max={100000} step={50} value={model.n} aria-label="Expected sample size"
          onChange={e => update({ n: Math.max(50, +e.target.value || 50) })} /></label>
        <div className="st-actions">
          <button className="tool" onClick={() => update({ diagram: example() })}>Example</button>
          <button className="tool" onClick={() => { show('code'); setImporting(true); }}>Paste syntax</button>
          <button className="tool" onClick={() => update({ diagram: { nodes: [], edges: [] } })} disabled={!d.nodes.length}>New</button>
          <button className={`tool ${g.on ? 'pressed' : ''}`} aria-pressed={g.on} disabled={!ready && !g.on}
            onClick={() => { setGroups({ ...g, on: !g.on }); if (!g.on) show('groups'); }}>⇄ Groups</button>
          <button className="tool" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide panel ›' : '‹ η & code'}</button>
        </div>
      </header>

      <div className={`st-body ${open ? 'with-drawer' : ''}`}>
        <div className="st-stage">
          <Canvas key={track} d={d} onChange={diagram => update({ diagram })} notes={notes} showDefaults={showDefaults} setShowDefaults={setShowDefaults}
            invariance={grouped ? { level: g.level, locks: lad.locks, free: new Set(g.free), onToggle: toggleLock } : undefined}
            highlight={highlight} onNote={focusNote} handle={canvas} empty={empty} estimates={estView} onSelection={setSelected} />
          {task && taskCtx && (
            <TaskCard task={task} ctx={taskCtx} setAnswer={setAnswer} onReason={setReason} onKeepCourse={keepCourse} onPanel={t => show(t)}
              onClose={() => update({ task: undefined })}
              onRestart={() => { dropStash(task.id); freshTask(task.id); }} />
          )}
          {track === 'practice' && !task && !d.nodes.length && (
            <div className="st-toast" role="status"><Eta size={30} mood="curious" />
              <span>The exercise: open a day’s task, or load an example model from the Data tab.</span>
              {TASKS.map(t => <button key={t.id} className="tool" onClick={() => startTask(t.id)}>Day {t.day}: {t.title}</button>)}
            </div>
          )}
          {opened && (
            <div className={`st-toast ${opened.from === 'bad' ? 'warn' : ''}`} role="status">
              <Eta size={30} mood={opened.from === 'bad' ? 'worried' : 'pleased'} />
              <span>{opened.from === 'bad' ? 'That link or file does not hold a model I can read.' : `Opened a model from a ${opened.from}.`}</span>
              {opened.before && <button className="tool" onClick={() => { update(opened.before!); setOpened(null); }}>Back to my model</button>}
              <button className="st-toast-x" onClick={() => setOpened(null)} aria-label="Close">×</button>
            </div>
          )}
          {d.nodes.length > 0 && (
            <div className="st-estctl" role="group" aria-label="Estimates on the sheet">
              {fitted ? <>
                <span className="seg">
                  <button aria-pressed={showEst && std} onClick={() => { setShowEst(true); setStd(true); }}>std</button>
                  <button aria-pressed={showEst && !std} onClick={() => { setShowEst(true); setStd(false); }}>raw</button>
                  <button aria-pressed={!showEst} onClick={() => setShowEst(false)}>off</button>
                </span>
                {fitted.G > 1 && stats && <select value={gi} onChange={e => setEstGroup(+e.target.value)} aria-label="Group shown">{stats.map((s, i) => <option key={i} value={i}>{s.label}</option>)}</select>}
              </> : !choice
                ? <button className="tool" onClick={() => show('data')}>▶ Estimate on data</button>
                : <span className="st-estmsg">{est && !est.main.ok ? 'Not estimated — see η' : stats ? 'Estimating…' : 'Loading data…'}</span>}
            </div>
          )}
          {d.nodes.length > 0 && (
            <button className={`st-hud ${a.status}`} onClick={() => show('eta')} title="What η thinks of your model">
              <Eta size={34} mood={mood} />
              <span className="st-hud-main"><b key={a.df} className="pop">df {a.df}</b>
                <small>{a.knowns} facts − {a.q} parameters</small></span>
              {grouped && <span className="st-hud-groups"><b key={rung.df} className="pop">df {rung.df}</b><small>{G} groups · {g.level}</small></span>}
              {fitted && <span className="st-hud-fit" onClick={e => { e.stopPropagation(); show('results'); }}>
                <b className={`fitdot ${fitVerdict(fitted)}`}>CFI {fmtNum(fitted.cfi, true)}</b>
                <small>RMSEA {fmtNum(fitted.rmsea, true)} · χ²({fitted.df}) {fitted.chisq < 100 ? fitted.chisq.toFixed(1) : fitted.chisq.toFixed(0)}</small></span>}
            </button>
          )}
        </div>

        {open && (
          <aside className="st-drawer" aria-label="η, lavaan code and groups">
            <div className="st-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'eta'} onClick={() => setTab('eta')} title="η reads your model">η</button>
              <button role="tab" aria-selected={tab === 'data'} onClick={() => setTab('data')}>Data{choice ? ' •' : ''}</button>
              <button role="tab" aria-selected={tab === 'results'} onClick={() => setTab('results')}>Results</button>
              <button role="tab" aria-selected={tab === 'code'} onClick={() => setTab('code')}>lavaan</button>
              <button role="tab" aria-selected={tab === 'groups'} onClick={() => setTab('groups')}>Groups{g.on ? ' •' : ''}</button>
              <button className="st-close" onClick={() => setOpen(false)} aria-label="Hide panel">×</button>
            </div>

            {tab === 'eta' && (
              <div className="st-pane">
                <div className="st-eta">
                  <Eta size={72} mood={mood} />
                  <p>{a.status === 'empty' ? 'Draw something and I will read it as you go.'
                    : a.status === 'under' ? 'Not identified yet — the model asks for more numbers than the data hold.'
                      : a.status === 'just' ? 'Estimable, but nothing left over to test it.'
                        : `Testable: ${a.df} spare fact${a.df === 1 ? '' : 's'}.`}</p>
                </div>
                <ul className="notes">
                  {notes.map((n, i) => (
                    <li key={i} className={`${n.level} ${n.node ? 'linked' : ''}`}
                      onPointerEnter={() => n.node && setHighlight(n.node)} onPointerLeave={() => n.node && setHighlight(null)}
                      onClick={() => n.node && canvas.current?.focusNode(n.node)}>
                      <span aria-hidden="true">{n.level === 'ok' ? '✓' : n.level === 'warn' ? '!' : 'i'}</span>{n.text}
                    </li>
                  ))}
                </ul>
                {a.status !== 'empty' && (
                  <div className="st-budget">
                    <p className="st-h">The knowledge budget</p>
                    <div className="st-eq"><span><b>{a.knowns}</b>facts</span><i>−</i><span><b>{a.q}</b>parameters</span><i>=</i><span className={a.status}><b>{a.df}</b>df</span></div>
                    <ul className="hint">{a.parts.filter(p => p.count).map(p => <li key={p.label}><b>{p.count}</b> {p.label}</li>)}</ul>
                    <p className="hint">{a.p} items give {a.p} × {a.p + 1} / 2 = {a.knowns} variances and covariances. Counted with lavaan’s defaults — switch on <b>Defaults</b> in the toolbar to see them on the sheet.</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'data' && (
              <div className="st-pane">
                <DataPanel course={course} courseError={courseError} choice={choice} setChoice={setChoice} own={own}
                  inModel={new Set(d.nodes.filter(n => n.kind === 'observed').map(n => a.s.names.get(n.id) ?? n.label))}
                  onAdd={name => canvas.current?.addVariable(name)}
                  factorSelected={selectedFactor}
                  onTemplate={loadTemplate} />
              </div>
            )}

            {tab === 'results' && (
              <div className="st-pane">
                <ResultsPanel est={est} d={d} group={gi} setGroup={setEstGroup} std={std} setStd={setStd}
                  groupLabels={stats?.map(s => s.label) ?? []} level={g.level} hasData={!!choice}
                  probe={probe?.level === g.level ? probe.rows : undefined} probing={probe?.level === g.level && !probe.rows} onProbe={runProbe}
                  onRelease={key => setGroups({ ...g, free: [...g.free, key] })}>
                  {fitted && <>
                    {fitted.effects.length > 0 && <details className="rp-sec" open>
                      <summary>Effects: direct, indirect, total{fitted.G > 1 && stats ? ` · ${stats[gi]?.label}` : ''}</summary>
                      <EffectsTable fit={fitted} d={d} group={gi} />
                    </details>}
                    {fitted.G > 1 && stats && <details className="rp-sec" open>
                      <summary>Latent means</summary>
                      <LatentMeans fit={fitted} d={d} labels={stats.map(s => s.label)} level={estLevel}
                        scalarDrop={est?.rungs?.[2]?.ok && est.rungs[1]?.ok ? est.rungs[2].cfi - est.rungs[1].cfi : undefined}
                        itemMeans={(f, gg) => {
                          const items = a.s.load.filter(e => e.from === f && a.s.observed.includes(e.to)).map(e => a.s.names.get(e.to)!);
                          const st = stats[gg];
                          return items.reduce((acc, nm) => acc + st.means[st.names.indexOf(nm)], 0) / Math.max(items.length, 1);
                        }} />
                    </details>}
                    <details className="rp-sec" open>
                      <summary>Where the model strains</summary>
                      <StrainList fit={fitted} d={d} groupLabels={stats?.map(s => s.label) ?? []} onAdd={addFromMI} />
                    </details>
                    <details className="rp-sec">
                      <summary>Residual correlations{fitted.G > 1 && stats ? ` · ${stats[gi]?.label}` : ''}</summary>
                      <ResidualMatrix fit={fitted} d={d} group={gi} />
                    </details>
                    {(log.length > 0 || model.base) && <details className="rp-sec" open={log.length > 0}>
                      <summary>Logbook: changes and reasons{log.length ? ` · ${log.length}` : ''}</summary>
                      <Logbook changes={log} reasons={reasons} onReason={setReason} />
                    </details>}
                    <details className="rp-sec" open={snapshots.length > 0}>
                      <summary>Compare models{snapshots.length ? ` · ${snapshots.length} kept` : ''}</summary>
                      <CompareModels snapshots={snapshots} rows={compare} current={fitted} currentVars={a.s.observed.map(v => a.s.names.get(v)!).sort()}
                        onKeep={keepModel} onRestore={id => { const sn = snapshots.find(x => x.id === id); if (sn) update({ diagram: sn.diagram }); }}
                        onDelete={id => update({ snapshots: snapshots.filter(x => x.id !== id) })} />
                    </details>
                  </>}
                </ResultsPanel>
              </div>
            )}

            {tab === 'code' && (
              <div className="st-pane">
                <div className="row st-share">
                  <span className="st-h">Share</span>
                  <button className="tool" onClick={copyLink} disabled={!d.nodes.length} title="A link that opens this model in η Lab">{linked ? '✓ Link copied' : '🔗 Copy link'}</button>
                  <button className="tool" onClick={() => save(modelFile(model), fileName('.eta.json'))} disabled={!d.nodes.length} title="Save the model as a file">Save file</button>
                  <button className="tool" onClick={() => fileInput.current?.click()} title="Open a saved model file">Open file…</button>
                  <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={e => { openFile(e.target.files?.[0]); e.target.value = ''; }} />
                </div>
                <div className="row st-share">
                  <span className="st-h">Export</span>
                  <button className="tool" onClick={copy} disabled={!d.nodes.length}>{copied ? '✓ Copied' : 'Copy code'}</button>
                  <button className="tool" onClick={download} disabled={!d.nodes.length}>.R</button>
                  <button className="tool" onClick={writeReport} disabled={!d.nodes.length} title="A Quarto report with the drawing, the estimates and the R code">Report .qmd</button>
                  <button className="tool" onClick={() => canvas.current?.exportImage('png')} disabled={!d.nodes.length}>PNG</button>
                  <button className="tool" onClick={() => canvas.current?.exportImage('svg')} disabled={!d.nodes.length}>SVG</button>
                  <a className="tool" href="https://lavaangui.org" target="_blank" rel="noreferrer">lavaangui ↗</a>
                </div>
                {d.nodes.length > 0 && <ROptionsBar r={ropts} set={r => update({ r })} d={d} />}
                <pre className="syntax live" aria-live="polite"><code>{lines.map((l, i) => <span key={`${i}-${fresh.has(i) ? stamp : 0}`} className={fresh.has(i) ? 'fresh' : undefined}>{l}{'\n'}</span>)}</code></pre>
                <p className="hint">This code updates as you draw. Run it in R on your own data.</p>
                <button className="tool" aria-expanded={importing} onClick={() => setImporting(v => !v)}>{importing ? 'Close' : 'Paste lavaan syntax'}</button>
                {importing && (
                  <div className="import" style={{ marginTop: 8 }}>
                    <textarea autoFocus value={paste} onChange={e => setPaste(e.target.value)} spellCheck={false} aria-label="lavaan model syntax"
                      placeholder={'Trust =~ trust1 + trust2 + trust3 + trust4\nVacc  =~ vacc1 + vacc2 + vacc3\nVacc  ~ Trust + age'} />
                    <div className="row" style={{ marginTop: 8 }}>
                      <button className="btn primary" onClick={draw} disabled={!paste.trim()}>Draw it</button>
                      <span className="hint" style={{ margin: 0 }}>Replaces the sheet — undo brings it back.</span>
                    </div>
                  </div>
                )}
                {report && report.skipped.length > 0 && <p className="hint">Not drawn: {report.skipped.slice(0, 6).map((x, i) => <code key={i} style={{ marginRight: 8 }}>{x}</code>)}</p>}
                {report && report.modifiers.length > 0 && <p className="hint"><b>Drawn without fixed values or labels:</b> {report.modifiers.slice(0, 6).map((x, i) => <code key={i} style={{ marginRight: 8 }}>{x}</code>)}</p>}
              </div>
            )}

            {tab === 'groups' && (
              <div className="st-pane">
                {ready && choice && stats && stats.length < 2 && g.on && <p className="hint" style={{ marginTop: 0 }}>Your data are one group. Choose <b>Compare groups</b> in the <button className="linkish" onClick={() => setTab('data')}>Data tab</button> to estimate the ladder on real groups — until then the ladder only counts.</p>}
                {ready ? <GroupsPanel g={g} set={setGroups} lad={lad} ready={ready} />
                  : <p className="hint">Groups need a model with at least one factor and its items. Draw one first.</p>}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
