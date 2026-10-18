// Compare decisions: several people did the same studio task — a study group, a seminar, a
// reading circle. Each shares a link (it carries the model, the releases and the reasons); the
// board reads all links, refits every model on the course data and sets the decisions side by side.
// No server: everything is decoded and estimated in the browser.
import { useEffect, useMemo, useState } from 'react';
import { Eta } from '../eta/Eta.tsx';
import { groupsFor, loadCourseData, type CourseData } from '../data/course.ts';
import { fitModel, type Fitted } from '../math/sem.ts';
import { ladder, LEVELS } from '../model/invariance.ts';
import type { YourModel } from '../state.ts';
import { changes, releases } from '../studio/logbook.ts';
import { decodeModel, encodeModel, shareLink, type Shared } from '../studio/share.ts';
import { taskById, TASKS } from '../studio/tasks.ts';

interface Row { i: number; m: Shared; list: { text: string; reason: string }[]; fit: Fitted | null; dcfi: number | null; means: number[] }

function analyseShared(m: Shared, data: CourseData): Omit<Row, 'i'> {
  const d = m.diagram, g = m.groups;
  const grouped = g.on;
  const locks = grouped ? ladder(d, g.names.length, g.free, g.level).locks : [];
  const rel = grouped ? releases(d, locks, g.free) : [];
  const list = changes(d, m.base, m.reasons ?? {}, rel).map(c => ({ text: `${c.sign} ${c.text}`, reason: (m.reasons ?? {})[c.key] ?? '' }));
  const choice = m.data;
  if (!choice || choice.source !== 'course') return { m, list, fit: null, dcfi: null, means: [] };
  const groups = groupsFor(data, choice.round, choice.sample, choice.grouping);
  const level = groups.length > 1 ? g.level : 'configural';
  const r = fitModel(d, { groups, level, free: g.free });
  const fit = r.ok ? r : null;
  let dcfi: number | null = null, means: number[] = [];
  if (fit && groups.length > 1 && LEVELS.indexOf(level) > 0) {
    const below = fitModel(d, { groups, level: LEVELS[LEVELS.indexOf(level) - 1], free: g.free });
    if (below.ok) dcfi = fit.cfi - below.cfi;
    const std = fitModel({ ...d, stdlv: true }, { groups, level, free: g.free });
    if (std.ok) means = std.params.filter(p => p.op === '~1' && std.params.some(q => q.op === '=~' && q.lhs === p.lhs)).sort((a, b) => a.group - b.group).map(p => p.est);
  }
  return { m, list, fit, dcfi, means };
}

const f3 = (v: number) => v.toFixed(3).replace(/^(-?)0\./, '$1.');

/** Share the exercise: the link carries the model, the releases and the reasons. */
export function ShareDecision({ practice, task }: { practice: YourModel; task: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const mine = practice.task?.id === task;
  return (
    <div className="ws-share">
      <button className="btn primary" disabled={!mine} onClick={async () => {
        const l = shareLink(await encodeModel(practice));
        setLink(l);
        try { await navigator.clipboard.writeText(l); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* the link stays visible below */ }
      }}>{copied ? '✓ Link copied' : 'Share my decision'}</button>
      {!mine && <span className="hint">Do the task first — then share it here.</span>}
      {link && <input className="ws-link" readOnly value={link} onFocus={e => e.target.select()} aria-label="Your link" />}
    </div>
  );
}

export function Board({ task: taskId }: { task?: string }) {
  const [text, setText] = useState('');
  const [data, setData] = useState<CourseData | null>(null);
  const [models, setModels] = useState<Shared[]>([]);
  const [bad, setBad] = useState(0);
  useEffect(() => { loadCourseData().then(setData).catch(() => setData(null)); }, []);
  useEffect(() => {
    const codes = [...new Set([...text.matchAll(/[?&]m=([A-Za-z0-9_-]+)/g)].map(x => x[1]))];
    let alive = true;
    Promise.all(codes.map(decodeModel)).then(ms => {
      if (!alive) return;
      setModels(ms.filter((x): x is Shared => !!x));
      setBad(ms.filter(x => !x).length);
    });
    return () => { alive = false; };
  }, [text]);
  const rows: Row[] = useMemo(() => (data ? models.map((m, i) => ({ i: i + 1, ...analyseShared(m, data) })) : []), [models, data]);
  const tally = useMemo(() => {
    const t = new Map<string, number>();
    rows.forEach(r => r.list.forEach(x => t.set(x.text, (t.get(x.text) ?? 0) + 1)));
    return [...t.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const withMeans = rows.filter(r => r.means.length > 1);
  const task = taskById(taskId);
  const groupNames = task?.groups?.names ?? [];
  const grouped = groupNames.length > 1;

  return (
    <div className="ws-board">
      <label className="ps-field">Paste the shared links — any text with links will do
        <textarea rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="https://…#/model?m=…" />
      </label>
      {bad > 0 && <p className="hint">{bad} link{bad > 1 ? 's' : ''} could not be read.</p>}
      {!data && models.length > 0 && <p className="hint">Loading the course data…</p>}
      {rows.length > 0 && (
        <>
          <p className="ws-sum"><b>{rows.length}</b> decision{rows.length > 1 ? 's' : ''} · {rows.filter(r => !r.list.length).length} kept the course model</p>
          {tally.length > 0 && (
            <div className="ws-tally">
              {tally.map(([what, n]) => (
                <div key={what}><span className="ws-bar" style={{ width: `${(100 * n) / rows.length}%` }} /><b>{n}×</b> {what}</div>
              ))}
            </div>
          )}
          {withMeans.length > 1 && (
            <p className="hint">Factor means vs. {groupNames[0] ?? 'the first group'} (SD) across the decisions: {groupNames.slice(1).map((nm, k) => {
              const v = withMeans.map(r => r.means[k + 1]);
              return `${nm} ${f3(Math.min(...v))} to ${f3(Math.max(...v))}`;
            }).join(' · ')}</p>
          )}
          <table className="rp-table ws-table">
            <thead><tr><th>#</th><th>Changes and reasons</th><th>CFI</th>{grouped && <><th>ΔCFI</th><th>Means</th></>}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.i}>
                  <td>{r.i}</td>
                  <td>{r.list.length ? r.list.map((x, k) => <div key={k}><b>{x.text}</b>{x.reason ? <> — <i>{x.reason}</i></> : <span className="ws-noreason"> — no reason</span>}</div>) : <i>kept the course model</i>}</td>
                  <td>{r.fit ? f3(r.fit.cfi) : '–'}</td>
                  {grouped && <><td className={r.dcfi !== null && r.dcfi < -0.01 ? 'poor' : 'good'}>{r.dcfi === null ? '–' : f3(r.dcfi)}</td><td>{r.means.length > 1 ? r.means.slice(1).map(f3).join(' / ') : '–'}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** The page #/compare?task=… : what the board is for, and the board itself. */
export function ComparePage() {
  const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const [taskId, setTaskId] = useState(q.get('task') ?? '');
  const task = taskById(taskId || undefined);
  return (
    <article className="day">
      <header className="station-head">
        <span className="kicker">Tool · compare decisions</span>
        <h1>Same task, different decisions</h1>
        <p>Several people did the same studio task. Each shares a link with “Share my decision”; paste all of them here. η Lab refits every model and sets the changes, the reasons and the results side by side.</p>
      </header>
      <div className="card ws-head">
        <Eta size={54} mood="curious" />
        <div>
          <label className="ps-field">The task
            <select value={taskId} onChange={e => setTaskId(e.target.value)}>
              <option value="">any task</option>
              {TASKS.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
          {task && <p className="hint" style={{ marginBottom: 0 }}>{task.groups?.names?.length ? 'With groups: the board also shows the change in fit and the factor means.' : 'The board shows the changes, their reasons and the fit.'}</p>}
        </div>
      </div>
      <Board task={taskId || undefined} />
    </article>
  );
}
