// Day 0 · the interactive pieces: checks against numbers R must print, small tasks with a
// right answer, the course's R idioms on a toy table, the statistics a CFA builds on (variance,
// covariance, correlation, regression — and the covariance matrix a CFA explains), the values
// circle, the symbols of Day 1, and the self-test.
import { useMemo, useState, type ReactNode } from 'react';
import { Tex } from '../../components/ui.tsx';
import { correlation, normals, rng } from '../../math/stats.ts';
import type { GroupStats } from '../../math/sem.ts';
import { f2, f3 } from '../day1/data.ts';

// ---------------------------------------------------------------- a number R must print
export function NumberCheck({ label, expect, tol, value, onChange, unit, hint, help = '#/day/0#consult' }: {
  label: string; expect: number; tol: number; value: string; onChange: (v: string) => void; unit?: string; hint?: string; help?: string;
}) {
  const id = `nc-${label.replace(/[^a-z0-9]+/gi, '-')}`;
  const [left, setLeft] = useState(value.trim() !== '');
  const v = Number(value.replace(',', '.'));
  const ok = value.trim() !== '' && Number.isFinite(v) && Math.abs(v - expect) <= tol;
  const tried = left && value.trim() !== '';
  return (
    <div className={`ncheck ${ok ? 'ok' : tried ? 'no' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} onBlur={() => setLeft(true)} placeholder="the number R printed" />
      <b aria-live="polite">{ok ? `✓ correct${unit ? ` — ${unit}` : ''}` : tried ? <>✗ not yet — {hint ?? 'copy all the decimals R prints'}, or see <a href={help}>common problems</a></> : ''}</b>
    </div>
  );
}

// ---------------------------------------------------------------- a small task with one right answer
export function MiniTask({ question, options, answer, explain, done, onRight, children }: {
  question: string; options: string[]; answer: number; explain: ReactNode; done: boolean; onRight: () => void; children?: ReactNode;
}) {
  const [picked, setPicked] = useState<number | null>(done ? answer : null);
  const right = picked === answer;
  return (
    <div className={`card mini-task ${right ? 'ok' : ''}`}>
      <p className="q"><span className="mt-tag">Your turn</span>{question}</p>
      {children}
      <div className="choices">
        {options.map((o, i) => (
          <button key={i} disabled={right} className={`choice ${picked === i ? (i === answer ? 'right' : 'wrong') : ''}`}
            onClick={() => { setPicked(i); if (i === answer) onRight(); }}>{picked === i ? (i === answer ? '✓ ' : '✗ ') : ''}{o}</button>
        ))}
      </div>
      {picked !== null && (right ? <div className="reveal" role="status">{explain}</div> : <p className="hint" role="status">Not quite — look again and try another answer.</p>)}
    </div>
  );
}

// ---------------------------------------------------------------- the course's R idioms on a toy table
const TOY = [
  { idno: 1, cntry: 'NL', imptrad: 2, ipfrule: 3, agea: 34 },
  { idno: 2, cntry: 'NL', imptrad: 5, ipfrule: 4, agea: 71 },
  { idno: 3, cntry: 'NL', imptrad: 1, ipfrule: 2, agea: 52 },
  { idno: 4, cntry: 'NL', imptrad: 3, ipfrule: null, agea: 19 },
  { idno: 5, cntry: 'NL', imptrad: 2, ipfrule: 1, agea: 45 },
  { idno: 6, cntry: 'NL', imptrad: 6, ipfrule: 5, agea: 66 },
];
type Row = Record<string, number | string | null>;
const STAGES: { code: string; what: string; run: (r: Row[]) => Row[]; cols?: string[] }[] = [
  { code: 'read_spss(path = "NL2.sav", convert.factors = F, drop.labels = T)', what: 'Reads the SPSS file (package sjlabelled). convert.factors = F keeps the answers as numbers; drop.labels = T removes value labels of codes that do not occur. The codes the ESS defines as missing — refusal, don’t know, no answer — arrive as NA. (F and T are short for FALSE and TRUE.)', run: r => r },
  { code: 'mutate(across(c(imptrad, ipfrule), \\(x) rec(x, rec = "rev")))', what: 'mutate() changes columns; across() applies the same change to several columns; \\(x) is a short function: “for each column x, do rec(x, …)”. rec(rec = "rev") reverses the scale: 1 ↔ 6, 2 ↔ 5, 3 ↔ 4. In the ESS, 1 means “very much like me”; after reversing, higher means “more important”. NA stays NA.', run: r => r.map(x => ({ ...x, imptrad: x.imptrad === null ? null : 7 - (x.imptrad as number), ipfrule: x.ipfrule === null ? null : 7 - (x.ipfrule as number) })) },
  { code: 'select(imptrad, ipfrule)', what: 'Keeps only the columns we need — the items of the model.', run: r => r, cols: ['imptrad', 'ipfrule'] },
  { code: 'frq(imptrad)', what: 'A frequency table (package sjmisc): how many respondents chose each answer, with percentages and the missing answers — the first look at every item (Day 1, step 4). It only prints; it does not change the data.', run: r => r, cols: ['imptrad'] },
];
const FRQ_LABEL = ['Not like me at all', 'Not like me', 'A little like me', 'Somewhat like me', 'Like me', 'Very much like me'];

export function PipelineToy() {
  const [k, setK] = useState(0);
  const rows = useMemo(() => STAGES.slice(0, k + 1).reduce<Row[]>((r, s) => s.run(r), TOY as Row[]), [k]);
  const cols = STAGES.slice(0, k + 1).reduce<string[]>((c, s) => s.cols ?? c, ['idno', 'cntry', 'imptrad', 'ipfrule', 'agea']);
  const frqView = k === 3;
  const valid = rows.filter(r => r.imptrad !== null).length;
  let cum = 0;
  // two blocks, as the course writes them: prepare and save the data once, then look at it
  const lines: { text: string; stage: number | null }[] = [
    { text: 'NL2 <- ', stage: null }, { text: `  ${STAGES[0].code} %>%`, stage: 0 }, { text: `  ${STAGES[1].code}`, stage: 1 },
    { text: '', stage: null },
    { text: 'NL2 %>%', stage: null }, { text: `  ${STAGES[2].code} %>%`, stage: 2 }, { text: `  ${STAGES[3].code}`, stage: 3 },
  ];
  return (
    <div className="fig">
      <p className="hint" style={{ marginTop: 0 }}>A toy table of six invented respondents — to see what each line does. <b>Click a line</b> and watch the table below change.</p>
      <pre className="syntax pipe"><code>{lines.map((l, i) => l.stage === null
        ? <span key={i}>{l.text}{'\n'}</span>
        : <button key={i} className={`pl ${l.stage === k ? 'on' : ''} ${l.stage > k ? 'later' : ''}`} onClick={() => setK(l.stage!)}>{l.text}{'\n'}</button>)}</code></pre>
      <p className="pl-what"><b>{STAGES[k].code.split('(')[0]}</b> — {STAGES[k].what}</p>
      {frqView ? (
        <table className="rp-table toy"><thead><tr><th>Value</th><th>Label</th><th>N</th><th>Valid %</th><th>Cum. %</th></tr></thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6].map(v => { const n = rows.filter(r => r.imptrad === v).length; cum += n; return <tr key={v}><td>{v}</td><td>{FRQ_LABEL[v - 1]}</td><td>{n}</td><td>{(100 * n / valid).toFixed(2)}</td><td>{(100 * cum / valid).toFixed(2)}</td></tr>; })}
            <tr><td className="na">NA</td><td>NA</td><td>{rows.length - valid}</td><td></td><td></td></tr>
          </tbody></table>
      ) : (
        <table className="rp-table toy"><thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{cols.map(c => <td key={c} className={r[c] === null ? 'na' : ''}>{r[c] === null ? 'NA' : String(r[c])}</td>)}</tr>)}</tbody></table>
      )}
      <p className="hint">The pipe <code>%&gt;%</code> reads as “and then”: take the data, and then reverse, and then select, and then count. <code>NL2 &lt;-</code> stores the result; the second block only looks at the data and leaves <code>NL2</code> unchanged.</p>
    </div>
  );
}

/** rec(rec = "rev") on the real item: the ESS answers of imptrad in the Netherlands, before and after. */
export function ReverseItem() {
  const raw = [251, 649, 501, 234, 163, 53];
  const [rev, setRev] = useState(false);
  const counts = rev ? [...raw].reverse() : raw;
  const top = Math.max(...raw);
  const mean = counts.reduce((a, c, i) => a + c * (i + 1), 0) / counts.reduce((a, b) => a + b, 0);
  const lab = rev ? [...FRQ_LABEL] : [...FRQ_LABEL].reverse();
  return (
    <div className="fig">
      <p className="hint" style={{ marginTop: 0 }}>The real answers of the Dutch respondents to <code>imptrad</code>. Switch between the two codings and watch the bars and the mean.</p>
      <div className="seg" role="group" aria-label="Coding">
        <button aria-pressed={!rev} onClick={() => setRev(false)}>as in the ESS file</button>
        <button aria-pressed={rev} onClick={() => setRev(true)}>after rec(rec = "rev")</button>
      </div>
      <div className="rev-bars">
        {counts.map((c, i) => (
          <div key={i} className="rb"><i style={{ height: `${(c / top) * 100}%` }} /><b>{i + 1}</b><small>{lab[i]}</small></div>
        ))}
      </div>
      <p className="hint">Mean {f3(mean)} on the scale 1–6. {rev
        ? 'Now higher values mean that tradition is more important — the direction all course models assume. The same people, the same answers: only the numbers attached to them changed.'
        : 'In the original coding a low value means “like me”: easy to misread. A factor of these items would measure how unimportant tradition is, and every correlation with other variables would have the opposite sign.'}</p>
    </div>
  );
}

// ---------------------------------------------------------------- statistics: variance, covariance, correlation
export function CovarianceExplainer() {
  const [r, setR] = useState(0.5);
  const [sdY, setSdY] = useState(1.5);
  const base = useMemo(() => { const u = rng(7); const a = normals(u, 120), b = normals(u, 120); return { a, b }; }, []);
  const x = base.a, y = base.a.map((v, i) => sdY * (r * v + Math.sqrt(1 - r * r) * base.b[i]));
  const mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length;
  const vx = x.reduce((s, v) => s + (v - mx) ** 2, 0) / (x.length - 1), vy = y.reduce((s, v) => s + (v - my) ** 2, 0) / (y.length - 1);
  const cxy = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / (x.length - 1);
  const rr = correlation(x, y);
  const S = 240, P = 22, sc = (v: number, lim: number) => P + ((Math.max(-lim, Math.min(lim, v)) + lim) / (2 * lim)) * (S - P - 10);
  const b = cxy / vx;
  return (
    <div className="fig">
      <div className="fig-row">
        <svg viewBox={`0 0 ${S} ${S}`} className="fig-scatter" role="img" aria-label={`Scatter plot of 120 simulated people, correlation ${f2(rr)}`}>
          <rect x={P} y="10" width={S - P - 10} height={S - P - 10} rx="8" className="f-plot" />
          <line x1={sc(mx, 3.4)} x2={sc(mx, 3.4)} y1="12" y2={S - P} className="h-grid" />
          <line y1={S - sc(my, 6.8)} y2={S - sc(my, 6.8)} x1={P + 2} x2={S - 12} className="h-grid" />
          {x.map((v, i) => {
            const pos = (v - mx) * (y[i] - my) > 0;
            return <circle key={i} cx={sc(v, 3.4)} cy={S - sc(y[i], 6.8)} r="3" className={`f-dot ${pos ? 'pos' : 'neg'}`} />;
          })}
          <line x1={sc(-3.4, 3.4)} y1={S - sc(my + b * (-3.4 - mx), 6.8)} x2={sc(3.4, 3.4)} y2={S - sc(my + b * (3.4 - mx), 6.8)} className="reg-line" />
          <text x={(S + P) / 2} y={S - 4} className="f-lbl c sm">x</text>
          <text x="8" y={S / 2} className="f-lbl c sm">y</text>
        </svg>
        <div className="fig-text">
          <label className="ctl"><span>Target correlation</span><input type="range" min={-0.9} max={0.9} step={0.05} value={r} onChange={e => setR(+e.target.value)} /><output>{f2(r)}</output></label>
          <label className="ctl"><span>SD of y</span><input type="range" min={0.5} max={3} step={0.1} value={sdY} onChange={e => setSdY(+e.target.value)} /><output>{sdY.toFixed(1)}</output></label>
          <p className="idrow"><Tex>{`s^2_x = ${vx.toFixed(2)} \\quad s^2_y = ${vy.toFixed(2)}`}</Tex></p>
          <p className="idrow"><Tex>{`cov_{xy} = \\tfrac{1}{n-1}\\sum (x-\\bar x)(y-\\bar y) = ${cxy.toFixed(2)}`}</Tex></p>
          <p className="idrow big"><Tex>{`r_{xy} = \\frac{cov_{xy}}{s_x\\, s_y} = ${f2(rr)}`}</Tex></p>
          <p className="idrow"><Tex>{`b_{y \\cdot x} = \\frac{cov_{xy}}{s^2_x} = ${b.toFixed(2)} \\qquad \\beta = r = ${f2(rr)}`}</Tex></p>
        </div>
      </div>
      <ol className="cx-steps">
        <li>Set <i>Target correlation</i> to 0: the cloud is round, green and orange points balance, the covariance is near 0.</li>
        <li>Set it to 0.8: most points turn green, the cloud stretches along the line, the covariance grows.</li>
        <li>Now move <i>SD of y</i>: the covariance and the slope b change — the correlation r stays.</li>
      </ol>
      <p className="hint"><b>Filled green</b> points lie both above or both below the means: they add to the covariance. <b>Hollow orange</b> points lie on opposite sides: they subtract. The slider sets the correlation in the population; in a sample of 120 people the observed r is never exactly the target. s² is the variance — the squared SD.</p>
      <p className="hint">The difference in step 3 returns later: unstandardized loadings change with the units of the items, standardized loadings do not.</p>
    </div>
  );
}

/** The covariance matrix of four items: what a CFA has to explain. */
export function WhatSEMSees({ stats, items }: { stats: GroupStats; items: string[] }) {
  const [cor, setCor] = useState(false);
  const idx = items.map(v => stats.names.indexOf(v));
  const C = idx.map(i => idx.map(j => stats.cov[i][j]));
  const val = (i: number, j: number) => (cor ? C[i][j] / Math.sqrt(C[i][i] * C[j][j]) : C[i][j]);
  const p = items.length, n = (p * (p + 1)) / 2;
  return (
    <div className="fig">
      <div className="seg" role="group" aria-label="Matrix">
        <button aria-pressed={!cor} onClick={() => setCor(false)}>covariances S</button>
        <button aria-pressed={cor} onClick={() => setCor(true)}>correlations R</button>
      </div>
      <div className="covgrid big" style={{ gridTemplateColumns: `86px repeat(${p}, 1fr)` }}>
        <div />{items.map(v => <div key={v} className="h">{v}</div>)}
        {items.map((a, i) => [<div key={`r-${a}`} className="h">{a}</div>, ...items.map((b2, j) => <div key={`${a}-${b2}`} className={j > i ? '' : i === j ? 'var' : 'cov'}>{j > i ? '' : cor && i === j ? '1' : (cor ? f2(val(i, j)) : val(i, j).toFixed(2))}</div>)])}
      </div>
      <p className="hint"><b>{n} numbers</b> — {p} variances (on the diagonal) and {n - p} covariances (below it) of the four tradition and conformity items. The part above the diagonal is the same, so it is left empty. These {n} numbers are the <i>p</i> of Day 1, step 5: the pieces of information a model has to explain.</p>
      <p className="hint">The Netherlands, ESS 2004, the {stats.n.toLocaleString('en')} respondents who answered all course questions (the sample η Lab uses). In R, with every respondent who answered these items, the numbers differ in the second decimal.</p>
    </div>
  );
}

// ---------------------------------------------------------------- Schwartz's values
const CIRCLE: { v: string; hi: string; lines: string[] }[] = [
  { v: 'Self-direction', hi: 'Openness to change', lines: ['Self-', 'direction'] }, { v: 'Stimulation', hi: 'Openness to change', lines: ['Stimu-', 'lation'] }, { v: 'Hedonism', hi: 'Openness to change', lines: ['Hedo-', 'nism'] },
  { v: 'Achievement', hi: 'Self-enhancement', lines: ['Achieve-', 'ment'] }, { v: 'Power', hi: 'Self-enhancement', lines: ['Power'] },
  { v: 'Security', hi: 'Conservation', lines: ['Security'] }, { v: 'Conformity', hi: 'Conservation', lines: ['Confor-', 'mity'] }, { v: 'Tradition', hi: 'Conservation', lines: ['Tradition'] },
  { v: 'Benevolence', hi: 'Self-transcendence', lines: ['Bene-', 'volence'] }, { v: 'Universalism', hi: 'Self-transcendence', lines: ['Univer-', 'salism'] },
];
const HI_CLASS: Record<string, string> = { 'Openness to change': 'v-open', 'Self-enhancement': 'v-enh', Conservation: 'v-cons', 'Self-transcendence': 'v-trans' };
/** The 21 PVQ items with their ESS variable labels, as R shows them (get_label, view_df, frq). */
export const PVQ: { name: string; value: string; label: string }[] = [
  { name: 'ipcrtiv', value: 'Self-direction', label: 'Important to think new ideas and being creative' },
  { name: 'impfree', value: 'Self-direction', label: 'Important to make own decisions and be free' },
  { name: 'impdiff', value: 'Stimulation', label: 'Important to try new and different things in life' },
  { name: 'ipadvnt', value: 'Stimulation', label: 'Important to seek adventures and have an exciting life' },
  { name: 'ipgdtim', value: 'Hedonism', label: 'Important to have a good time' },
  { name: 'impfun', value: 'Hedonism', label: 'Important to seek fun and things that give pleasure' },
  { name: 'ipshabt', value: 'Achievement', label: 'Important to show abilities and be admired' },
  { name: 'ipsuces', value: 'Achievement', label: 'Important to be successful and that people recognize achievements' },
  { name: 'imprich', value: 'Power', label: 'Important to be rich, have money and expensive things' },
  { name: 'iprspot', value: 'Power', label: 'Important to get respect from others' },
  { name: 'impsafe', value: 'Security', label: 'Important to live in secure and safe surroundings' },
  { name: 'ipstrgv', value: 'Security', label: 'Important that government is strong and ensures safety' },
  { name: 'ipfrule', value: 'Conformity', label: 'Important to do what is told and follow rules' },
  { name: 'ipbhprp', value: 'Conformity', label: 'Important to behave properly' },
  { name: 'imptrad', value: 'Tradition', label: 'Important to follow traditions and customs' },
  { name: 'ipmodst', value: 'Tradition', label: 'Important to be humble and modest, not draw attention' },
  { name: 'iphlppl', value: 'Benevolence', label: 'Important to help people and care for others well-being' },
  { name: 'iplylfr', value: 'Benevolence', label: 'Important to be loyal to friends and devote to people close' },
  { name: 'ipeqopt', value: 'Universalism', label: 'Important that people are treated equally and have equal opportunities' },
  { name: 'ipudrst', value: 'Universalism', label: 'Important to understand different people' },
  { name: 'impenv', value: 'Universalism', label: 'Important to care for nature and environment' },
];
const COURSE_DAYS: Record<string, string> = { Tradition: 'Days 1–5', Conformity: 'Days 1–5', Universalism: 'Days 1–4 and 6–8', Benevolence: 'Day 4 (homework)' };

export function ValuesCircle() {
  const [sel, setSel] = useState('Tradition');
  const R = 128, C = 170;
  const items = PVQ.filter(v => v.value === sel);
  const hi = CIRCLE.find(c => c.v === sel)!.hi;
  return (
    <div className="fig">
      <p className="hint" style={{ marginTop: 0 }}><b>Click a value</b> to see its items.</p>
      <div className="fig-row">
        <svg viewBox="0 0 340 340" className="fig-svg" role="img" aria-label="Schwartz's circle of ten basic human values">
          <circle cx={C} cy={C} r={R + 22} className="v-ring" />
          {CIRCLE.map((c, i) => {
            const a = (i / CIRCLE.length) * 2 * Math.PI - Math.PI / 2 + Math.PI / CIRCLE.length;
            const x = C + R * Math.cos(a), y = C + R * Math.sin(a);
            return (
              <g key={c.v} className={`v-node ${HI_CLASS[c.hi]} ${sel === c.v ? 'on' : ''}`} onClick={() => setSel(c.v)} role="button" tabIndex={0} aria-label={c.v} aria-pressed={sel === c.v}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(c.v); } }}>
                <circle cx={x} cy={y} r={sel === c.v ? 33 : 30} />
                <text x={x} y={y + (c.lines.length > 1 ? -2 : 4)} className="f-lbl c b sm">{c.lines.map((l, k) => <tspan key={k} x={x} dy={k ? 12 : 0}>{l}</tspan>)}</text>
              </g>
            );
          })}
          <text x={C} y={C - 8} className="f-lbl c">Schwartz’s</text>
          <text x={C} y={C + 10} className="f-lbl c">ten values</text>
        </svg>
        <div className="fig-text">
          <p><b>{sel}</b> · higher-order value: {hi}{COURSE_DAYS[sel] ? <> · in the course: {COURSE_DAYS[sel]}</> : null}</p>
          <ul className="v-items">{items.map(i => <li key={i.name}><code>{i.name}</code> “{i.label}”</li>)}</ul>
          <div className="v-legend">{Object.entries(HI_CLASS).map(([h, c]) => <span key={h}><i className={c} />{h}</span>)}</div>
          <p className="hint">Neighbouring values are compatible, opposite ones conflict: tradition and conformity sit next to each other (conservation), opposite self-direction and stimulation (openness to change). Hedonism shares elements of openness to change and self-enhancement. The item texts are the ESS variable labels — exactly what R shows you.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the symbols of Day 1
const SYMBOLS: [string, string, string][] = [
  ['\\eta', 'eta', 'the latent variable (factor): the construct itself, never observed'],
  ['y_1 \\dots y_4', '', 'the observed items (indicators)'],
  ['\\lambda', 'lambda', 'a factor loading: how strongly an item reflects the factor'],
  ['\\varepsilon', 'epsilon', 'the error of an item: everything in the answer that is not the factor'],
  ['\\psi', 'psi', 'the variance of the factor'],
  ['\\tau', 'tau', 'in classic test theory (Day 1, start) the true score; from Day 1, step 8 on an item intercept'],
  ['\\kappa', 'kappa', 'the mean of the factor (Day 1, step 8; Day 4)'],
  ['S, \\; \\Sigma(\\theta)', 'sigma, theta', 'the observed covariance matrix, and the one the model implies — θ stands for all parameters of the model together'],
  ['k', '', 'the number of items'],
  ['p, \\; q, \\; df', '', 'observed pieces of information (p = k(k + 1)/2 variances and covariances), free parameters, and df = p − q'],
  ['\\chi^2', 'chi-square', 'the test of how far Σ(θ) is from S'],
];
export function SymbolCard() {
  return (
    <details className="card symbol-card">
      <summary className="st-h">Symbols you will meet on Day 1 — open when you need them</summary>
      <table className="rp-table left"><tbody>{SYMBOLS.map(([t, n, w]) => <tr key={t}><td><Tex>{t}</Tex></td><td><small>{n}</small></td><td>{w}</td></tr>)}</tbody></table>
      <p className="hint">You do not have to learn them now — come back here when Day 1 uses them.</p>
    </details>
  );
}

// ---------------------------------------------------------------- the self-test
export interface QuizItem { q: string; options: string[]; answer: number; why: ReactNode; review: string }
export function SelfTest({ items, onScore }: { items: QuizItem[]; onScore: (right: number) => void }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [round, setRound] = useState(0);
  const right = items.filter((it, i) => picked[i] === it.answer).length;
  const done = Object.keys(picked).length === items.length;
  return (
    <div className="selftest" key={round}>
      <p className="hint" style={{ marginTop: 0 }}>Ten questions; one answer each. You can start again at the end.</p>
      {items.map((it, i) => (
        <div key={i} className="card st-q">
          <p className="q">{i + 1}. {it.q}</p>
          <div className="choices">
            {it.options.map((o, k) => (
              <button key={k} disabled={picked[i] !== undefined}
                className={`choice ${picked[i] !== undefined && k === it.answer ? 'right' : ''} ${picked[i] === k && k !== it.answer ? 'wrong' : ''}`}
                onClick={() => { const next = { ...picked, [i]: k }; setPicked(next); if (Object.keys(next).length === items.length) onScore(items.filter((x, j) => next[j] === x.answer).length); }}>{o}</button>
            ))}
          </div>
          {picked[i] !== undefined && <p className="reveal">{it.why}{picked[i] !== it.answer && <> <a href={it.review}>Review this part →</a></>}</p>}
        </div>
      ))}
      {done && (
        <div className={`st-score ${right >= items.length - 2 ? 'ok' : ''}`}>
          {right} of {items.length} right. {right >= items.length - 2 ? 'You are ready for Day 1.' : 'Look at the parts linked above before Day 1.'}
          <button className="tool" style={{ marginLeft: 10 }} onClick={() => { setPicked({}); setRound(r => r + 1); }}>Start again</button>
        </div>
      )}
    </div>
  );
}

/** An answer field that survives a reload: the number a learner typed into a script check. */
const CHECKS = 'eta-lab.checks.v1';
export function useStoredValue(key: string): [string, (v: string) => void] {
  const [v, setV] = useState(() => {
    try { return (JSON.parse(localStorage.getItem(CHECKS) ?? '{}') as Record<string, string>)[key] ?? ''; } catch { return ''; }
  });
  const set = (x: string) => {
    setV(x);
    try {
      const all = JSON.parse(localStorage.getItem(CHECKS) ?? '{}');
      if (x.trim()) all[key] = x; else delete all[key];
      localStorage.setItem(CHECKS, JSON.stringify(all));
    } catch { /* storage unavailable: the value lives until the page closes */ }
  };
  return [v, set];
}
