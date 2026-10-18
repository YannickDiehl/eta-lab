// Building blocks shared by all stations. Every station follows one rhythm:
//   Wonder (a question) → Play (the sandbox) → η explains → The formula → Your model
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Eta, type Mood } from '../eta/Eta.tsx';
import type { Matrix } from '../math/linalg.ts';

const SHAPE = { wonder: 'y', play: 'r', explain: 'e', formula: 'f', yours: 'c' } as const;
const LABEL = { wonder: 'Wonder', play: 'Play', explain: 'η explains', formula: 'The formula', yours: 'Your model' } as const;

export function Beat({ kind, title, children }: { kind: keyof typeof SHAPE; title: string; children: ReactNode }) {
  return (
    <section className="beat">
      <div className="beat-head"><span className={`shape ${SHAPE[kind]}`} aria-hidden="true" /><div><small>{LABEL[kind]}</small><h2>{title}</h2></div></div>
      {children}
    </section>
  );
}

/** Where the station sits in the course ("Day 2 · 2.1"), provided by the page around it. */
export const StationPlace = createContext<string | null>(null);

export function StationHead({ kicker, title, lead }: { kicker: string; title: string; lead: ReactNode }) {
  const place = useContext(StationPlace);
  // stations are numbered by course day; the topic is what follows the old "Station NN ·"
  const topic = kicker.replace(/^Station \d+\s*·\s*/, '');
  return <header className="station-head"><span className="kicker">{place ? `${place} · ${topic}` : kicker}</span><h1>{title}</h1><p>{lead}</p></header>;
}

/** The third layer: derivations, lavaan internals and reading — folded away until wanted. */
export function Deeper({ title = 'Under the hood', children }: { title?: string; children: ReactNode }) {
  return (
    <details className="deeper">
      <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>{title}</span></summary>
      <div className="deeper-body">{children}</div>
    </details>
  );
}

/** Multiple choice with a reveal. */
export function Choose({ question, options, answer, explain, onDone, children }: { question: string; options: string[]; answer: number; explain: ReactNode; onDone?: () => void; children?: ReactNode }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="card wonder">
      <p className="q">{question}</p>
      {children}
      <div className="choices">
        {options.map((o, i) => (
          <button key={i} className={`choice ${picked !== null && i === answer ? 'right' : ''} ${picked === i && i !== answer ? 'wrong' : ''}`}
            disabled={picked !== null} onClick={() => { setPicked(i); onDone?.(); }}>
            {picked !== null && i === answer ? '✓ ' : picked === i ? '✗ ' : ''}{o}
          </button>
        ))}
      </div>
      {picked !== null && <div className="reveal" role="status">{explain}</div>}
    </div>
  );
}

/** Numeric prediction on a slider, then the truth. */
export function Predict({ question, min, max, step, truth, format, explain, onDone, start }: {
  question: string; min: number; max: number; step: number; truth: number; start?: number; format: (v: number) => string; explain: (guess: number) => ReactNode; onDone?: () => void;
}) {
  const [v, setV] = useState(start ?? min);   // never start on the answer
  const [shown, setShown] = useState(false);
  return (
    <div className="card wonder">
      <p className="q">{question}</p>
      <div className="predict">
        <input type="range" min={min} max={max} step={step} value={v} disabled={shown} aria-label="Your prediction" onChange={e => setV(+e.target.value)} />
        <output>{format(v)}</output>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={shown} onClick={() => { setShown(true); onDone?.(); }}>{shown ? '✓ Revealed' : 'Lock in and reveal'}</button>
      </div>
      {shown && <div className="reveal" role="status">You said <b>{format(v)}</b>, the answer is <b>{format(truth)}</b>. {explain(v)}</div>}
    </div>
  );
}

export function Explain({ mood = 'explaining', children }: { mood?: Mood; children: ReactNode }) {
  return <div className="card explain"><Eta mood={mood} size={110} /><div>{children}</div></div>;
}

export function Tex({ children, block }: { children: string; block?: boolean }) {
  return <span dangerouslySetInnerHTML={{ __html: katex.renderToString(children, { displayMode: !!block, throwOnError: false }) }} />;
}

export function Formula({ children, plug }: { children: ReactNode; plug?: ReactNode }) {
  return <div className="card formula">{children}{plug && <div className="plug"><small style={{ color: 'var(--muted)', fontWeight: 700 }}>With the numbers you just made</small>{plug}</div>}</div>;
}

/** The last beat: the idea applied to the learner's project — and, where the day has one, the task in the studio. */
export function Yours({ children, task }: { children: ReactNode; task?: { id: string; label: string } }) {
  return (
    <div className="card yours">{children}
      <div className="row" style={{ margin: '12px 0 0', gap: 10 }}>
        {task && <a className="btn primary" href={`#/model?task=${task.id}`}>{task.label} →</a>}
        <a className={task ? 'btn' : ''} href="#/model">Open your project in the studio →</a>
      </div>
    </div>
  );
}

export function Slider({ label, min, max, step, value, onChange, format = v => v.toFixed(2) }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <label className="ctl"><span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
      <output>{format(value)}</output>
    </label>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><b>{value}</b></div>;
}

export const fmt = (v: number, d = 2) => (Number.isFinite(v) ? (v < 0 ? '−' : '') + Math.abs(v).toFixed(d) : '–');
export const sgn = (v: number, d = 3) => (v > 0.0005 ? '+' : v < -0.0005 ? '−' : '±') + Math.abs(v).toFixed(d);

/** Lower-triangle heatmap of a correlation or residual matrix. Cells can be clickable. */
export function MatrixView({ M, labels, mode, onCell, marked }: {
  M: Matrix; labels: string[]; mode: 'cor' | 'res'; onCell?: (i: number, j: number) => void; marked?: [number, number][];
}) {
  const p = labels.length;
  const bg = (v: number) => mode === 'res'
    ? (v >= 0 ? `rgba(29,158,117,${Math.min(0.85, Math.abs(v) * 14)})` : `rgba(216,90,48,${Math.min(0.85, Math.abs(v) * 14)})`)
    : `rgba(127,119,221,${Math.min(0.9, Math.abs(v) * 1.6)})`;
  const isMarked = (i: number, j: number) => marked?.some(([a, b]) => (a === i && b === j) || (a === j && b === i));
  return (
    <div className="mx" style={{ gridTemplateColumns: `64px repeat(${p}, 1fr)` }} role="table">
      <div className="h" />
      {labels.map(l => <div key={l} className="h">{l.slice(0, 9)}</div>)}
      {M.map((row, i) => [
        <div key={'r' + i} className="h" style={{ textAlign: 'left' }}>{labels[i].slice(0, 9)}</div>,
        ...row.map((v, j) => {
          if (j > i) return <div key={j} />;
          if (j === i) return <div key={j} className="h">·</div>;
          const txt = mode === 'res' ? sgn(v) : v.toFixed(2);
          return onCell
            ? <button key={j} className={isMarked(i, j) ? 'freed' : ''} style={{ background: bg(v) }} onClick={() => onCell(i, j)} aria-label={`${labels[i]} and ${labels[j]}: ${txt}`}>{txt}</button>
            : <div key={j} style={{ background: bg(v) }}>{txt}</div>;
        }),
      ])}
    </div>
  );
}

/** A failed load, with a way out: reloading fetches the outputs again. */
export function LoadError({ what, error }: { what: string; error: string }) {
  return (
    <div className="card load-err" role="alert">
      <p style={{ margin: 0 }}><b>{what} could not be loaded</b> ({error}). This is usually the connection.</p>
      <button className="btn" onClick={() => window.location.reload()}>Try again</button>
    </div>
  );
}
