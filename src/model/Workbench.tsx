// "Your model" — the workbench: draw your own model, let η read it, take the syntax to R.
import { useMemo, useState } from 'react';
import { Eta, type Mood } from '../eta/Eta.tsx';
import { StationHead } from '../components/ui.tsx';
import { analyse, example, fromLavaan, modelString, toLavaan } from './diagram.ts';
import { ladder, ladderSyntax, type Groups } from './invariance.ts';
import { GroupsPanel } from './GroupsPanel.tsx';
import { Editor } from './Editor.tsx';
import type { YourModel } from '../state.ts';

const MOOD: Record<string, Mood> = { empty: 'curious', under: 'worried', just: 'thinking', over: 'pleased' };

export function Workbench({ model, update }: { model: YourModel; update: (p: Partial<YourModel>) => void }) {
  const a = analyse(model.diagram);
  const g = model.groups;
  const G = g.names.length;
  const lad = useMemo(() => ladder(model.diagram, G, g.free, g.level), [model.diagram, G, g.free, g.level]);
  const ready = a.s.latent.length > 0 && !a.blocked;
  const grouped = g.on && ready;
  const syntax = grouped ? `${modelString(model.diagram)}\n\n${ladderSyntax(model.diagram, g)}` : toLavaan(model.diagram);
  const setGroups = (next: Groups) => update({ groups: next });
  const toggleLock = (key: string) => setGroups({ ...g, free: g.free.includes(key) ? g.free.filter(k => k !== key) : [...g.free, key] });
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [paste, setPaste] = useState('');
  const [skipped, setSkipped] = useState<string[] | null>(null);
  const [modifiers, setModifiers] = useState<string[]>([]);
  const draw = () => {
    const r = fromLavaan(paste);
    if (!r.diagram.nodes.length) { setSkipped(r.skipped.length ? r.skipped : ['nothing I could read — use =~, ~ and ~~']); return; }
    update({ diagram: r.diagram }); setSkipped(r.skipped); setModifiers(r.modifiers); setImporting(false);
  };
  const hasWarn = a.notes.some(n => n.level === 'warn');
  const mood: Mood = hasWarn && a.status !== 'empty' ? 'worried' : MOOD[a.status];

  const copy = async () => {
    try { await navigator.clipboard.writeText(syntax); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); }
  };
  const download = () => {
    const header = `# ${model.question || 'My SEM'}\n# drawn in η Lab — replace my_data with your data frame\nlibrary(lavaan)\n\n`;
    const blob = new Blob([header + syntax + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'my-model.R'; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <article>
      <StationHead kicker="Your model · the workbench" title="Draw the model you want to test"
        lead="Sketch your own research model the way lavaangui does: factors as ellipses, items as boxes, arrows for effects. η reads it as you draw, and every station applies its idea to it." />

      <div className="card play wb-top">
        <label htmlFor="wb-q">Research question</label>
        <input id="wb-q" type="text" value={model.question} placeholder="Does trust in science shape vaccine intentions?" onChange={e => update({ question: e.target.value })} />
        <label htmlFor="wb-n">Expected sample size</label>
        <input id="wb-n" type="number" min={50} max={100000} step={50} value={model.n} onChange={e => update({ n: Math.max(50, +e.target.value || 50) })} />
      </div>

      <div className="card play" style={{ marginTop: 18 }}>
        <Editor d={model.diagram} onChange={diagram => update({ diagram })}
          invariance={grouped ? { level: g.level, locks: lad.locks, free: new Set(g.free), onToggle: toggleLock } : undefined} />
        <div className="row" style={{ marginTop: 12 }}>
          {model.diagram.nodes.length === 0
            ? <button className="btn primary" onClick={() => update({ diagram: example() })}>Start from an example</button>
            : <button className="btn" onClick={() => update({ diagram: example() })}>Load the example</button>}
          <button className="btn" aria-expanded={importing} onClick={() => setImporting(v => !v)}>Paste lavaan syntax</button>
          {model.diagram.nodes.length > 0 && <button className="btn" onClick={() => update({ diagram: { nodes: [], edges: [] } })}>Start over</button>}
          <span className="hint" style={{ margin: 0 }}>Every change can be undone.</span>
        </div>
        {importing && (
          <div className="import" style={{ marginTop: 12 }}>
            <label htmlFor="wb-paste" className="hint" style={{ display: 'block', margin: '0 0 6px' }}>Paste a model from a paper, the slides or your R script. η draws it (=~, ~ and ~~; fixed values and labels are left out).</label>
            <textarea id="wb-paste" value={paste} onChange={e => setPaste(e.target.value)} spellCheck={false}
              placeholder={'Trust =~ trust1 + trust2 + trust3 + trust4\nVacc  =~ vacc1 + vacc2 + vacc3\nVacc  ~ Trust + age'} />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={draw} disabled={!paste.trim()}>Draw it</button>
              <button className="btn" onClick={() => setImporting(false)}>Cancel</button>
            </div>
          </div>
        )}
        {skipped && skipped.length > 0 && <p className="hint">Not drawn: {skipped.slice(0, 6).map((x, i) => <code key={i} style={{ marginRight: 8 }}>{x}</code>)}{skipped.length > 6 ? '…' : ''}</p>}
        {modifiers.length > 0 && <p className="hint"><b>Drawn without their fixed values or labels</b> — the syntax below estimates them freely, so add them back in R if you need them:{' '}
          {modifiers.slice(0, 6).map((x, i) => <code key={i} style={{ marginRight: 8 }}>{x}</code>)}{modifiers.length > 6 ? '…' : ''}</p>}
      </div>

      <GroupsPanel g={g} set={setGroups} lad={lad} ready={ready} />

      <div className="wb-grid">
        <div className="card explain" style={{ alignItems: 'start' }}>
          <Eta mood={mood} size={110} />
          <div>
            <p style={{ fontWeight: 800, marginBottom: 6 }}>η reads your model</p>
            <ul className="notes">
              {a.notes.map((n, i) => <li key={i} className={n.level}><span aria-hidden="true">{n.level === 'ok' ? '✓' : n.level === 'warn' ? '!' : 'i'}</span>{n.text}</li>)}
            </ul>
          </div>
        </div>
        <div className="card play">
          <p style={{ fontWeight: 800, margin: '0 0 6px', color: 'var(--ink)' }}>The knowledge budget</p>
          <div className="metrics" style={{ marginTop: 0 }}>
            <div className="metric"><span>Items</span><b>{a.p}</b></div>
            <div className="metric"><span>Facts</span><b>{a.knowns}</b></div>
            <div className="metric"><span>Parameters</span><b>{a.q}</b></div>
            <div className="metric"><span>df</span><b>{a.df}</b></div>
          </div>
          <details style={{ marginTop: 8 }}>
            <summary className="hint" style={{ cursor: 'pointer' }}>What the parameters are</summary>
            <ul className="hint" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {a.parts.filter(p => p.count).map(p => <li key={p.label}>{p.count} {p.label}</li>)}
            </ul>
          </details>
          <p className="hint">Counted with lavaan’s defaults: one loading per factor fixed to 1, factors without incoming arrows covary.</p>
        </div>
      </div>

      <div className="card formula" style={{ marginTop: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <p style={{ fontWeight: 800, margin: 0, color: 'var(--ink)' }}>Your model in lavaan{grouped ? ` — ${G} groups, ${g.level} invariance` : ''}</p>
          <div className="row">
            <button className="btn" onClick={copy}>{copied ? '✓ Copied' : 'Copy syntax'}</button>
            <button className="btn" onClick={download}>Download .R</button>
            <a className="btn" href="https://lavaangui.org" target="_blank" rel="noreferrer">Open lavaangui ↗</a>
          </div>
        </div>
        <pre className="syntax"><code>{syntax}</code></pre>
        <p className="hint">Run it in R on your own data, or redraw it in lavaangui to estimate it with a graphical interface.</p>
      </div>
    </article>
  );
}
