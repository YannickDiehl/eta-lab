// The groups layer of the workbench: name the groups, climb the invariance ladder,
// release single equalities (partial invariance) on the diagram.
import { Eta } from '../eta/Eta.tsx';
import { LEVELS, MEANING, type Groups, type Ladder, type Level } from './invariance.ts';

const TITLE: Record<Level, string> = { configural: 'Configural', metric: 'Metric', scalar: 'Scalar', strict: 'Strict' };

export function GroupsPanel({ g, set, lad, ready }: { g: Groups; set: (g: Groups) => void; lad: Ladder; ready: boolean }) {
  if (!g.on) {
    return (
      <div className="card play groups-off" style={{ marginTop: 18 }}>
        <Eta mood="curious" size={64} />
        <div>
          <p style={{ fontWeight: 800, margin: '0 0 4px', color: 'var(--ink)' }}>Same ruler in every group?</p>
          <p className="hint" style={{ margin: 0 }}>Before you compare countries, survey waves or any other groups, your items must measure the same thing in each.
            Switch on groups and climb the invariance ladder with your own model.</p>
        </div>
        <button className="btn primary" onClick={() => set({ ...g, on: true })} disabled={!ready}>Compare groups</button>
      </div>
    );
  }
  const names = g.names;
  const setName = (i: number, v: string) => set({ ...g, names: names.map((x, k) => (k === i ? v : x)) });
  const sel = LEVELS.indexOf(g.level);
  const releasedHere = lad.locks.filter(l => g.free.includes(l.key));

  return (
    <section className="card play groups" style={{ marginTop: 18 }} aria-label="Groups and measurement invariance">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontWeight: 800, margin: 0, color: 'var(--ink)', fontSize: 19 }}>Groups · measurement invariance</p>
        <button className="tool" onClick={() => set({ ...g, on: false })}>Switch off</button>
      </div>

      <div className="group-inputs">
        <label htmlFor="g-var">Grouping variable</label>
        <input id="g-var" type="text" value={g.variable} onChange={e => set({ ...g, variable: e.target.value })} placeholder="cntry" />
        <span className="lbl-row">Groups</span>
        <div className="group-names">
          {names.map((n, i) => (
            <span key={i} className="group-name">
              <input aria-label={`Group ${i + 1}`} type="text" value={n} onChange={e => setName(i, e.target.value)} size={Math.max(3, n.length + 1)} />
              {names.length > 2 && <button className="x" aria-label={`Remove group ${n || i + 1}`} onClick={() => set({ ...g, names: names.filter((_, k) => k !== i) })}>×</button>}
            </span>
          ))}
          {names.length < 6 && <button className="tool" onClick={() => set({ ...g, names: [...names, ''] })}>+ group</button>}
        </div>
      </div>

      <ol className="ladder" aria-label="Invariance ladder">
        {lad.rungs.map((r, i) => {
          const prev = lad.rungs[i - 1];
          return (
            <li key={r.level}>
              <button className={`rung ${i === sel ? 'on' : ''} ${i < sel ? 'below' : ''}`} aria-pressed={i === sel} onClick={() => set({ ...g, level: r.level })}>
                <span className="rung-title">{TITLE[r.level]}</span>
                <span className="rung-adds">{MEANING[r.level].adds}</span>
                <span className="rung-df">df {r.df}{prev ? <small> (+{r.df - prev.df})</small> : null}</span>
                <span className="rung-compare">compare: {MEANING[r.level].compare}</span>
                {r.released > 0 && <span className="rung-partial">{r.released} released</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="hint" style={{ marginTop: 6 }}>df add up over all {lad.G} groups. Each step up adds as many df as it adds equalities — that is what the step tests.
        {lad.rungs[2].freedMeans > 0 && ` At the scalar step lavaan also frees ${lad.rungs[2].freedMeans} factor mean${lad.rungs[2].freedMeans === 1 ? '' : 's'} per extra group, which costs df back.`}</p>

      <div className="explain" style={{ marginTop: 14, alignItems: 'start' }}>
        <Eta mood={lad.notes.some(n => n.level === 'warn') ? 'worried' : 'thinking'} size={90} />
        <div>
          <p>{MEANING[g.level].eta}</p>
          {g.level !== 'configural' && <p className="hint" style={{ margin: '0 0 6px' }}>On the diagram, every chip is one equality. If a step makes the fit clearly worse, find the item that breaks it — and release only that one, with a reason.</p>}
          {lad.notes.length > 0 && <ul className="notes">
            {lad.notes.map((n, i) => <li key={i} className={n.level}><span aria-hidden="true">{n.level === 'ok' ? '✓' : n.level === 'warn' ? '!' : 'i'}</span>{n.text}</li>)}
          </ul>}
          {releasedHere.length > 0 && (
            <p className="hint" style={{ margin: '8px 0 0' }}>Released: {releasedHere.map(l => <code key={l.key} style={{ marginRight: 8 }}>{l.partial}</code>)}
              <button className="tool" onClick={() => set({ ...g, free: [] })}>Hold all equal again</button></p>
          )}
        </div>
      </div>
    </section>
  );
}

