// Day 1's project step: the learner's main construct as a measurement model — its items, why it is
// reflective, and whether the sample can carry it. Structured like the steps of Days 2–5, so the
// answers can go into the report as pre-commitments.
import { useEffect } from 'react';
import { Eta } from '../../eta/Eta.tsx';
import { analyse } from '../../model/diagram.ts';
import { markDone, type YourModel } from '../../state.ts';
import { MIN_REASON } from '../../studio/logbook.ts';

export const KINDS: { id: string; label: string; why: string }[] = [
  { id: 'reflective', label: 'Reflective: the construct causes the answers', why: 'Then a CFA fits: the items should correlate, and they are interchangeable indicators. Three items identify the factor; four let you test it.' },
  { id: 'formative', label: 'Formative: the answers make up the construct', why: 'Then a CFA is the wrong model — the items need not correlate, and dropping one changes what is measured. Use an index (or a composite) instead.' },
  { id: 'unsure', label: 'Not sure yet', why: 'Ask the test question of step 2: if the construct changed, would all items change together? Write down what makes you unsure; it is a question for your supervisor or a methods consultation.' },
];

export function ProjectDay1({ step, set, project, constructs }: {
  step: Record<string, string>; set: (a: Record<string, string>) => void; project: YourModel; constructs?: string;
}) {
  const a = analyse(project.diagram);
  const kind = KINDS.find(k => k.id === step.kind);
  const items = (step.items ?? '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
  const n = Number(step.n);
  const q = items.length ? 2 * items.length : 0;            // loadings (one fixed) + errors + factor variance
  const done = !!step.construct?.trim() && items.length >= 3 && !!kind && (step.why ?? '').trim().length >= MIN_REASON;
  useEffect(() => { if (done) markDone('d1-project'); }, [done]);
  return (
    <div className="ps-form">
      {constructs && <p className="hint ps-from0"><b>On Day 0 you wrote:</b> {constructs}</p>}
      <div className="row" style={{ gap: 12 }}>
        <label className="ps-field" style={{ flex: '1 1 160px' }}>Your main construct
          <input type="text" value={step.construct ?? ''} onChange={e => set({ construct: e.target.value })} placeholder="e.g. institutional trust" />
        </label>
        <label className="ps-field" style={{ flex: '3 1 260px' }}>Its items, separated by commas
          <input type="text" value={step.items ?? ''} onChange={e => set({ items: e.target.value })} placeholder="e.g. trstprl, trstlgl, trstplc, trstplt" />
        </label>
      </div>
      {items.length > 0 && <p className="hint" style={{ marginTop: 0 }}>{items.length} item{items.length === 1 ? '' : 's'}: p = {items.length * (items.length + 1) / 2} variances and covariances, q = {q} parameters, df = {items.length * (items.length + 1) / 2 - q}{items.length < 3 ? ' — not identified on its own: add items, or borrow from a second factor (Day 2)' : items.length === 3 ? ' — just identified: estimable, not testable' : ' — testable'}.</p>}
      <label className="ps-field">Reflective or formative?
        <select value={step.kind ?? ''} onChange={e => set({ kind: e.target.value })}>
          <option value="" disabled>Choose…</option>
          {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      </label>
      {kind && <div className="ps-eta"><Eta size={34} mood="explaining" /><p>{kind.why}</p></div>}
      <label className="ps-field">Why? One or two sentences about the items
        <textarea rows={2} value={step.why ?? ''} onChange={e => set({ why: e.target.value })} placeholder="e.g. someone who trusts institutions will trust parliament, the courts and the police alike — the items follow the construct." />
      </label>
      <label className="ps-field" style={{ maxWidth: 260 }}>Expected sample size n
        <input type="text" inputMode="numeric" value={step.n ?? ''} onChange={e => set({ n: e.target.value })} placeholder="e.g. 1,800" />
      </label>
      {n > 0 && q > 0 && <p className="hint" style={{ marginTop: 0 }}>N:q = {(n / q).toFixed(0)} : 1 {n / q >= 10 ? '— comfortable (rule of thumb: at least 10 : 1, n ≥ 200)' : n / q >= 5 ? '— tight: watch for estimation problems' : '— too small for a stable CFA of this size'}.{a.s.latent.length ? '' : ' Draw the model in your project when you like — the studio counts df for you.'}</p>}
      {done && <p className="ps-done">✓ Step 1 done</p>}
    </div>
  );
}
