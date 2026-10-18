// Day 2's own parts besides the script: the project step (estimator, and the changes you would
// accept — decided before looking at any index), the shared code block, and the self-check.
import { useEffect, useState } from 'react';
import { Choose } from '../components/ui.tsx';
import { Eta } from '../eta/Eta.tsx';
import type { ROptions } from '../model/diagram.ts';
import { markDone, type YourModel } from '../state.ts';
import { MIN_REASON } from '../studio/logbook.ts';
import { chooseEstimator, PILE_UP_TEXT, type Categories } from '../math/estimatorRule.ts';

// ---------------------------------------------------------------- the project step
const FORMATS: { id: string; label: string; cats: Categories | null; piled: boolean }[] = [
  { id: 'cont', label: '7 or more categories (or a 0–10 scale)', cats: '7+', piled: false },
  { id: 'five-sym', label: `5–6 ordered categories, not piled up (no end category above 40 %)`, cats: '5–6', piled: false },
  { id: 'five-skew', label: `5–6 ordered categories, ${PILE_UP_TEXT}`, cats: '5–6', piled: true },
  { id: 'four', label: '4 ordered categories, not piled up', cats: '4', piled: false },
  { id: 'four-skew', label: '4 ordered categories, piled up at one end', cats: '4', piled: true },
  { id: 'few', label: '2–3 ordered categories', cats: '2–3', piled: false },
  { id: 'unknown', label: 'I do not know yet', cats: null, piled: false },
];
const MISSING: { id: string; label: string; fiml: boolean }[] = [
  { id: 'none', label: 'Hardly any missing answers', fiml: false },
  { id: 'some', label: 'Some (a few percent per item)', fiml: true },
  { id: 'many', label: 'Many, or whole blocks missing', fiml: true },
  { id: 'unknown', label: 'I do not know yet', fiml: false },
];

export function ProjectDay2({ step, set, project, updateProject }: {
  step: Record<string, string>; set: (a: Record<string, string>) => void; project: YourModel; updateProject: (p: Partial<YourModel>) => void;
}) {
  const fmt = FORMATS.find(f => f.id === step.format), miss = MISSING.find(m => m.id === step.missing);
  const advice = fmt?.cats ? chooseEstimator(fmt.cats, fmt.piled) : null;
  const rec: ROptions | null = advice ? { estimator: advice.estimator, missing: miss?.fiml ? 'fiml' : 'listwise' } : null;
  const applied = rec && project.r?.estimator === rec.estimator && project.r?.missing === rec.missing;
  const done = !!fmt && (step.accept ?? '').trim().length >= MIN_REASON;
  useEffect(() => { if (done) markDone('d2-project'); }, [done]);
  return (
    <div className="ps-form">
      <label className="ps-field">How are your items answered?
        <select value={step.format ?? ''} onChange={e => set({ format: e.target.value })}>
          <option value="" disabled>Choose the answer format…</option>
          {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </label>
      <label className="ps-field">Missing answers?
        <select value={step.missing ?? ''} onChange={e => set({ missing: e.target.value })}>
          <option value="" disabled>Choose…</option>
          {MISSING.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>
      {fmt && (
        <div className="ps-eta">
          <Eta size={34} mood="explaining" />
          <div>
            <p>{rec ? <><b>{rec.estimator}{rec.missing === 'fiml' ? (rec.estimator === 'WLSMV' ? ' with pairwise deletion' : ' with FIML') : ''}.</b> </> : null}{advice ? `${advice.why}${advice.check ? ` Check with ${advice.check} too.` : ''}` : 'Decide when you see the questionnaire: number of categories first, then how the answers are spread (frq() shows it).'}
              {miss?.fiml && rec?.estimator !== 'WLSMV' && ' FIML lets every respondent count with the answers they gave, instead of dropping incomplete cases.'}</p>
            {rec && <button className="tool" disabled={!!applied} onClick={() => updateProject({ r: rec })}>{applied ? `✓ Your project’s R code uses ${rec.estimator}` : `Use ${rec.estimator}${rec.missing === 'fiml' ? ' + ' + (rec.estimator === 'WLSMV' ? 'pairwise' : 'FIML') : ''} in my project’s R code`}</button>}
          </div>
        </div>
      )}
      <label className="ps-field">Before you look at any modification index: which changes to your model would you accept — and why?
        <textarea rows={3} value={step.accept ?? ''} onChange={e => set({ accept: e.target.value })}
          placeholder="e.g. a residual covariance between items 3 and 4, because both are worded negatively. No cross-loadings: the constructs are defined apart." />
      </label>
      <p className="hint" style={{ marginTop: 4 }}>This list is your defence against index fishing: a change you name in advance needs no excuse later. It goes into your report.</p>
      {done && <p className="ps-done">✓ Step 2 done</p>}
    </div>
  );
}

// ---------------------------------------------------------------- in R
export function Code({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-box">
      <button className="tool" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } }}>{copied ? '✓ Copied' : 'Copy'}</button>
      <pre className="syntax"><code>{code}</code></pre>
    </div>
  );
}

// ---------------------------------------------------------------- check it

export function CheckDay2() {
  return (
    <div className="check-day">
      <p className="hint" style={{ marginTop: 0 }}>The checklist before you trust a CFA — your own, or one an AI assistant drafted — is in <a href="#/day/2#s7">section 7 of the script</a>.</p>
      <Choose question="A model has CFI = .97, RMSEA = .04 and a significant χ² with n = 5,000. Does it fit?"
        options={['No — χ² rejects it.', 'Yes — with n = 5,000 even trivial misfit makes χ² significant; CFI and RMSEA say close fit.', 'Cannot be judged without the residuals.']} answer={1}
        explain="χ² tests exact fit and grows with n. Report it, but judge with CFI, RMSEA and SRMR together — and look at the largest residuals before you write “good fit”." />
      <Choose question="Your Likert items have four categories and most people tick the top two. Which estimator?"
        options={['ML — it is the default.', 'MLR — it corrects for non-normality.', 'WLSMV — treat the items as ordinal.']} answer={2}
        explain="With four skewed categories, Pearson correlations are noticeably too small (station 2.4), and MLR cannot repair that: it corrects standard errors, not correlations. WLSMV models the thresholds." />
      <Choose question="The largest modification index suggests a residual covariance between two items. What do you do first?"
        options={['Free it — the fit will improve.', 'Read both item texts and ask what they share beyond the factor.', 'Drop one of the two items.']} answer={1}
        explain="An index says where the model strains, not why. Free the covariance only if the items share something you can name — wording, format, a substantive overlap — and write it into the logbook." />
    </div>
  );
}
