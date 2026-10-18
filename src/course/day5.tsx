// Day 5's own parts besides the script: the project step (will you compare means — and what does
// that require; the reporting checklist for the measurement model) and the self-check of Part 1.
import { useEffect } from 'react';
import { Choose } from '../components/ui.tsx';
import { Eta } from '../eta/Eta.tsx';
import { markDone } from '../state.ts';

// ---------------------------------------------------------------- the project step
export const PLANS: { id: string; label: string; why: string }[] = [
  { id: 'none', label: 'No mean comparisons — relations only', why: 'Then metric invariance is enough for groups (Day 4), and no level is needed within one population. Say so in your report.' },
  { id: 'latent', label: 'Latent means across groups', why: 'You need scalar invariance — full, or partial with at least two anchor items per factor. Report the anchors and how the comparison changes with other anchors; with many groups consider alignment.' },
  { id: 'time', label: 'Means over time (the same people twice or more)', why: 'The same ladder, across waves instead of groups: longitudinal invariance (Day 9). Scalar across waves before you compare.' },
  { id: 'scores', label: 'Mean or sum scores', why: 'Sum scores need more than latent means: equal loadings and intercepts, and — for the same reliability — equal error variances (strict invariance). If that fails, compare latent means instead.' },
];
export const REPORT = [
  'The model: constructs, items, fixed loadings, every cross-loading or error covariance and its reason — with a path diagram.',
  'The data: sample, missing answers and how they were handled, the distribution of the items, the estimator and why.',
  'Software, version and the code (or a link to it).',
  'Identification: p, q and df.',
  'Global fit: χ² with df and p, CFI, TLI, RMSEA (with its interval), SRMR — and the cut-offs you used.',
  'Local fit: residuals and modification indices; every change to the model, in order, with its reason.',
  'The estimates: standardized loadings, factor correlations, reliabilities (ω), with standard errors.',
  'Groups: the invariance sequence, the level reached, the anchors of a partial model.',
  'What the model shows — and what it cannot show.',
];

export function ProjectDay5({ step, set }: { step: Record<string, string>; set: (a: Record<string, string>) => void }) {
  const plan = PLANS.find(p => p.id === step.plan);
  const ticked = REPORT.filter((_, i) => step[`r${i}`] === 'yes').length;
  const done = !!plan && ticked >= 5;
  useEffect(() => { if (done) markDone('d5-project'); }, [done]);
  return (
    <div className="ps-form">
      <label className="ps-field">Will your question compare means?
        <select value={step.plan ?? ''} onChange={e => set({ plan: e.target.value })}>
          <option value="" disabled>Choose…</option>
          {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      {plan && <div className="ps-eta"><Eta size={34} mood="explaining" /><p>{plan.why}</p></div>}
      <p className="ps-title" style={{ marginTop: 12 }}><b>Reporting your measurement model</b> — what your report will contain. Tick what you can already write for your project:</p>
      <div className="report-list">
        {REPORT.map((r, i) => <label key={i} className="chk"><input type="checkbox" checked={step[`r${i}`] === 'yes'} onChange={e => set({ [`r${i}`]: e.target.checked ? 'yes' : '' })} /> {r}</label>)}
      </div>
      <p className="hint" style={{ marginTop: 4 }}>After Brown (2015, pp. 127–129). The studio writes most of it for you: lavaan tab → Report .qmd, with your logbook. {ticked} of {REPORT.length} ticked.</p>
      {done && <p className="ps-done">✓ Step 5 done</p>}
    </div>
  );
}

// ---------------------------------------------------------------- check it
export function CheckDay5() {
  return (
    <div className="check-day">
      <Choose question="Two countries differ by .3 points in the mean score of four items. What do you need before you call that a difference in the construct?"
        options={['Nothing — the items measure the construct.', 'Scalar invariance: equal loadings and intercepts, at least partially with two anchors. Otherwise the difference may be in the items.', 'Configural invariance is enough.']} answer={1}
        explain="A mean difference in the items is the latent difference plus differences in the intercepts. Only with equal intercepts (and loadings) does it speak for the construct. For a mean score that means full scalar invariance of every item; equal error variances (strict invariance) matter only when you compare its variance, reliability or a standardized difference." />
      <Choose question="A second-order factor over three first-order factors fits exactly as well as the three correlated factors. Why?"
        options={['Because the second-order factor is wrong.', 'Because with three first-order factors the second-order part is just identified: three correlations, three parameters. It adds an interpretation, not a test.', 'Because lavaan fixed the second-order loadings.']} answer={1}
        explain="Three factor correlations are reproduced exactly by two free second-order loadings and one variance. With four or more first-order factors the second-order model makes testable claims." />
      <Choose question="Alignment gives you latent means for three countries without any equality constraint. When can you trust them?"
        options={['Always — alignment needs no invariance.', 'When most loadings and intercepts are approximately equal after alignment (rule of thumb: no more than about a quarter differ substantially); otherwise the means rest on a few anchors, as in section 3.', 'When sirt’s R² is above .98.']} answer={1}
        explain="Alignment replaces the equality constraints by an assumption: approximate invariance for most parameters. In section 3 only one intercept ends up equal — the means are a sensitivity analysis, not a solution. sirt’s R² is near 1 almost always." />
      <Choose question="With three traits and three methods, the method-factor model (CT-UM) and the correlated-uniqueness model (CU) have the same χ². What follows?"
        options={['They are equivalent here: the fit cannot choose between them, only the reason for the method effect can.', 'CU is better because it has fewer parameters.', 'One of them is misspecified.']} answer={0}
        explain="A method factor over three items is just identified, like the three covariances among them. With more traits a method factor claims one effect shared by all items of a format; CU allows a different effect for every pair." />
      <Choose question="Six modifications, each taking the largest index at the time, bring χ² down to a fifth. What do you report?"
        options={['The final model — it fits well.', 'All six steps with their reasons, which were planned beforehand, and — if possible — whether the steps hold in new data.', 'Only the steps that improved CFI by more than .01.']} answer={1}
        explain="Every step chosen by the data it is tested on capitalizes on chance. The early steps of a cascade often replicate, the late ones rarely (section 2). Report the path, and separate the changes you can argue from those the index found." />
    </div>
  );
}
