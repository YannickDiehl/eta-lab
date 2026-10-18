// An exercise for Day 1: a lavaan model an AI assistant drafted from a path diagram — find what
// does not match the diagram or the theory, then compare with the answers.
import { useState } from 'react';

const EXERCISE: { title: string; intro: string; code: string; answer: string[] } = {
  title: 'Exercise: check the AI’s syntax against the diagram',
  intro: 'The diagram: tradition/conformity measured by ipmodst, imptrad, ipfrule, ipbhprp; universalism by ipeqopt, ipudrst, impenv; the two factors correlate; no other arrows. Values items run from 1 “very much like me” to 6 “not like me at all”. An AI assistant drafted this code. Find the four problems with the diagram — and one more.',
  code: `NL2 <- read_spss(path = "NL2.sav", convert.factors = F, drop.labels = T)

values_fit <- cfa(
  model = "
    TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp
    UNIV ~ ipeqopt + ipudrst + impenv
    TRCO ~~ 0*UNIV
    imptrad ~~ impenv
  ",
  data = NL2,
  estimator = "ML"
)`,
  answer: [
    'The items are not reversed: without mutate(across(ipcrtiv:impfun, \(x) rec(x, rec = "rev"))), higher values mean less importance. The correlations among the value items stay the same (all are turned together), but every correlation with variables that are not reversed — the allow items, age, education — flips its sign.',
    'UNIV ~ ipeqopt + … regresses UNIV on its items instead of measuring it: lavaan stops, because UNIV is neither in the data nor defined by =~. A reflective measurement model needs =~ (the arrows run from the factor to the items).',
    'TRCO ~~ 0*UNIV forbids the correlation the diagram draws; delete the line (lavaan lets factors covary by default).',
    'imptrad ~~ impenv is an error covariance the diagram does not draw. Day 2 meets it again as the largest modification index — and asks for a reason about the items before anyone frees it.',
    'A fifth point, not about the diagram: estimator = "ML" ignores the MLR with missing = "fiml.x" used here — for skewed items with missing answers, and without FIML lavaan drops every incomplete respondent.',
  ],
};

export function AiCheck() {
  const ex = EXERCISE;
  const [open, setOpen] = useState(false);
  return (
    <div className="card ws-part">
      <p className="st-h" style={{ marginTop: 0 }}>{ex.title}</p>
      <p>{ex.intro}</p>
      <pre className="syntax"><code>{ex.code}</code></pre>
      <button className="btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Hide the answers' : 'Show the answers'}</button>
      {open && <ol className="ws-notes">{ex.answer.map((a, k) => <li key={k}>{a}</li>)}</ol>}
    </div>
  );
}
