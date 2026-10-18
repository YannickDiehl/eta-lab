// Day 4's own parts besides the script: the project step (which comparison your question needs,
// which level that takes, which items might be read differently — decided before testing) and
// the self-check.
import { useEffect } from 'react';
import { Choose } from '../components/ui.tsx';
import { Eta } from '../eta/Eta.tsx';
import { analyse } from '../model/diagram.ts';
import { NO_GROUPS, type Level } from '../model/invariance.ts';
import { markDone, type YourModel } from '../state.ts';
import { MIN_REASON } from '../studio/logbook.ts';

// ---------------------------------------------------------------- the project step
export const COMPARE: { id: string; label: string; level: Level | null; why: string }[] = [
  { id: 'none', label: 'Nothing across groups — one population', level: null, why: 'Then you need no ladder. Say so in one sentence in your report: why one group is enough.' },
  { id: 'relations', label: 'Relations: correlations or regression paths', level: 'metric', why: 'Equal loadings make the factor’s unit the same everywhere, so covariances and unstandardized paths can be compared (Day 8 builds on this).' },
  { id: 'means', label: 'Means of the construct', level: 'scalar', why: 'Equal loadings and intercepts: people with the same value of the construct give the same average answer. Partial invariance needs at least two anchor items.' },
  { id: 'sums', label: 'Observed sum or mean scores', level: 'scalar', why: 'For their means: full scalar invariance of every item in the score — partial invariance is not enough, because a released item shifts the sum. If you also compare their variances, correlations or standardized differences (Cohen’s d), you need strict invariance. Usually it is better to compare latent means.' },
];

export function ProjectDay4({ step, set, project, updateProject }: {
  step: Record<string, string>; set: (a: Record<string, string>) => void; project: YourModel; updateProject: (p: Partial<YourModel>) => void;
}) {
  const cmp = COMPARE.find(c => c.id === step.compare);
  const names = (step.groups ?? '').split(',').map(x => x.trim()).filter(Boolean);
  const done = !!cmp && (cmp.level === null || (names.length > 1 && (step.items ?? '').trim().length >= MIN_REASON));
  useEffect(() => { if (done) markDone('d4-project'); }, [done]);
  const a = analyse(project.diagram);
  const set_up = project.groups.on && project.groups.names.join(',') === names.join(',') && project.groups.level === cmp?.level;
  return (
    <div className="ps-form">
      <label className="ps-field">What will your question compare across groups?
        <select value={step.compare ?? ''} onChange={e => set({ compare: e.target.value })}>
          <option value="" disabled>Choose…</option>
          {COMPARE.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      {cmp && (
        <div className="ps-eta">
          <Eta size={34} mood="explaining" />
          <p>{cmp.level ? <><b>You need {cmp.level} invariance.</b> </> : null}{cmp.why}</p>
        </div>
      )}
      {cmp?.level && (
        <>
          <div className="row" style={{ gap: 12, alignItems: 'end' }}>
            <label className="ps-field" style={{ flex: '1 1 160px' }}>Grouping variable
              <input type="text" value={step.variable ?? ''} onChange={e => set({ variable: e.target.value })} placeholder="e.g. cntry, gndr, wave" />
            </label>
            <label className="ps-field" style={{ flex: '3 1 260px' }}>Groups, separated by commas
              <input type="text" value={step.groups ?? ''} onChange={e => set({ groups: e.target.value })} placeholder="e.g. BE, LU, NL" />
            </label>
          </div>
          <label className="ps-field">Before you test: which of your items might be read differently in these groups — and why?
            <textarea rows={3} value={step.items ?? ''} onChange={e => set({ items: e.target.value })}
              placeholder="e.g. item 3 asks about “the government”, which means a different institution in each country." />
          </label>
          <p className="hint" style={{ marginTop: 4 }}>The items you name here are the only ones you may release later without a new justification. The others are your anchors.</p>
          {names.length > 1 && (
            <button className="tool" disabled={set_up || !a.s.latent.length} onClick={() => updateProject({ groups: { ...NO_GROUPS, on: true, variable: (step.variable ?? '').trim() || 'group', names, level: cmp.level!, free: [] } })}>
              {set_up ? '✓ Your project has the ladder' : a.s.latent.length ? `Set up the ${cmp.level} ladder in my project (${names.length} groups)` : 'Draw a factor in your project first'}
            </button>
          )}
        </>
      )}
      {done && <p className="ps-done">✓ Step 4 done</p>}
    </div>
  );
}

// ---------------------------------------------------------------- check it
const CHECKLIST = [
  'Each group’s model fits on its own before you compare groups.',
  'Each rung is compared with the one below it — ΔCFI ≥ −.010 (n > 300), and χ² reported.',
  'Every released equality has a reason about the item, written before or at the release.',
  'At least two anchors per factor remain equal; you name them in the report.',
  'If means are compared: show how they change with other anchors.',
];

export function CheckDay4() {
  return (
    <div className="check-day">
      <div className="card checklist">
        <p><b>Before you compare groups</b></p>
        <ol>{CHECKLIST.map(c => <li key={c}>{c}</li>)}</ol>
      </div>
      <Choose question="Metric invariance holds, scalar does not. Which comparison is still allowed?"
        options={['None — the measurement is not invariant.', 'Correlations and regression paths between the factor and other variables.', 'The latent means, if you report the fit.']} answer={1}
        explain="Equal loadings give the factor the same unit everywhere, so relations can be compared. Means need equal intercepts too — fully, or partially with at least two anchors." />
      <Choose question="Freeing one intercept lowers χ² by 280. Is that enough reason to release it?"
        options={['Yes — the score test shows that the equality does not hold.', 'Only together with a reason about the item: why would it be answered differently in these groups?', 'No — intercepts should never be released.']} answer={1}
        explain="The test says that the item’s intercept differs, not why. Without a reason about wording, translation or meaning, a release just fits the sample — and it changes the very means you want to compare." />
      <Choose question="With different anchors, the Dutch mean moves from −.52 to −.30 SD. What do you report?"
        options={['The model with the better fit.', 'Both, with the anchors named, and an argument for the one you trust.', 'Neither — partial invariance is not valid.']} answer={1}
        explain="Partial invariance is legitimate (Byrne, Shavelson & Muthén, 1989), but the comparison rests on the anchors. Readers need to see that dependence. With many groups, alignment estimates the means under the least non-invariance." />
      <Choose question="Metric invariance means …"
        options={['… all four items have the same loading.', '… each item has the same loading in every country — the four items may still differ from each other.', '… the countries have the same latent mean.']} answer={1}
        explain="Equal across groups, item by item. Equal across the items of one construct is tau-equivalence (Day 3). The two are easy to confuse because both are written with equal loadings." />
    </div>
  );
}
