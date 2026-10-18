// Task cards: the course exercise of a day, laid over the free studio. A card is a lens, not a
// lock — the sheet stays fully editable, and the card only reads what the learner does.
//   strict checks   mechanics only (estimated, identified, df > 0, a reason written)
//   reflective      decisions: any answer counts once it is argued; η mirrors what changed
//   predict         a guess before the numbers — the sandbox stays a place to discover
import type { Analysis, Diagram } from '../model/diagram.ts';
import type { Fitted, FitError, ModIndex } from '../math/sem.ts';
import type { Groups, Level, Lock } from '../model/invariance.ts';
import type { DataChoice } from '../state.ts';
import { CUTOFF_TEXT, CUTOFFS, fitVerdict } from '../math/cutoffs.ts';
import { describeMI } from './Diagnostics.tsx';
import { hasReason, type Change } from './logbook.ts';

export interface TaskContext {
  a: Analysis; d: Diagram; base?: Diagram;
  fit: Fitted | null; baseFit: Fitted | null;
  changes: Change[]; reasons: Record<string, string>;
  answers: Record<string, string>; snapshots: number;
  label: (name: string) => string;               // a variable's question text
  // with groups: the ladder as set up, every rung's fit, and a way to try other releases
  g?: Groups; locks?: Lock[]; rungs?: (Fitted | FitError)[] | null;
  refit?: (level: Level, free: string[], stdlv?: boolean) => Fitted | null;
}

export interface Choice { question: string; options: string[]; answer?: number; explain: (c: TaskContext, picked: number) => string }

export interface Step {
  id: string;
  title: string;
  prompt: (c: TaskContext) => string;
  hint?: string;
  /** a multiple choice inside the card (predict, judge, find) */
  choice?: (c: TaskContext) => Choice | null;
  /** strict: may the learner move on? returns a message while not yet */
  check?: (c: TaskContext) => true | string;
  /** η reads back what the learner did */
  mirror?: (c: TaskContext) => string | null;
  /** the decision step: shows the logbook for the changes, or a "keep" reason */
  decide?: boolean;
  keepLabel?: string;
  /** buttons the card offers */
  action?: 'keep-course-model' | 'confirm-r';
  /** the side panel the step works in: the card offers a button that opens it */
  panel?: 'results' | 'groups' | 'code';
  deeper?: { href: string; label: string };
}

export interface Task {
  id: string; day: number; title: string; question: string;
  syntax: string; data: Extract<DataChoice, { source: 'course' }>;
  groups?: Omit<Groups, 'free'>;                  // a multi-group task: the ladder it starts with
  support: 'full' | 'goal';                       // fading: hints and checks shrink over the days
  steps: Step[];
}

const f3 = (v: number) => v.toFixed(3).replace(/^0\./, '.').replace(/^-0\./, '−.');
const topMI = (fit: Fitted | null, d: Diagram): ModIndex[] => (fit ? fit.mi.filter(q => Number.isFinite(q.mi) && q.mi >= 3.84)
  .filter(q => { const x = describeMI(q, d); return !(x.kind === 'free' && x.edge && x.edge.fix === undefined); }) : []);
const itemsIn = (d: Diagram, q: ModIndex) => [q.lhs, q.rhs].map(id => d.nodes.find(n => n.id === id)).filter(n => n?.kind === 'observed').map(n => n!.label);


// ---- Day 4: the ladder
const okRungs = (c: TaskContext) => (c.rungs && c.rungs.every(r => r.ok) ? c.rungs as Fitted[] : null);
const sgn3 = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3).replace(/^0\./, '.')}`;
/** The highest rung whose step costs less than ΔCFI −.010 (0 configural … 3 strict). */
function holdsUpTo(r: Fitted[]) { let k = 0; for (let i = 1; i < r.length; i++) { if (r[i].cfi - r[i - 1].cfi >= -CUTOFFS.deltaCfi) k = i; else break; } return k; }
const itemOf = (c: TaskContext, nodeId: string) => c.d.nodes.find(n => n.id === nodeId)?.label ?? nodeId;
const interceptLocks = (c: TaskContext) => (c.locks ?? []).filter(l => l.kind === 'intercept');
const lockFor = (c: TaskContext, item: string) => interceptLocks(c).find(l => itemOf(c, l.node) === item);
/** The factor means by group (with std.lv: in standard deviations of the first group). */
const latentMeans = (f: Fitted | null) => (f ? f.params.filter(p => p.op === '~1' && f.params.some(q => q.op === '=~' && q.lhs === p.lhs)).sort((a, b) => a.group - b.group).map(p => p.est) : []);

// ---- Day 3: three constructs at once
const nodeLabel = (d: Diagram, id: string) => d.nodes.find(n => n.id === id)?.label ?? id;
/** The standardized correlation of two factors, by their names. */
function factorCor(f: Fitted | null, d: Diagram, a: string, b: string) {
  const p = f?.params.find(x => x.op === '~~' && x.lhs !== x.rhs && [nodeLabel(d, x.lhs), nodeLabel(d, x.rhs)].sort().join() === [a, b].sort().join());
  return p ? p.std : null;
}
const d2s = (v: number) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2).replace(/^0\./, '.');

export const TASKS: Task[] = [
  {
    id: 'd1-one-or-two', day: 1, support: 'full',
    title: 'One value or two?',
    question: 'Are tradition and conformity two values in the Netherlands — or one?',
    syntax: 'Tradition =~ imptrad + ipmodst\nConformity =~ ipfrule + ipbhprp',
    data: { source: 'course', round: 'ess2004', sample: 'NL', grouping: 'none' },
    steps: [
      {
        id: 'predict', title: 'Guess first',
        prompt: () => 'In Schwartz’s theory tradition and conformity are neighbours on the circle of values. Here they are two factors with two items each, and the factors correlate. The one-factor model of today’s script has df = 2.',
        choice: () => ({
          question: 'How many degrees of freedom does this two-factor model have?',
          options: ['1 — the factor correlation costs one', '2 — the same as one factor', '0 — two items per factor use everything up'],
          answer: 0,
          explain: c => `Four items, 10 variances and covariances; 2 free loadings, 4 error variances, 2 factor variances and 1 covariance: 9 parameters. df = 1.${c.fit ? ` The studio agrees: df = ${c.fit.df}.` : ''} Each two-item factor borrows its identification from the correlation with the other (Day 3 explains why).`,
        }),
      },
      {
        id: 'read', title: 'Read the correlation',
        prompt: () => 'Open Results. Look at the correlation of Tradition and Conformity (standardized).',
        panel: 'results',
        check: c => (!c.fit ? 'Waiting for the estimates…' : true),
        choice: c => {
          const r = factorCor(c.baseFit, c.base ?? c.d, 'Tradition', 'Conformity');
          return {
            question: `The two factors correlate ${r !== null ? d2s(r) : '…'}. What does that say?`,
            options: ['They are clearly two different values.', 'They cannot be told apart in these data: a correlation of about 1 — even slightly above 1, which no real correlation can be.', 'The model is not identified.'],
            answer: 1,
            explain: () => 'A correlation at or above 1 means the two factors measure the same thing — or that two items each are too few to separate them. The model is identified (df = 1), but the data do not support two values. That is why the course measures tradition and conformity as one factor, TRCO; Day 5 shows that in Belgium the two can be told apart.',
          };
        },
      },
      {
        id: 'decide', title: 'Decide: one or two',
        prompt: () => 'Keep the two factors — and say how you would ever separate them (more items? another sample?) — or redraw the one factor TRCO with all four items. Write one sentence why.',
        decide: true,
        check: c => {
          if (c.changes.length) return c.changes.every(x => hasReason(c.reasons, x.key)) ? true : 'Write a reason for every change.';
          return hasReason(c.answers, 'keep') ? true : 'Change the model, or write why you keep two factors.';
        },
      },
      {
        id: 'scale', title: 'Switch the scaling',
        prompt: () => 'Mechanics from step 3 of the script: click “Scale” in the toolbar (λ=1 → ψ=1). The factor variances are now fixed to 1 instead of the first loadings.',
        hint: 'The button is on the left of the sheet; it reads λ=1 or ψ=1.',
        check: c => (c.d.stdlv ? true : 'Switch the scaling to ψ = 1 (the “Scale” button).'),
        choice: () => ({
          question: 'What changed — and what did not?',
          options: ['The fit changed.', 'The unstandardized loadings and factor variances changed; the fit and the standardized estimates did not.', 'Nothing at all.'],
          answer: 1,
          explain: () => 'Scaling chooses the unit of the factor, not the model: the same fit, the same standardized solution, the same correlation of the factors.',
        }),
      },
      {
        id: 'r', title: 'Check it in R',
        prompt: () => 'Run the two-factor model in R with the course’s pipeline (MLR, FIML). The correlation of the factors comes out above 1 there too — and lavaan warns that the covariance matrix of the latent variables is not positive definite.',
        action: 'confirm-r',
        deeper: { href: '#/day/1#yourturn', label: 'Your turn of Day 1 — the same pipeline for another construct' },
        check: c => (c.answers.r === 'done' ? true : 'Run it in R, then tick it off.'),
      },
    ],
  },
  {
    id: 'd2-strain', day: 2, support: 'full',
    title: 'Where does the two-factor model strain?',
    question: 'Are universalism and tradition/conformity two distinct values in the Netherlands?',
    syntax: 'TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp\nUNIV =~ ipeqopt + ipudrst + impenv',
    data: { source: 'course', round: 'ess2004', sample: 'NL', grouping: 'none' },
    steps: [
      {
        id: 'predict', title: 'Guess first',
        prompt: () => 'On its own, tradition/conformity fits the Dutch data almost perfectly: χ²(2) = 0.9 in the studio’s sample (2.39 in the script, with MLR and FIML). Now universalism joins it in one model.',
        choice: () => ({
          question: 'What will happen to the fit?',
          options: ['It stays almost perfect — both factors fit on their own.', 'It gets worse — one factor correlation must now explain twelve new covariances.', 'The model cannot be estimated any more.'],
          answer: 1,
          explain: c => `The seven items have 28 variances and covariances; twelve of them link a universalism item with a tradition item, and the model explains all twelve with a single factor correlation.${c.fit ? ` Result: χ²(${c.fit.df}) = ${c.fit.chisq.toFixed(1)}, CFI ${f3(c.fit.cfi)}.` : ''}`,
        }),
      },
      {
        id: 'judge', title: 'Read the verdict',
        prompt: () => 'Open Results. Read CFI, RMSEA and SRMR together — χ² is reported, but with 1,690 respondents it rejects almost any model.',
        panel: 'results',
        hint: `Rules of thumb — ${CUTOFF_TEXT}.`,
        check: c => (!c.fit ? 'Waiting for the estimates…' : !c.fit.converged ? 'The model did not converge.' : c.fit.df <= 0 ? 'With df = 0 there is nothing to judge.' : true),
        choice: c => (c.baseFit ? {
          question: 'Your verdict on the course model?',
          options: ['Good fit', 'Borderline — acceptable, but not clean', 'Poor fit'],
          answer: ['good', 'fair', 'poor'].indexOf(fitVerdict(c.baseFit)),
          explain: x => `CFI ${f3(x.baseFit!.cfi)}, RMSEA ${f3(x.baseFit!.rmsea)}, SRMR ${f3(x.baseFit!.srmr)}. CFI sits exactly on the line, RMSEA is above .05 — the model is usable, but something is not reproduced.`,
        } : null),
        deeper: { href: '#/s8', label: 'Why χ² rejects large samples — station 2.3' },
      },
      {
        id: 'find', title: 'Find where it strains',
        prompt: () => 'Open “Where the model strains” in Results — the places where the model does not reproduce the data. Each line says how much χ² would drop if one parameter were added.',
        panel: 'results',
        choice: c => {
          const mi = topMI(c.baseFit, c.base ?? c.d);
          if (mi.length < 3) return null;
          const opts = [mi[2], mi[0], mi[4] ?? mi[1]].map(q => describeMI(q, c.base ?? c.d).text);
          return {
            question: 'Which addition would lower χ² the most?', options: opts, answer: 1,
            explain: x => {
              const q = topMI(x.baseFit, x.base ?? x.d)[0];
              const items = itemsIn(x.base ?? x.d, q);
              return `MI ${q.mi.toFixed(1)}. ${items.length === 2 ? `Read the two questions: “${x.label(items[0])}” and “${x.label(items[1])}”. They belong to different values — what could they share beyond their factors?` : ''}`;
            },
          };
        },
        deeper: { href: '#/s8', label: 'Residuals and modification indices — station 2.3' },
      },
      {
        id: 'decide', title: 'Decide: free it or leave it',
        prompt: () => 'Both can be right. Add a parameter on the sheet (or with “Add” in Results), or keep the course model — and write one sentence why. The reason is what you will have to defend.',
        hint: 'A shared wording, a common response format or a substantive overlap are reasons. “The index was large” is not.',
        decide: true,
        check: c => {
          if (c.changes.length) return c.changes.every(x => hasReason(c.reasons, x.key)) ? true : 'Write a reason for every change.';
          return hasReason(c.answers, 'keep') ? true : 'Change the model, or write why you keep it as it is.';
        },
        mirror: c => {
          if (!c.changes.length || !c.fit || !c.baseFit) return null;
          const dchi = c.baseFit.chisq - c.fit.chisq, dcfi = c.fit.cfi - c.baseFit.cfi;
          return `${c.changes.length} change${c.changes.length > 1 ? 's' : ''}: df ${c.baseFit.df} → ${c.fit.df}, χ² −${dchi.toFixed(1)}, CFI ${dcfi >= 0 ? '+' : ''}${f3(dcfi)}. The model now fits these respondents better — whether it describes the values better is what your reason claims.`;
        },
      },
      {
        id: 'compare', title: 'Keep both versions',
        prompt: () => 'Keep the course model next to yours (Results → Compare models). AIC and BIC weigh the better fit against the extra parameter.',
        panel: 'results',
        action: 'keep-course-model',
        check: c => (c.snapshots > 0 ? true : 'Keep the course model for comparison.'),
      },
      {
        id: 'r', title: 'Check it in R',
        prompt: () => 'Run the model in R. The Day 2 script uses all respondents with FIML and MLR, so its numbers differ slightly from these; with the studio’s sample and ML (code on the Day 2 page, section “Why the studio’s numbers differ”) lavaan gives exactly the numbers you see here.',
        action: 'confirm-r',
        deeper: { href: '#/day/2#studio', label: 'The studio’s sample in R — and the numbers to expect' },
        check: c => (c.answers.r === 'done' ? true : 'Run it in R, then tick it off.'),
      },
    ],
  },
  {
    id: 'd3-scfa', day: 3, support: 'full',
    title: 'Three constructs at once',
    question: 'Are tradition/conformity, universalism and openness to immigration three distinct constructs — and how are they related?',
    syntax: 'TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp\nUNIV =~ ipeqopt + ipudrst + impenv\nALLOW =~ imsmetn + imdfetn + impcntr',
    data: { source: 'course', round: 'ess2004', sample: 'NL', grouping: 'none' },
    steps: [
      {
        id: 'predict', title: 'Guess first',
        prompt: () => 'On their own, tradition/conformity has df = 2; universalism and openness to immigration have three items each and df = 0. Now all ten items sit in one model.',
        choice: () => ({
          question: 'How many degrees of freedom does the simultaneous model have?',
          options: ['2 — the separate models add up', '32 — the covariances between the constructs are new claims', '0 — three factors use up the information'],
          answer: 1,
          explain: c => `Ten items give 55 variances and covariances; the model has 23 parameters (7 loadings, 10 error variances, 3 factor variances, 3 factor covariances). The 33 covariances between items of different constructs are explained by just three factor covariances — 30 new claims the separate models never made.${c.fit ? ` Result: df = ${c.fit.df}.` : ''}`,
        }),
      },
      {
        id: 'judge', title: 'Read the verdict',
        prompt: () => 'Open Results and read CFI, RMSEA and SRMR together.',
        panel: 'results',
        hint: `Rules of thumb — ${CUTOFF_TEXT}.`,
        check: c => (!c.fit ? 'Waiting for the estimates…' : !c.fit.converged ? 'The model did not converge.' : c.fit.df <= 0 ? 'With df = 0 there is nothing to judge.' : true),
        choice: c => (c.baseFit ? {
          question: 'Your verdict on the simultaneous model?',
          options: ['Good fit', 'Borderline — acceptable, but not clean', 'Poor fit'],
          explain: (x, picked) => `CFI ${f3(x.baseFit!.cfi)}, RMSEA ${f3(x.baseFit!.rmsea)}, SRMR ${f3(x.baseFit!.srmr)}, with χ²(${x.baseFit!.df}) = ${x.baseFit!.chisq.toFixed(1)}. ${picked === 2 ? 'Poor is too harsh: CFI and SRMR are good. ' : ''}CFI and SRMR say good; RMSEA is just above .05 — by the course’s table “borderline”, in R with MLR and FIML it is .046. Good or borderline: both are defensible readings — a cut-off is a convention, not a cliff. Thirty new claims, and the model holds.`,
        } : null),
      },
      {
        id: 'relate', title: 'How are the constructs related?',
        prompt: () => 'In Results, read the correlations of the three factors (standardized). They are corrected for measurement error — the relations between the constructs themselves.',
        panel: 'results',
        choice: c => {
          const tu = factorCor(c.baseFit, c.base ?? c.d, 'TRCO', 'UNIV'), ta = factorCor(c.baseFit, c.base ?? c.d, 'TRCO', 'ALLOW'), ua = factorCor(c.baseFit, c.base ?? c.d, 'UNIV', 'ALLOW');
          return {
            question: 'Which statement fits the factor correlations?',
            options: ['Universalism goes with more openness to immigration, tradition/conformity with less — and the two values correlate positively.', 'Both values go with more openness.', 'The three constructs are unrelated.'],
            answer: 0,
            explain: () => (tu !== null && ta !== null && ua !== null
              ? `TRCO–UNIV ${d2s(tu)}, UNIV–ALLOW ${d2s(ua)}, TRCO–ALLOW ${d2s(ta)}. The two values correlate positively — yet relate to openness in opposite directions. And none of the correlations comes near the limit of .85: three distinct constructs (discriminant validity).`
              : 'The two values correlate positively, yet relate to openness in opposite directions — and no correlation is near 1.'),
          };
        },
      },
      {
        id: 'find', title: 'Find where it strains',
        prompt: () => 'Open “Where the model strains” in Results. Two kinds of additions are on the list: cross-loadings (an item on a second factor) and error covariances.',
        panel: 'results',
        choice: c => {
          const mi = topMI(c.baseFit, c.base ?? c.d);
          if (mi.length < 2) return null;
          return {
            question: `The two largest: “${describeMI(mi[0], c.base ?? c.d).text}” and “${describeMI(mi[1], c.base ?? c.d).text}”. What is the difference?`,
            options: ['None — both lower χ² by about the same amount.', 'An error covariance says two items share something beyond their factors; a cross-loading says one item measures a second construct too.', 'A cross-loading is always the better choice, because it has a theory.'],
            answer: 1,
            explain: () => 'They claim different things — and change different parts of the model. An error covariance leaves every factor as it was; a cross-loading changes what a factor is. Which one (if any) you add is a question about the items, not about the index.',
          };
        },
      },
      {
        id: 'predict2', title: 'Guess again',
        prompt: () => 'Before you change anything: what would the cross-loading TRCO → impenv do to the correlation of the two values?',
        choice: c => {
          const r = factorCor(c.baseFit, c.base ?? c.d, 'TRCO', 'UNIV');
          return {
            question: `Now TRCO–UNIV is ${r !== null ? d2s(r) : 'about .58'}. With the cross-loading, the correlation will …`,
            options: ['rise', 'fall', 'stay the same'],
            answer: 1,
            explain: () => 'It falls: part of what the two factors shared through impenv is now carried by the cross-loading itself. An error covariance takes a little less away. Try both, and watch the mirror.',
          };
        },
      },
      {
        id: 'decide', title: 'Decide: add one, or neither',
        prompt: () => 'Add the error covariance, the cross-loading, or nothing — and write one sentence why. Read the item texts first.',
        decide: true,
        check: c => {
          if (c.changes.length) return c.changes.every(x => hasReason(c.reasons, x.key)) ? true : 'Write a reason for every change.';
          return hasReason(c.answers, 'keep') ? true : 'Change the model, or write why you keep it as it is.';
        },
        mirror: c => {
          if (!c.changes.length || !c.fit || !c.baseFit) return null;
          const before = factorCor(c.baseFit, c.base ?? c.d, 'TRCO', 'UNIV'), after = factorCor(c.fit, c.d, 'TRCO', 'UNIV');
          return `${c.changes.length} change${c.changes.length > 1 ? 's' : ''}: df ${c.baseFit.df} → ${c.fit.df}, χ² −${(c.baseFit.chisq - c.fit.chisq).toFixed(1)}, CFI ${f3(c.baseFit.cfi)} → ${f3(c.fit.cfi)}.${before !== null && after !== null ? ` The correlation TRCO–UNIV: ${d2s(before)} → ${d2s(after)}.` : ''} A cross-loading moves it more than an error covariance.`;
        },
      },
      {
        id: 'compare', title: 'Keep both versions',
        prompt: () => 'Optional: keep the course model next to yours (Results → Compare models) — AIC and BIC weigh the better fit against the extra parameter.',
        panel: 'results',
        action: 'keep-course-model',
      },
      {
        id: 'r', title: 'Check it in R',
        prompt: () => 'Run the simultaneous CFA in R. The Day 3 script uses all respondents with FIML and MLR; with the studio’s sample and ML (code on the Day 3 page) lavaan gives the numbers you see here.',
        action: 'confirm-r',
        deeper: { href: '#/day/3#studio', label: 'The studio’s sample in R — and the numbers to expect' },
        check: c => (c.answers.r === 'done' ? true : 'Run it in R, then tick it off.'),
      },
    ],
  },
  {
    id: 'd4-ladder', day: 4, support: 'full',
    title: 'The ladder across the Benelux',
    question: 'Do the four tradition items measure the same thing in Belgium, Luxembourg and the Netherlands?',
    syntax: 'TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp',
    data: { source: 'course', round: 'ess2004', sample: 'pooled', grouping: 'country' },
    groups: { on: true, variable: 'cntry', names: ['Belgium', 'Luxembourg', 'Netherlands'], level: 'configural' },
    steps: [
      {
        id: 'predict', title: 'Guess first',
        prompt: () => 'Within each country, the four items fit one factor well. Now the same ruler has to work in all three countries at once.',
        choice: () => ({
          question: 'Up to which rung will the ruler hold?',
          options: ['Configural: the same items, but different loadings', 'Metric: equal loadings — relations can be compared', 'Scalar: equal intercepts too — means can be compared', 'Strict: everything equal'],
          answer: 1,
          explain: c => {
            const r = okRungs(c);
            return r ? `Configural CFI ${f3(r[0].cfi)}, metric ${f3(r[1].cfi)}, scalar ${f3(r[2].cfi)}. The loadings travel; the intercepts do not.` : 'Climb the ladder in the next step and see.';
          },
        }),
      },
      {
        id: 'climb', title: 'Climb the ladder',
        prompt: () => 'Open the Groups tab: Belgium, Luxembourg and the Netherlands are set up. Move the level from configural to metric to scalar, and watch Results → “The invariance ladder on your data”.',
        panel: 'groups',
        hint: 'Each rung adds equalities across the countries: metric the loadings, scalar also the intercepts. Compare each rung with the one below it.',
        check: c => (!c.g || (c.g.level !== 'scalar' && c.g.level !== 'strict') ? 'Set the level to scalar in the Groups tab.' : !okRungs(c) ? 'Waiting for the estimates…' : true),
        mirror: c => {
          const r = okRungs(c);
          if (!r) return null;
          return `CFI ${f3(r[0].cfi)} → ${f3(r[1].cfi)} (${sgn3(r[1].cfi - r[0].cfi)}) → ${f3(r[2].cfi)} (${sgn3(r[2].cfi - r[1].cfi)}). χ² jumps from ${r[1].chisq.toFixed(1)} to ${r[2].chisq.toFixed(1)} for ${r[2].df - r[1].df} more degrees of freedom.`;
        },
        deeper: { href: '#/s11', label: 'What each rung promises — station 4.2' },
      },
      {
        id: 'judge', title: 'Read the verdict',
        prompt: () => 'A step is acceptable when CFI drops by no more than .010 (Chen, 2007). The χ² difference test is reported too, but with 4,579 respondents it rejects almost every equality.',
        panel: 'results',
        choice: c => {
          const r = okRungs(c);
          if (!r) return null;
          return {
            question: 'Up to which rung do the rulers hold?',
            options: ['Configural only', 'Metric — correlations and regressions may be compared', 'Scalar — the countries’ means may be compared', 'Strict — also variances and reliabilities of sum scores'],
            answer: holdsUpTo(r),
            explain: () => `Metric holds (ΔCFI ${sgn3(r[1].cfi - r[0].cfi)}); scalar fails (ΔCFI ${sgn3(r[2].cfi - r[1].cfi)}). A comparison of the countries’ means would mix the people with the items.`,
          };
        },
        deeper: { href: '#/cards/4', label: 'Reference card: the ladder and Chen’s criteria' },
      },
      {
        id: 'find', title: 'Find the intercept that breaks it',
        prompt: () => 'Results → “Find the intercept that breaks it” refits the scalar model with one intercept freed at a time. Which one costs the most?',
        panel: 'results',
        choice: c => {
          const locks = interceptLocks(c);
          if (!c.refit || locks.length < 3) return null;
          const tried = locks.map(l => ({ l, f: c.refit!('scalar', [l.key]) }));
          if (tried.some(t => !t.f)) return null;
          const best = tried.reduce((a, b) => (b.f!.chisq < a.f!.chisq ? b : a));
          return {
            question: 'Which intercept differs most across the countries?',
            options: tried.map(t => itemOf(c, t.l.node)),
            answer: tried.indexOf(best),
            explain: x => {
              const sc = okRungs(x)?.[2];
              const item = itemOf(x, best.l.node);
              return `Freeing ${item} lowers χ² by ${sc ? (sc.chisq - best.f!.chisq).toFixed(1) : '…'} (CFI ${sc ? f3(sc.cfi) : '…'} → ${f3(best.f!.cfi)}). The question reads: “${x.label(item)}”. Is that a different thing to agree with in Dutch, French and Luxembourgish — or do people really differ?`;
            },
          };
        },
      },
      {
        id: 'release', title: 'Release — with a reason',
        prompt: () => 'Release an intercept only if you can say why it works differently across the countries: click its lock on the sheet, or “Release” in Results. Keep at least two intercepts equal — they are the anchors. Or keep full scalar invariance and give up the mean comparison.',
        hint: 'A reason is about the item, not the fit: wording, translation, what “following rules” means in a country. “The index was largest” is not a reason.',
        decide: true,
        keepLabel: 'Or release nothing: stop at metric invariance and do not compare the means, because…',
        check: c => {
          const freed = interceptLocks(c).filter(l => c.g?.free.includes(l.key));
          if (!freed.length) return (c.answers.keep ?? '').trim().length >= 12 ? true : 'Release an intercept — or write why you keep full scalar invariance.';
          if (interceptLocks(c).length - freed.length < 2) return 'Keep at least two intercepts equal: without anchors the means are not comparable at all.';
          return c.changes.filter(x => x.key.startsWith('release:')).every(x => (c.reasons[x.key] ?? '').trim().length >= 12) ? true : 'Write a reason for every release.';
        },
        mirror: c => {
          const r = okRungs(c);
          const freed = interceptLocks(c).filter(l => c.g?.free.includes(l.key));
          if (!r || !freed.length) return null;
          const d = r[2].cfi - r[1].cfi;
          const head = `${freed.length} intercept${freed.length > 1 ? 's' : ''} released: scalar CFI ${f3(r[2].cfi)}, ΔCFI to metric ${sgn3(d)}.`;
          if (d >= -CUTOFFS.deltaCfi) return `${head} Chen’s criterion holds.`;
          if (r[2].cfi < CUTOFFS.cfi.fair) return `${head} Still far from acceptable — is there a second intercept you can explain?`;
          return `${head} By Chen’s ΔCFI this still fails; by the absolute CFI it looks ${r[2].cfi >= CUTOFFS.cfi.good ? 'good' : 'acceptable'}. Two defensible readings — absolute fit or the change in fit — lead to different conclusions here. The course follows Chen; if you take the other reading, write down why.`;
        },
      },
      {
        id: 'anchors', title: 'Who are the anchors?',
        prompt: () => 'The released intercepts no longer link the countries; the remaining ones do. Look at what the choice does to the Dutch mean.',
        choice: c => {
          const rules = lockFor(c, 'ipfrule'), modest = lockFor(c, 'ipmodst');
          if (!c.refit || !rules || !modest) return null;
          const one = latentMeans(c.refit('scalar', [rules.key], true)), two = latentMeans(c.refit('scalar', [rules.key, modest.key], true));
          if (one.length < 3 || two.length < 3) return null;
          return {
            question: `Freeing “rules”, the Netherlands sit ${Math.abs(one[2]).toFixed(2)} SD below Belgium; freeing “rules” and “modest”, ${Math.abs(two[2]).toFixed(2)} SD. What follows?`,
            options: ['Take the model with the better fit — its mean is the right one.', 'The anchors decide the comparison: report the means under both choices and argue which items are the same ruler.', 'Free all four intercepts — then nothing is biased.'],
            answer: 1,
            explain: () => 'Fit cannot tell which ruler is bent, only that one is. With all intercepts free the means are not identified at all; two anchors are the minimum (Byrne, Shavelson & Muthén, 1989). Report how the comparison depends on the anchors — and, with many groups, consider alignment (Asparouhov & Muthén, 2014).',
          };
        },
        deeper: { href: '#/s11', label: 'The anchor problem on the Benelux data — station 4.2' },
      },
      {
        id: 'r', title: 'Check it in R',
        prompt: () => 'Run the ladder in lavaan: group.equal for the rungs, lavTestScore for the intercept that breaks it, group.partial for your release. The Day 4 script uses FIML and MLR; with the studio’s sample and ML (code on the Day 4 page) the numbers match the studio exactly.',
        action: 'confirm-r',
        deeper: { href: '#/day/4#studio', label: 'The studio’s sample in R — and the numbers to expect' },
        check: c => (c.answers.r === 'done' ? true : 'Run it in R, then tick it off.'),
      },
    ],
  },
  {
    id: 'd5-mtmm', day: 5, support: 'goal',
    title: 'Traits and methods',
    question: 'Trust in parliament, the legal system and the police, each asked in three formats: how much of the correlations is trust — and how much is the format?',
    syntax: 'Parl =~ parl_a + parl_b + parl_c\nLegal =~ legal_a + legal_b + legal_c\nPolice =~ police_a + police_b + police_c',
    data: { source: 'course', round: 'mtmm', sample: 'pooled', grouping: 'none' },
    steps: [
      {
        id: 'predict', title: 'Guess first',
        prompt: () => 'The model has only the three trait factors. Every item was answered in one of three formats — a 0–10 scale (a), a 4-point agree scale (b), a 5-point scale (c) — and the model ignores that.',
        choice: () => ({
          question: 'If the formats add shared variance of their own, what happens to the trait correlations in this model?',
          options: ['They come out too high — the shared format masquerades as shared trust', 'They are right — formats only add noise', 'They come out too low'],
          answer: 0,
          explain: c => {
            const t = ['Parl', 'Legal', 'Police'], r = [factorCor(c.baseFit, c.base ?? c.d, t[0], t[1]), factorCor(c.baseFit, c.base ?? c.d, t[0], t[2]), factorCor(c.baseFit, c.base ?? c.d, t[1], t[2])];
            return r.every(x => x !== null) ? `Here: ${r.map(x => d2s(x!)).join(', ')}. The data are simulated with true correlations .60, .45 and .55.` : 'Estimate the model and look at the factor correlations.';
          },
        }),
      },
      {
        id: 'judge', title: 'Read the verdict',
        prompt: () => 'Open Results: does the trait-only model fit?',
        panel: 'results',
        choice: c => (c.baseFit ? {
          question: 'Your verdict on the trait-only model?',
          options: ['Good fit', 'Borderline', 'Poor fit'],
          answer: ['good', 'fair', 'poor'].indexOf(fitVerdict(c.baseFit)),
          explain: x => `CFI ${f3(x.baseFit!.cfi)}, RMSEA ${f3(x.baseFit!.rmsea)}. Something systematic is missing.`,
        } : null),
      },
      {
        id: 'find', title: 'Find the pattern',
        prompt: () => 'Open “Where the model strains”. Read the item names of the largest indices: the letter after the underscore is the format.',
        panel: 'results',
        choice: () => ({
          question: 'What do the largest modification indices have in common?',
          options: ['They pair items of the same trait', 'They pair items answered in the same format', 'They are cross-loadings on another trait'],
          answer: 1,
          explain: () => 'Items asked in the same format share variance beyond their traits: method variance (Campbell & Fiske, 1959). It can be modelled as method factors (one per format) or as error covariances among same-format items (correlated uniqueness).',
        }),
      },
      {
        id: 'decide', title: 'Model the methods',
        prompt: () => 'Add the method effects: error covariances between the items of the same format — or a method factor per format, uncorrelated with the traits. Write why.',
        hint: 'Correlated uniqueness: nine covariances (three per format). Method factors: three factors, each loading on the three items of one format, uncorrelated with everything else. With three traits the two are equivalent.',
        decide: true,
        check: c => {
          if (c.changes.length) return c.changes.every(x => hasReason(c.reasons, x.key)) ? true : 'Write a reason for every change.';
          return hasReason(c.answers, 'keep') ? true : 'Model the methods, or write why you keep the trait-only model.';
        },
        mirror: c => {
          if (!c.changes.length || !c.fit || !c.baseFit) return null;
          const t = ['Parl', 'Legal', 'Police'];
          const before = factorCor(c.baseFit, c.base ?? c.d, t[0], t[1]), after = factorCor(c.fit, c.d, t[0], t[1]);
          return `CFI ${f3(c.baseFit.cfi)} → ${f3(c.fit.cfi)}.${before !== null && after !== null ? ` The correlation of trust in parliament and the legal system: ${d2s(before)} → ${d2s(after)} (true .60).` : ''} The trait correlations shrink once the formats have their own place.`;
        },
      },
      {
        id: 'compare', title: 'Keep both versions',
        prompt: () => 'Keep the trait-only model next to yours (Results → Compare models).',
        panel: 'results',
        action: 'keep-course-model',
        check: c => (c.snapshots > 0 ? true : 'Keep the trait-only model for comparison.'),
      },
      {
        id: 'r', title: 'Check it in R',
        prompt: () => 'The Day 5 script simulates the same data in R (set.seed(2028)) and fits the trait-only, the method-factor (CT-UM) and the correlated-uniqueness (CU) model. How to tell it worked: the χ² of your model here matches the table in section 6. If not: another lavaan version may draw other data — compare the trait correlations instead.',
        action: 'confirm-r',
        deeper: { href: '#/day/5#s6', label: 'MTMM in R — section 6 of the Day 5 script' },
        check: c => (c.answers.r === 'done' ? true : 'Run it in R, then tick it off.'),
      },
    ],
  },
];

export const taskById = (id: string | null | undefined) => TASKS.find(t => t.id === id) ?? null;
/** The step the learner is on: the first one whose strict check does not pass yet. */
export function currentStep(t: Task, c: TaskContext): number {
  const i = t.steps.findIndex(s => {
    if (s.choice && s.choice(c) && c.answers[s.id] === undefined) return true;
    return s.check ? s.check(c) !== true : false;
  });
  return i < 0 ? t.steps.length : i;
}
