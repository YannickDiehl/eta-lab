// The task card floats over the sheet: steps, a guess before the numbers, strict checks for the
// mechanics, a reason for every decision, and η reading back what changed. It can be folded away
// at any time — the studio underneath stays a free sandbox.
import { useEffect, useState } from 'react';
import { Eta } from '../eta/Eta.tsx';
import { markDone } from '../state.ts';
import { MIN_REASON, type Change } from './logbook.ts';
import { currentStep, type Task, type TaskContext } from './tasks.ts';

/** Changes and their reasons — in the card's decision step and in Results. */
export function Logbook({ changes, reasons, onReason, compact }: { changes: Change[]; reasons: Record<string, string>; onReason: (key: string, text: string) => void; compact?: boolean }) {
  if (!changes.length) return compact ? null : <p className="hint">No changes against the course model yet. Every parameter you add or remove appears here and asks for one sentence of reason.</p>;
  return (
    <ul className="logbook">
      {changes.map(c => {
        const r = reasons[c.key] ?? '', ok = r.trim().length >= MIN_REASON;
        return (
          <li key={c.key} className={ok ? 'ok' : ''}>
            <span className="lb-what"><b>{c.sign}</b> {c.text}</span>
            <textarea rows={2} value={r} placeholder={c.key.startsWith('release:') ? 'Why does this item work differently across the groups? One sentence.' : 'Why does this belong in the model? One sentence.'} aria-label={`Reason for ${c.text}`}
              onChange={e => onReason(c.key, e.target.value)} />
          </li>
        );
      })}
    </ul>
  );
}

const PANEL = { results: 'Results', groups: 'Groups', code: 'lavaan' } as const;

export function TaskCard({ task, ctx, setAnswer, onReason, onKeepCourse, onClose, onPanel, onRestart }: {
  task: Task; ctx: TaskContext; onPanel?: (tab: 'results' | 'groups' | 'code') => void; onRestart?: () => void;
  setAnswer: (step: string, value: string) => void;
  onReason: (key: string, text: string) => void;
  onKeepCourse: () => void; onClose: () => void;
}) {
  const cur = currentStep(task, ctx);
  const [open, setOpen] = useState<number | null>(null);
  const [folded, setFolded] = useState(() => window.innerWidth < 700);
  const [hint, setHint] = useState<Record<string, boolean>>({});
  const shown = open ?? Math.min(cur, task.steps.length - 1);
  const done = cur >= task.steps.length;
  useEffect(() => { if (done) markDone(task.id); }, [done, task.id]);

  if (folded) return (
    <button className="task-pill" onClick={() => setFolded(false)} aria-label="Show the task">
      <Eta size={22} mood={done ? 'pleased' : 'thinking'} /> Day {task.day} · {done ? 'done ✓' : `step ${cur + 1} of ${task.steps.length}`}
    </button>
  );

  return (
    <section className="task-card" aria-label={`Task: ${task.title}`}>
      <header>
        <small>Day {task.day} · course exercise</small>
        <div className="task-x">
          {onRestart && <button onClick={() => { if (window.confirm('Start this task over? Your answers and changes to the model are cleared.')) onRestart(); }} aria-label="Start the task over" title="Start over">↺</button>}
          <button onClick={() => setFolded(true)} aria-label="Fold the task away" title="Fold away">–</button>
          <button onClick={onClose} aria-label="Leave the task" title="Leave the task (your work stays)">×</button>
        </div>
        <h3>{task.title}</h3>
      </header>
      <ol className="task-steps">
        {task.steps.map((s, i) => {
          const passed = i < cur || (s.check ? s.check(ctx) === true : false) && (!s.choice?.(ctx) || ctx.answers[s.id] !== undefined);
          const isOpen = i === shown;
          const choice = isOpen && s.choice ? s.choice(ctx) : null;
          const picked = ctx.answers[s.id] !== undefined ? Number(ctx.answers[s.id]) : null;
          const check = isOpen && s.check ? s.check(ctx) : true;
          const mirror = isOpen && s.mirror ? s.mirror(ctx) : null;
          return (
            <li key={s.id} className={`${passed ? 'passed' : ''} ${isOpen ? 'open' : ''} ${i === cur ? 'current' : ''}`}>
              <button className="ts-head" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}>
                <span className="ts-dot" aria-hidden="true">{passed ? '✓' : i + 1}</span>{s.title}
              </button>
              {isOpen && (
                <div className="ts-body">
                  <p>{s.prompt(ctx)}</p>
                  {s.panel && onPanel && <button className="tool ts-panel" onClick={() => onPanel(s.panel!)}>Open {PANEL[s.panel]} →</button>}
                  {s.hint && task.support === 'full' && (hint[s.id]
                    ? <p className="ts-hint">{s.hint}</p>
                    : <button className="linkish" onClick={() => setHint(h => ({ ...h, [s.id]: true }))}>Hint</button>)}
                  {choice && (
                    <div className="ts-choice">
                      <p className="ts-q">{choice.question}</p>
                      {choice.options.map((o, k) => (
                        <button key={k} disabled={picked !== null}
                          className={`choice ${choice.answer === undefined ? (picked === k ? 'right' : '') : `${picked !== null && k === choice.answer ? 'right' : ''} ${picked === k && k !== choice.answer ? 'wrong' : ''}`}`}
                          onClick={() => { setAnswer(s.id, String(k)); setOpen(i); }}>{o}</button>
                      ))}
                      {picked !== null && <p className="ts-eta"><Eta size={22} mood="explaining" /> <span>{choice.explain(ctx, picked)}</span></p>}
                    </div>
                  )}
                  {s.decide && (
                    ctx.changes.length
                      ? <Logbook changes={ctx.changes} reasons={ctx.reasons} onReason={onReason} />
                      : <label className="ts-keep">{s.keepLabel ?? 'Or keep the course model, because…'}
                          <textarea rows={2} value={ctx.answers.keep ?? ''} onChange={e => setAnswer('keep', e.target.value)} placeholder="One sentence: why no parameter should be added." />
                          <small>{(ctx.answers.keep ?? '').trim().length < MIN_REASON ? `at least ${MIN_REASON} characters` : '✓'}</small>
                        </label>
                  )}
                  {s.action === 'keep-course-model' && <button className="tool" onClick={onKeepCourse} disabled={ctx.snapshots > 0}>{ctx.snapshots > 0 ? '✓ Kept for comparison' : 'Keep the course model for comparison'}</button>}
                  {s.action === 'confirm-r' && (
                    <label className="chk"><input type="checkbox" checked={ctx.answers.r === 'done'} onChange={e => setAnswer('r', e.target.checked ? 'done' : '')} /> I ran it in R and the ML numbers match</label>
                  )}
                  {mirror && <p className="ts-eta"><Eta size={22} mood="pleased" /> <span>{mirror}</span></p>}
                  {check !== true && <p className="ts-wait">{check}</p>}
                  {s.deeper && <a className="ts-deeper" href={s.deeper.href}>{s.deeper.label} →</a>}
                  {i < cur && i < task.steps.length - 1 && <div><button className="btn primary ts-next" onClick={() => setOpen(Math.min(cur, task.steps.length - 1))}>Next step →</button></div>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {done && (
        <div className="ts-done">
          <Eta size={30} mood="pleased" />
          <p>Done. Your reasons are in the logbook, the lavaan code and the report. <a href={`#/day/${task.day}#project`}>Next: your own project, Day {task.day} →</a></p>
        </div>
      )}
    </section>
  );
}
