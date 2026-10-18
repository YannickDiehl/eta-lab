// Day 3's own parts besides the script: the project step (all constructs in one measurement
// model, its df, the restriction the analysis needs, and where cross-loadings or error
// covariances could be defended — named before any index) and the self-check.
import { useEffect } from 'react';
import { Choose } from '../components/ui.tsx';
import { Eta } from '../eta/Eta.tsx';
import { analyse } from '../model/diagram.ts';
import { markDone, type YourModel } from '../state.ts';
import { MIN_REASON } from '../studio/logbook.ts';

// ---------------------------------------------------------------- the project step
export const USES: { id: string; label: string; why: string }[] = [
  { id: 'latent', label: 'Latent variables only — the SEM does all the work', why: 'Then the congeneric model is enough: every item keeps its own loading and error. No restriction is needed — test one only if your theory claims it.' },
  { id: 'sum', label: 'Sum or mean scores of the items', why: 'A sum score weights every item equally. That is defensible when the items are tau-equivalent — test it. If it fails, report omega rather than alpha, and consider factor scores or the latent model.' },
  { id: 'short', label: 'A shorter scale: some items replace others', why: 'Interchangeable items are parallel: equal loadings and equal error variances. Test the parallel model before you drop items.' },
];

export function ProjectDay3({ step, set, project }: {
  step: Record<string, string>; set: (a: Record<string, string>) => void; project: YourModel;
}) {
  const a = analyse(project.diagram);
  const use = USES.find(u => u.id === step.use);
  const drawn = a.s.latent.length >= 2;
  const done = !!use && (step.overlap ?? '').trim().length >= MIN_REASON;
  useEffect(() => { if (done) markDone('d3-project'); }, [done]);
  return (
    <div className="ps-form">
      <div className="ps-eta">
        <Eta size={34} mood={drawn ? 'pleased' : 'explaining'} />
        <p>{drawn
          ? <>Your project has <b>{a.s.latent.length} factors</b> and {a.p} observed variables: df = <b>{a.df}</b>{a.df < 0 ? ' — not identified: add items, or constraints' : a.df === 0 ? ' — just identified: nothing to test' : ' — testable'}. Factors with two items borrow their identification from the correlations with the others.</>
          : <>Draw <b>all</b> constructs of your question in your project, each with its items, and let them correlate: the simultaneous measurement model. The studio counts df without data.</>}</p>
      </div>
      <label className="ps-field">How will you use your constructs in the analysis?
        <select value={step.use ?? ''} onChange={e => set({ use: e.target.value })}>
          <option value="" disabled>Choose…</option>
          {USES.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
        </select>
      </label>
      {use && <p className="hint ps-from0">{use.why}</p>}
      <label className="ps-field">Before you estimate: where could an item belong to two constructs, or two items share something beyond their factor — and why?
        <textarea rows={3} value={step.overlap ?? ''} onChange={e => set({ overlap: e.target.value })}
          placeholder="e.g. item 2 of trust and item 1 of satisfaction both mention “the government” — a possible error covariance. No cross-loadings: the constructs are asked in separate blocks." />
      </label>
      <p className="hint" style={{ marginTop: 4 }}>Like the list of acceptable changes on Day 2: what you name here needs no new justification later.</p>
      {done && <p className="ps-done">✓ Step 3 done</p>}
    </div>
  );
}

// ---------------------------------------------------------------- check it
export function CheckDay3() {
  return (
    <div className="check-day">
      <Choose question="The tau-equivalent model fits clearly worse than the congeneric one. What follows for a sum score of the items?"
        options={['Nothing — sum scores do not depend on the model.', 'The items are not equally good measures: an unweighted sum treats them as if they were, and alpha underestimates its reliability.', 'The items do not measure one construct.']} answer={1}
        explain="Tau-equivalence is the claim behind an unweighted sum and behind Cronbach’s alpha. If it fails, the items still measure one construct (the congeneric model fits) — but with different strength. Report omega, and prefer the latent variable." />
      <Choose question="A factor has only two items. Can it be estimated?"
        options={['No, never.', 'Not on its own (df = −1) — but with an equality constraint, or inside a model where it correlates with other factors.', 'Yes, like any other factor.']} answer={1}
        explain="Two items give three numbers for four parameters. An equality (λ₁ = λ₂) or the correlations with other factors supply the missing information — empirically, as long as those correlations are not near zero." />
      <Choose question="In the simultaneous CFA, the largest modification index is a cross-loading. What does freeing it claim?"
        options={['That the two items share their wording.', 'That the item measures a second construct as well — and the meaning of the second factor changes.', 'Nothing about the constructs; only the fit improves.']} answer={1}
        explain="A cross-loading changes what a factor is: the item now carries part of two constructs, and the factor correlations change with it. An error covariance leaves the factors as they are. Either needs a reason about the item." />
    </div>
  );
}
