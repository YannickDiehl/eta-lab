// The data panel: course data from the ESS or the learner's own CSV file, and the
// variables to drag onto the sheet.
import { useMemo, useState } from 'react';
import { GROUPING_LABEL, variablesOf, type CourseData, type Grouping } from '../data/course.ts';
import type { DataChoice } from '../state.ts';
import { VAR_MIME } from './Canvas.tsx';
import { parseCsv, setOwnData, type OwnData } from './owndata.ts';
import { TEMPLATES, type Template } from './templates.ts';

interface Props {
  course: CourseData | null;
  courseError: string | null;
  choice: DataChoice | null;
  setChoice: (c: DataChoice | null) => void;
  own: OwnData | null;
  inModel: Set<string>;
  onAdd: (name: string) => void;
  factorSelected: string | null;
  onTemplate: (t: Template) => void;
}

export function DataPanel({ course, courseError, choice, setChoice, own, inModel, onAdd, factorSelected, onTemplate }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const src = choice?.source ?? 'course';

  const round = course && choice?.source === 'course' ? course.rounds.find(r => r.id === choice.round) ?? course.rounds[0] : course?.rounds[0];
  const sample = round && choice?.source === 'course' ? round.samples.find(s => s.id === choice.sample) ?? round.samples[0] : round?.samples[0];
  const pickCourse = (patch: Partial<{ round: string; sample: string; grouping: Grouping }>) => {
    const base = choice?.source === 'course' ? choice : { source: 'course' as const, round: course?.rounds[0].id ?? 'ess2004', sample: 'NL', grouping: 'none' as Grouping };
    let next = { ...base, ...patch };
    if (patch.round) {
      const r = course?.rounds.find(x => x.id === patch.round);
      if (r && !r.samples.some(s => s.id === next.sample)) next = { ...next, sample: r.samples[1]?.id ?? r.samples[0].id };
    }
    if (next.grouping === 'country' && next.sample !== 'pooled') next = { ...next, grouping: 'none' };
    setChoice(next);
  };

  const vars = useMemo(() => {
    if (src === 'own') return own ? own.columns.filter((_, j) => own.numeric[j]).map(name => ({ name, block: 'Numeric columns', group: '', label: '', scale: '' })) : [];
    return course ? variablesOf(course, round) : [];
  }, [src, own, course, round]);
  const q = query.trim().toLowerCase();
  const shown = vars.filter(v => !q || v.name.toLowerCase().includes(q) || v.label.toLowerCase().includes(q) || v.group.toLowerCase().includes(q));
  const blocks = [...new Set(shown.map(v => v.block))];

  const readFile = async (f: File) => {
    setFileError(null);
    try {
      const d = parseCsv(await f.text(), f.name.replace(/\.[^.]+$/, ''));
      setOwnData(d);
      setChoice({ source: 'own', name: d.name, grouping: null });
    } catch (e) { setFileError((e as Error).message); }
  };

  return (
    <div className="dp">
      <div className="seg dp-src" role="group" aria-label="Data source">
        <button aria-pressed={src === 'course'} onClick={() => pickCourse({})}>Course data (ESS)</button>
        <button aria-pressed={src === 'own'} onClick={() => own ? setChoice({ source: 'own', name: own.name, grouping: null }) : setChoice(choice?.source === 'own' ? choice : { source: 'own', name: '', grouping: null })}>Your own file</button>
      </div>

      {src === 'course' && (
        course ? <>
          <div className="dp-grid">
            <label htmlFor="dp-round">Survey</label>
            <select id="dp-round" value={round?.id} onChange={e => pickCourse({ round: e.target.value })}>
              {course.rounds.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <label htmlFor="dp-sample">Sample</label>
            <select id="dp-sample" value={sample?.id} onChange={e => pickCourse({ sample: e.target.value })}>
              {round?.samples.map(s => <option key={s.id} value={s.id}>{s.label} · n = {s.all.n.toLocaleString('en')}</option>)}
            </select>
            <label htmlFor="dp-group">Compare groups</label>
            <select id="dp-group" value={choice?.source === 'course' ? choice.grouping : 'none'} onChange={e => pickCourse({ grouping: e.target.value as Grouping })}>
              {(['none', 'country', 'gender', 'age'] as Grouping[]).filter(gr => gr === 'none' || (!round?.simulated && (gr !== 'country' || sample?.id === 'pooled')))
                .map(gr => <option key={gr} value={gr}>{gr === 'none' ? 'no — one group' : `by ${GROUPING_LABEL[gr]}`}</option>)}
            </select>
          </div>
          {!choice && <button className="btn primary" style={{ marginTop: 4 }} onClick={() => pickCourse({ round: round?.id, sample: sample?.id })}>Estimate on this sample</button>}
          {choice && sample && !round?.simulated && <p className="hint">Complete cases on all course variables: {sample.all.n.toLocaleString('en')} of {sample.all.raw.toLocaleString('en')} respondents. Value items run from 1 (not like me) to 6 (very much like me).</p>}
          {round?.simulated && <p className="hint dp-sim"><b>Simulated data.</b> {round.note}</p>}
        </> : <p className="hint">{courseError ?? 'Loading the course data…'}</p>
      )}

      {src === 'own' && (
        <div className="dp-own">
          <label className="btn" style={{ cursor: 'pointer' }}>
            {own ? 'Open another CSV file' : 'Open a CSV file'}
            <input type="file" accept=".csv,.txt,text/csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }} />
          </label>
          {fileError && <p className="hint" style={{ color: 'var(--neg)' }}>{fileError}</p>}
          {own && choice?.source === 'own' && <>
            <p className="hint"><b>{own.name}</b> · {own.cells.length.toLocaleString('en')} rows · {own.numeric.filter(Boolean).length} numeric columns</p>
            <div className="dp-grid">
              <label htmlFor="dp-own-group">Compare groups</label>
              <select id="dp-own-group" value={choice.grouping ?? ''} onChange={e => setChoice({ ...choice, grouping: e.target.value || null })}>
                <option value="">no — one group</option>
                {own.groupable.map(c => <option key={c} value={c}>by {c}</option>)}
              </select>
            </div>
          </>}
          {!own && choice?.source === 'own' && choice.name && <p className="hint">“{choice.name}” is not open any more — files stay only in this tab’s memory. Open it again.</p>}
          <p className="hint">Your file is read in this browser tab only. Nothing is uploaded or stored. Missing values: empty, NA or “.”; each model uses the cases complete on its variables.</p>
        </div>
      )}

      {src === 'course' && course && (
        <details className="dp-models">
          <summary className="st-h" style={{ margin: '14px 0 6px', cursor: 'pointer' }}>Course models, day by day</summary>
          <ul>
            {TEMPLATES.map(m => (
              <li key={m.title}><button onClick={() => onTemplate(m)} title={m.note}><span>{m.day}</span>{m.title}{m.round === 'panel' || m.round === 'mtmm' ? <i className="sim">simulated</i> : null}</button></li>
            ))}
          </ul>
          <p className="hint">Loading a model replaces the sheet — undo brings yours back.</p>
        </details>
      )}

      {vars.length > 0 && (
        <div className="dp-vars">
          <p className="st-h" style={{ margin: '16px 0 6px' }}>Variables</p>
          <p className="hint" style={{ margin: '0 0 8px' }}>{factorSelected ? <>Click a variable to add it as an item of <b>{factorSelected}</b> — or drag it onto any factor.</> : 'Drag a variable onto a factor to make it an item, or onto empty space. Select a factor first to add items with one click.'}</p>
          <input className="dp-search" type="search" placeholder="Search variables…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search variables" />
          {blocks.map(b => {
            const items = shown.filter(v => v.block === b);
            const isOpen = open[b] ?? (q ? true : b !== 'Background');
            return (
              <div key={b} className="dp-block">
                <button className="dp-block-head" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [b]: !isOpen })}>{isOpen ? '▾' : '▸'} {b} <span>{items.length}</span></button>
                {isOpen && <ul>
                  {items.map(v => (
                    <li key={v.name} className={inModel.has(v.name) ? 'in' : ''} draggable
                      onDragStart={e => { e.dataTransfer.setData(VAR_MIME, v.name); e.dataTransfer.setData('text/plain', v.name); e.dataTransfer.effectAllowed = 'copy'; }}
                      title={v.label ? `${v.label}${v.scale ? ` (${v.scale})` : ''}` : v.name}>
                      <button onClick={() => onAdd(v.name)} aria-label={`Add ${v.name}`}>{inModel.has(v.name) ? '✓' : '+'}</button>
                      <code>{v.name}</code>
                      <span>{v.group && <i>{v.group}</i>}{v.label}</span>
                    </li>
                  ))}
                </ul>}
              </div>
            );
          })}
        </div>
      )}
      {src === 'course' && course && <p className="hint dp-source">{course.source}</p>}
    </div>
  );
}
