// The map of SEM · small tasks with feedback, one or two per section:
//   QuestionModel   which model answers this research question?
//   OneFramework    regression, path analysis, factor analysis, MIMIC and full SEM as one diagram
//   ReadDiagram     name every symbol of a path diagram
//   MatrixQuiz      which of lavaan's matrices holds this arrow? (the real model of Part 2)
//   ProcessLoop     the steps of every analysis, each with its lavaan function and its decision
//   CausalityCheck  the three conditions of causality on three claims from the ESS data
//   OmittedVariable how a forgotten common cause changes — even reverses — an effect
import { useState, type ReactNode } from 'react';
import type { MapData } from './widgets.tsx';

const ARROW = <defs><marker id="qz-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor" /></marker></defs>;
function Line({ a, b, cls = '', both, curve, label }: { a: [number, number]; b: [number, number]; cls?: string; both?: boolean; curve?: number; label?: string }) {
  const d = curve ? `M${a[0]} ${a[1]} Q ${(a[0] + b[0]) / 2 + curve} ${(a[1] + b[1]) / 2} ${b[0]} ${b[1]}` : `M${a[0]} ${a[1]} L ${b[0]} ${b[1]}`;
  return <g className={`qz-e ${cls}`}><path d={d} fill="none" markerEnd="url(#qz-a)" markerStart={both ? 'url(#qz-a)' : undefined} />{label && <text x={(a[0] + b[0]) / 2 + (curve ?? 0) / 2} y={(a[1] + b[1]) / 2 - 5} className="qz-l">{label}</text>}</g>;
}
const Lat = ({ x, y, t, cls = '' }: { x: number; y: number; t: string; cls?: string }) => <g className={cls}><ellipse cx={x} cy={y} rx="38" ry="22" className="f-lat" /><text x={x} y={y + 5} className="f-lbl c b">{t}</text></g>;
const Obs = ({ x, y, t, w = 64, cls = '' }: { x: number; y: number; t: string; w?: number; cls?: string }) => <g className={cls}><rect x={x - w / 2} y={y - 12} width={w} height="24" rx="3" className="f-obs" /><text x={x} y={y + 4} className="f-lbl c">{t}</text></g>;

// ---------------------------------------------------------------- which model answers this question?
const MODELS = ['One factor (CFA)', 'Several factors', 'Restrictions', 'Groups and invariance', 'Latent means', 'Full structural model', 'MIMIC and mediation', 'Moderation', 'Panel over time'];
const QUESTIONS: { q: string; a: number; why: string }[] = [
  { q: 'How well do my four items measure one construct?', a: 0, why: 'One construct, its items, their loadings and reliabilities: a one-factor CFA (Day 1).' },
  { q: 'Are tradition/conformity and universalism two distinct constructs — or one?', a: 1, why: 'Two factors and their correlation; compared with a one-factor model (Day 2).' },
  { q: 'Do Dutch and Belgian respondents understand the items in the same way?', a: 3, why: 'The same model in several groups, with loadings and intercepts set equal step by step: measurement invariance (Day 4).' },
  { q: 'Do values explain attitudes toward immigration?', a: 5, why: 'Two measured constructs, one effect between them: the full structural model (Day 6).' },
  { q: 'Does education affect attitudes toward immigration through values?', a: 6, why: 'An indirect effect through a mediator: mediation (Day 7).' },
  { q: 'Is the effect of values on attitudes stronger in Belgium than in the Netherlands?', a: 7, why: 'An effect that depends on the group: moderation, here by multi-group comparison (Day 8).' },
  { q: 'Do attitudes at one wave predict values at the next — or the other way round?', a: 8, why: 'The same constructs measured repeatedly, with cross-lagged effects: a panel model (Day 9).' },
];
export function QuestionModel() {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = QUESTIONS[i], done = i >= QUESTIONS.length - 1 && pick === q.a;
  return (
    <div className="card mini-task quiz">
      <p className="q"><span className="mt-tag">Your turn · {i + 1} of {QUESTIONS.length}</span>Which model answers this question? <b>“{q.q}”</b></p>
      <div className="choices">{MODELS.map((m, k) => (
        <button key={m} disabled={pick === q.a} className={`choice ${pick === k ? (k === q.a ? 'right' : 'wrong') : ''}`} onClick={() => { if (pick === null && k === q.a) setScore(s => s + 1); setPick(k); }}>{m}</button>
      ))}</div>
      {pick !== null && (pick === q.a
        ? <div className="reveal" role="status">✓ {q.why} {i < QUESTIONS.length - 1 ? <button className="btn" onClick={() => { setI(i + 1); setPick(null); }}>Next question →</button> : <b> {score} of {QUESTIONS.length} at the first try.</b>}</div>
        : <p className="hint" role="status">Not quite — which part of the question is the core: measuring, comparing groups, or an effect?</p>)}
      {done && <p className="hint">The gallery above leads to each of these days.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- one framework, many methods
type Shape = 'lat' | 'obs' | null;
const METHODS: { id: string; label: string; e1: Shape; e2: Shape; x: boolean; items1: boolean; items2: boolean; xe1: boolean; e1e2: boolean; xe2: boolean; cov: boolean; names: [string, string]; code: string; mats: string; says: string }[] = [
  { id: 'reg', label: 'regression', e1: null, e2: 'obs', x: true, items1: false, items2: false, xe1: false, e1e2: false, xe2: true, cov: false, names: ['', 'y'], code: 'y ~ x', mats: 'beta (and psi for the variances)', says: 'One observed cause, one observed effect — a structural model without measurement. Analysis of variance is the same with groups as x.' },
  { id: 'path', label: 'path analysis', e1: 'obs', e2: 'obs', x: true, items1: false, items2: false, xe1: true, e1e2: true, xe2: true, cov: false, names: ['m', 'y'], code: 'm ~ x\ny ~ m + x', mats: 'beta, psi', says: 'Several regressions at once, with a mediator: Wright’s path analysis. Still every variable is measured without error.' },
  { id: 'cfa', label: 'factor analysis', e1: 'lat', e2: 'lat', x: false, items1: true, items2: true, xe1: false, e1e2: false, xe2: false, cov: true, names: ['η₁', 'η₂'], code: 'ETA1 =~ y1 + y2 + y3\nETA2 =~ y4 + y5 + y6', mats: 'lambda, theta, psi', says: 'Only measurement: constructs, their items and their correlation — Part 1.' },
  { id: 'mimic', label: 'MIMIC', e1: 'lat', e2: null, x: true, items1: true, items2: false, xe1: true, e1e2: false, xe2: false, cov: false, names: ['η₁', ''], code: 'ETA1 =~ y1 + y2 + y3\nETA1 ~ x', mats: 'lambda, theta, psi, beta', says: 'A measured construct and an observed cause: group differences in a latent variable (Day 7).' },
  { id: 'sem', label: 'full SEM', e1: 'lat', e2: 'lat', x: true, items1: true, items2: true, xe1: true, e1e2: true, xe2: true, cov: false, names: ['η₁', 'η₂'], code: 'ETA1 =~ y1 + y2 + y3\nETA2 =~ y4 + y5 + y6\nETA1 ~ x\nETA2 ~ ETA1 + x', mats: 'lambda, theta, psi, beta — all of them', says: 'Measurement and structure together: every method above is a special case of this one.' },
];
export function OneFramework() {
  const [id, setId] = useState('sem');
  const m = METHODS.find(x => x.id === id)!;
  const E1: [number, number] = [230, 70], E2: [number, number] = [420, 70];
  const node = (s: Shape, p: [number, number], t: string) => (s === 'lat' ? <Lat x={p[0]} y={p[1]} t={t} /> : s === 'obs' ? <Obs x={p[0]} y={p[1]} t={t} w={50} /> : null);
  const items = (c: [number, number], names: string[]) => names.map((t, i) => { const x = c[0] - 60 + i * 60; return <g key={t}><Line a={[c[0] + (i - 1) * 14, c[1] + 22]} b={[x, 152]} /><Obs x={x} y={164} t={t} w={44} /></g>; });
  return (
    <div className="fig">
      <div className="seg wrap" role="group" aria-label="Method">{METHODS.map(x => <button key={x.id} aria-pressed={id === x.id} onClick={() => setId(x.id)}>{x.label}</button>)}</div>
      <div className="fig-row">
        <svg viewBox="0 0 500 190" className="fig-svg" role="img" aria-label={`Path diagram of ${m.label}`} style={{ color: 'var(--ink)' }}>
          {ARROW}
          {m.x && <Obs x={50} y={70} t="x" w={44} />}
          {m.xe1 && <Line a={[73, 70]} b={[m.e1 === 'lat' ? 190 : 203, 70]} />}
          {m.e1e2 && <Line a={[m.e1 === 'lat' ? 270 : 257, 70]} b={[m.e2 === 'lat' ? 380 : 393, 70]} />}
          {m.xe2 && (m.xe1
            ? <g className="qz-e"><path d={`M56 57 Q 235 -6 ${m.e2 === 'lat' ? 398 : 404} 52`} fill="none" markerEnd="url(#qz-a)" /></g>
            : <Line a={[73, 70]} b={[m.e2 === 'lat' ? 380 : 393, 70]} />)}
          {m.cov && <Line a={[255, 52]} b={[395, 52]} both curve={0} cls="qz-cov" />}
          {node(m.e1, E1, m.names[0])}{node(m.e2, E2, m.names[1])}
          {m.items1 && items(E1, ['y1', 'y2', 'y3'])}
          {m.items2 && items(E2, ['y4', 'y5', 'y6'])}
        </svg>
        <div className="fig-text">
          <p>{m.says}</p>
          <pre className="syntax"><code>{m.code}</code></pre>
          <p className="hint">lavaan’s matrices in use: <b>{m.mats}</b> (section 5).</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- read the diagram
const PARTS = ['latent variable', 'observed indicator', 'measurement error', 'variance of a factor', 'loading fixed to 1 (the unit of the factor)', 'covariance', 'regression: an effect', 'disturbance: what the causes leave unexplained'];
const MARKS: { n: number; x: number; y: number; a: number }[] = [
  { n: 1, x: 236, y: 52, a: 0 }, { n: 2, x: 70, y: 14, a: 1 }, { n: 3, x: 30, y: 64, a: 2 }, { n: 4, x: 226, y: 18, a: 3 },
  { n: 5, x: 128, y: 24, a: 4 }, { n: 6, x: 116, y: 136, a: 5 }, { n: 7, x: 300, y: 80, a: 6 }, { n: 8, x: 470, y: 90, a: 7 },
];
export function ReadDiagram() {
  const [ans, setAns] = useState<(number | null)[]>(MARKS.map(() => null));
  const [checked, setChecked] = useState(false);
  const right = ans.filter((a, i) => a === MARKS[i].a).length;
  return (
    <div className="fig">
      <div className="fig-row">
        <svg viewBox="0 0 500 260" className="fig-svg" role="img" aria-label="A path diagram with eight numbered parts" style={{ color: 'var(--ink)' }}>
          {ARROW}
          <path d="M178 49 C 166 14 214 14 202 49" fill="none" className="qz-e" markerEnd="url(#qz-a)" style={{ stroke: 'currentColor', strokeWidth: 1.6 }} />
          <Line a={[154, 62]} b={[104, 44]} label="1" /><Line a={[156, 80]} b={[104, 100]} /><Line a={[156, 208]} b={[104, 228]} />
          <Obs x={72} y={42} t="y₁" w={60} /><Obs x={72} y={102} t="y₂" w={60} /><Obs x={72} y={230} t="y₃" w={60} />
          <Line a={[8, 42]} b={[40, 42]} /><text x="14" y="34" className="qz-l">ε₁</text>
          <Line a={[8, 102]} b={[40, 102]} /><text x="14" y="94" className="qz-l">ε₂</text>
          <Line a={[8, 230]} b={[40, 230]} /><text x="14" y="222" className="qz-l">ε₃</text>
          <Line a={[166, 90]} b={[166, 180]} both curve={-50} />
          <Line a={[228, 80]} b={[354, 122]} /><Line a={[228, 190]} b={[354, 148]} />
          <Line a={[440, 78]} b={[408, 114]} /><text x="446" y="74" className="qz-l">ζ</text>
          <Line a={[392, 157]} b={[436, 214]} /><Obs x={452} y={228} t="y₄" w={50} />
          <Lat x={190} y={70} t="η₁" /><Lat x={190} y={200} t="η₂" /><Lat x={392} y={135} t="η₃" />
          {MARKS.map(m => <g key={m.n} className={`qz-badge ${checked ? (ans[m.n - 1] === m.a ? 'ok' : 'no') : ''}`}><circle cx={m.x} cy={m.y} r="10" /><text x={m.x} y={m.y + 4}>{m.n}</text></g>)}
        </svg>
        <div className="fig-text">
          <p className="q"><span className="mt-tag">Your turn</span>Name the eight numbered parts.</p>
          <div className="rd-list">
            {MARKS.map((m, i) => (
              <label key={m.n} className={checked ? (ans[i] === m.a ? 'ok' : 'no') : ''}>
                <b>{m.n}</b>
                <select value={ans[i] ?? ''} onChange={e => { const n = ans.slice(); n[i] = e.target.value === '' ? null : +e.target.value; setAns(n); setChecked(false); }}>
                  <option value="">choose…</option>
                  {PARTS.map((p, k) => <option key={p} value={k}>{p}</option>)}
                </select>
                {checked && ans[i] !== m.a && <small>→ {PARTS[m.a]}</small>}
              </label>
            ))}
          </div>
          <button className="btn primary" disabled={ans.some(a => a === null)} onClick={() => setChecked(true)}>Check</button>
          {checked && <p className="reveal" role="status">{right} of 8 right. {right === 8 ? 'You can read a path diagram.' : 'The corrections are shown next to the wrong ones.'} Note 8: η₃ has causes, so its variance is split into what they explain and the rest, the disturbance ζ — in lavaan an entry of psi.</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- which matrix holds this arrow?
type Mx = 'lambda' | 'theta' | 'psi' | 'beta';
const ROUNDS: { el: string; q: string; a: Mx; r: string; c: string; why: string }[] = [
  { el: 'l-imptrad', q: 'the loading of imptrad on TRCO', a: 'lambda', r: 'imptrad', c: 'TRCO', why: 'a loading: row = item, column = factor' },
  { el: 'b-univ', q: 'the effect of UNIV on ALLOW', a: 'beta', r: 'ALLOW', c: 'UNIV', why: 'a regression among factors. Read beta as row ← column: ALLOW ← UNIV' },
  { el: 'cov', q: 'the covariance of TRCO and UNIV', a: 'psi', r: 'UNIV', c: 'TRCO', why: 'a covariance of two factors — off the diagonal of psi' },
  { el: 'e-impcntr', q: 'the error variance of impcntr', a: 'theta', r: 'impcntr', c: 'impcntr', why: 'an error variance of an item — on the diagonal of theta' },
  { el: 'z-allow', q: 'the disturbance of ALLOW (ζ)', a: 'psi', r: 'ALLOW', c: 'ALLOW', why: 'the trap: ζ belongs to a factor, not to an item, so its variance sits in psi, not theta. For ALLOW it is a residual variance — what TRCO and UNIV leave unexplained' },
  { el: 'l-imdfetn', q: 'the loading of imdfetn on ALLOW', a: 'lambda', r: 'imdfetn', c: 'ALLOW', why: 'a loading again — every factor’s loadings share one lambda' },
];
const LEFT1 = ['ipmodst', 'imptrad', 'ipfrule', 'ipbhprp'], LEFT2 = ['ipeqopt', 'ipudrst', 'impenv'], RIGHT = ['imsmetn', 'imdfetn', 'impcntr'];
export function MatrixQuiz({ d }: { d: MapData | null }) {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<Mx | null>(null);
  const [score, setScore] = useState(0);
  if (!d) return <p className="hint">Loading lavaan’s matrices…</p>;
  const R = ROUNDS[i], ok = pick === R.a, M = d.sem.matrices[R.a];
  const val = ok ? M.values[M.rows.indexOf(R.r)][M.cols.indexOf(R.c)] : null;
  const on = (k: string) => (R.el === k ? 'qz-on' : '');
  const T1: [number, number] = [190, 70], T2: [number, number] = [190, 210], A: [number, number] = [380, 140];
  return (
    <div className="card mini-task quiz">
      <p className="q"><span className="mt-tag">Your turn · {i + 1} of {ROUNDS.length}</span>In which of lavaan’s matrices is <b>{R.q}</b> (highlighted)?</p>
      <svg viewBox="0 0 520 280" className="fig-svg" role="img" aria-label={`Path diagram of the Part 2 model; highlighted: ${R.q}`} style={{ color: 'var(--ink)' }}>
        {ARROW}
        {LEFT1.map((t, k) => { const y = 22 + k * 32; return <g key={t}><Line a={[T1[0] - 38, T1[1] + (k - 1.5) * 8]} b={[96, y]} cls={on(`l-${t}`)} /><Obs x={60} y={y} t={t} w={70} /></g>; })}
        {LEFT2.map((t, k) => { const y = 178 + k * 32; return <g key={t}><Line a={[T2[0] - 38, T2[1] + (k - 1) * 8]} b={[96, y]} cls={on(`l-${t}`)} /><Obs x={60} y={y} t={t} w={70} /></g>; })}
        {RIGHT.map((t, k) => { const y = 92 + k * 48; return <g key={t}><Line a={[A[0] + 38, A[1] + (k - 1) * 10]} b={[438, y]} cls={on(`l-${t}`)} /><Obs x={474} y={y} t={t} w={70} /><Line a={[474, y + 34]} b={[474, y + 13]} cls={on(`e-${t}`)} /></g>; })}
        <Line a={[T1[0] + 4, T1[1] + 22]} b={[T2[0] + 4, T2[1] - 22]} both curve={50} cls={on('cov')} />
        <Line a={[T1[0] + 38, T1[1] + 6]} b={[A[0] - 34, A[1] - 12]} cls={on('b-trco')} />
        <Line a={[T2[0] + 38, T2[1] - 6]} b={[A[0] - 34, A[1] + 12]} cls={on('b-univ')} />
        <Line a={[A[0], A[1] - 62]} b={[A[0], A[1] - 23]} cls={on('z-allow')} /><text x={A[0] + 6} y={A[1] - 56} className="qz-l">ζ</text>
        <Lat x={T1[0]} y={T1[1]} t="TRCO" /><Lat x={T2[0]} y={T2[1]} t="UNIV" /><Lat x={A[0]} y={A[1]} t="ALLOW" />
      </svg>
      <div className="choices">{(['lambda', 'theta', 'psi', 'beta'] as Mx[]).map(m => (
        <button key={m} disabled={ok} className={`choice ${pick === m ? (m === R.a ? 'right' : 'wrong') : ''}`} onClick={() => { if (pick === null && m === R.a) setScore(s => s + 1); setPick(m); }}><code>{m}</code></button>
      ))}</div>
      {pick !== null && (ok
        ? <div className="reveal" role="status">✓ <code>{R.a}[{R.r}, {R.c}] = {val?.toFixed(3)}</code> — {R.why}. {i < ROUNDS.length - 1 ? <button className="btn" onClick={() => { setI(i + 1); setPick(null); }}>Next →</button> : <b>{score} of {ROUNDS.length} at the first try.</b>}</div>
        : <p className="hint" role="status">Not quite. Ask: does the arrow connect an item with a factor (lambda), an item with its error (theta), two factors by a covariance or a residual (psi), or two factors by an effect (beta)?</p>)}
    </div>
  );
}

// ---------------------------------------------------------------- the process as a loop
const STEPS: { t: string; fn: ReactNode; decide: string; link: [string, string] }[] = [
  { t: 'starting hypotheses', fn: <>a path diagram — on paper</>, decide: 'Which constructs, which effects — and which arrows you leave out, because every missing arrow is a claim.', link: ['#/map#theory', 'section 8 of this page'] },
  { t: 'data and preprocessing', fn: <><code>read_spss()</code>, <code>rec()</code>, <code>frq()</code></>, decide: 'Reverse items so that higher means more; look at every item; count the missing answers; check reliability.', link: ['#/day/1', 'Day 0 and Day 1, step 4'] },
  { t: 'specification and identification', fn: <><code>=~</code>, <code>~</code>, <code>~~</code> in a model string</>, decide: 'Marker item or standardized factor; is df ≥ 0 — and is the model really identified?', link: ['#/day/1', 'Day 1, step 5'] },
  { t: 'estimation', fn: <><code>cfa(…, estimator = "MLR", missing = "fiml.x")</code></>, decide: 'Which estimator for these data, and how to handle missing answers.', link: ['#/day/1#step5', 'Day 1, step 5; Day 2, sections 3 and 9'] },
  { t: 'evaluation', fn: <><code>summary(fit.measures = T, standardized = T)</code>, <code>lavResiduals()</code>, <code>modindices()</code></>, decide: 'Global fit, then local fit. If the model does not fit: modify it — with reasons — and go back to step 3.', link: ['#/day/2', 'Day 2, sections 4–7'] },
];
export function ProcessLoop() {
  const [k, setK] = useState(3);
  const s = STEPS[k];
  return (
    <div className="fig">
      <ol className="loop-flow loop-click">
        {STEPS.map((x, i) => <li key={x.t}><button aria-pressed={k === i} onClick={() => setK(i)}>{x.t}</button></li>)}
      </ol>
      <div className="loop-detail">
        <p><b>{k + 1} · {s.t}</b></p>
        <p>In R: {s.fn}</p>
        <p>The decision: {s.decide}</p>
        <p><a href={s.link[0]}>→ {s.link[1]}</a></p>
      </div>
      <p className="hint">Steps 3 to 5 form a loop: a model that does not fit is re-specified and estimated again. If it fits, the result goes back to the theory.</p>
    </div>
  );
}

// ---------------------------------------------------------------- causality: three conditions
const COND = ['x precedes y in time', 'x and y are reliably associated', 'no other explanation'];
const CLAIMS: { claim: string; answers: string[]; why: string[] }[] = [
  {
    claim: 'Universalist values make people more open to immigration (ESS 2004, one survey).',
    answers: ['unclear', 'yes', 'unclear'],
    why: ['Values and attitudes were asked in the same interview. That values come first is a theoretical argument (values form early and are stable), not a fact of the design.', 'SEM tests it: in the model of Part 2 the effect of UNIV on ALLOW is 0.44, far from 0.', 'Education, for example, could raise both universalism and openness. Unless it is in the model, its effect hides in the arrow.'],
  },
  {
    claim: 'Education raises universalist values.',
    answers: ['yes', 'yes', 'unclear'],
    why: ['Education is mostly completed long before the values of adults are measured — the design helps here.', 'A correlation SEM can test.', 'Parental background could affect both education and values. Time order alone does not rule out a common cause.'],
  },
  {
    claim: 'Openness to immigration makes people universalist.',
    answers: ['unclear', 'yes', 'unclear'],
    why: ['The same survey as the first claim: the time order is just as open — in either direction.', 'The same correlation as the first claim. The association cannot tell which way the arrow points.', 'As for the first claim. The two models fit equally well — equivalent models (Part 2).'],
  },
];
export function CausalityCheck() {
  const [c, setC] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const cl = CLAIMS[c];
  return (
    <div className="card mini-task quiz">
      <p className="q"><span className="mt-tag">Your turn</span>Does the claim meet the three conditions?</p>
      <div className="seg wrap" role="group" aria-label="Claim">{CLAIMS.map((_, i) => <button key={i} aria-pressed={c === i} onClick={() => setC(i)}>claim {i + 1}</button>)}</div>
      <p><b>“{cl.claim}”</b></p>
      {COND.map((cond, k) => {
        const id = `${c}-${k}`, p = picks[id];
        return (
          <div key={k} className="cz-row">
            <span>{k + 1} · {cond}?</span>
            <div className="seg" role="group" aria-label={cond}>{['yes', 'no', 'unclear'].map(o => <button key={o} aria-pressed={p === o} onClick={() => setPicks(x => ({ ...x, [id]: o }))}>{o}</button>)}</div>
            {p && <p className={`cz-why ${p === cl.answers[k] ? 'ok' : ''}`}>{p === cl.answers[k] ? '✓ ' : `Our answer: ${cl.answers[k]}. `}{cl.why[k]}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- the omitted common cause
export function OmittedVariable() {
  const [b, setB] = useState(0.2);
  const [r, setR] = useState(0);
  const [c, setC] = useState(0.4);
  const est = b + c * r, flipped = b > 0 && est < 0;
  const W = (v: number) => `${Math.min(100, Math.abs(v) * 100)}%`;
  return (
    <div className="fig">
      <div className="fig-row">
        <div>
          <svg viewBox="0 0 300 150" className="fig-svg" role="img" aria-label="x affects y; z, left out of the model, is related to x and affects y" style={{ color: 'var(--ink)' }}>
            {ARROW}
            <Obs x={50} y={110} t="x" w={44} /><Obs x={250} y={110} t="y" w={44} />
            <g className="qz-omit"><Obs x={150} y={28} t="z (left out)" w={100} /></g>
            <Line a={[73, 110]} b={[226, 110]} label={`b = ${b.toFixed(2)}`} />
            <Line a={[112, 34]} b={[60, 96]} both curve={-20} cls="qz-dash" label={`r = ${r.toFixed(2)}`} />
            <Line a={[188, 34]} b={[240, 96]} cls="qz-dash" label={`c = ${c.toFixed(2)}`} />
          </svg>
          <label className="ctl"><span>true effect of x on y (b)</span><input type="range" min={-0.5} max={0.5} step={0.05} value={b} onChange={e => setB(+e.target.value)} /><output>{b.toFixed(2)}</output></label>
          <label className="ctl"><span>correlation of z with x (r)</span><input type="range" min={-0.8} max={0.8} step={0.05} value={r} onChange={e => setR(+e.target.value)} /><output>{r.toFixed(2)}</output></label>
          <label className="ctl"><span>effect of z on y (c)</span><input type="range" min={-0.8} max={0.8} step={0.05} value={c} onChange={e => setC(+e.target.value)} /><output>{c.toFixed(2)}</output></label>
        </div>
        <div className="fig-text">
          <div className="why-bars">
            <div><span>true effect of x</span><i className="lat" style={{ width: W(b) }} /><b>{b.toFixed(2)}</b></div>
            <div><span>estimated without z</span><i className={est < 0 ? 'neg' : 'obs'} style={{ width: W(est) }} /><b>{est.toFixed(2)}</b></div>
          </div>
          <p className="idrow">estimate = b + c · r = {b.toFixed(2)} + {c.toFixed(2)} · {r.toFixed(2)} = <b>{est.toFixed(2)}</b></p>
          <p className="q"><span className="mt-tag">Your turn</span>Keep the true effect at +0.20 and make the estimated effect negative.</p>
          {flipped
            ? <p className="est-goal ok">✓ The estimate has the wrong sign: x seems to harm y although it helps. A left-out cause that is related to x and affects y does that — which is why condition 3, “no other explanation”, is the hardest, and why it comes from theory and design, not from fit.</p>
            : <p className="hint">Leaving z out is harmless only if r = 0 or c = 0: if it is unrelated to x, or does not affect y.</p>}
        </div>
      </div>
    </div>
  );
}
