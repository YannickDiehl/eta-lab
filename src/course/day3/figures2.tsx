// Day 3 · reliability (alpha assumes tau-equivalence, omega does not), identification by hand
// (three items: the loadings follow from three correlations; two items: one equation short),
// and the simultaneous CFA of values and attitudes toward immigration with its modification indices.
import { useState } from 'react';
import { Tex } from '../../components/ui.tsx';
import { f2, f3 } from '../day1/data.ts';
import { NumberCheck } from '../day0/widgets.tsx';
import { ALLOW_ITEMS, pick, sgn, TRCO_ITEMS, UNIV_ITEMS, type Day3 } from './data.ts';

// ---------------------------------------------------------------- alpha and omega
const omegaOf = (l: number[]) => { const s = l.reduce((a, b) => a + b, 0); return (s * s) / (s * s + l.reduce((a, b) => a + (1 - b * b), 0)); };
/** Cronbach's alpha of standardized items whose correlations are r_ij = λ_i λ_j. */
const alphaOf = (l: number[]) => {
  const k = l.length; let off = 0;
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) off += l[i] * l[j];
  return (k / (k - 1)) * (1 - k / (k + 2 * off));
};
export function AlphaOmega({ d }: { d: Day3 }) {
  const start = TRCO_ITEMS.map(it => pick(d.trco.estimates.congeneric, '=~', 'TRCO', it)!.std);
  const [l, setL] = useState(start);
  const om = omegaOf(l), al = alphaOf(l);
  const mean = l.reduce((a, b) => a + b, 0) / l.length;
  const r = d.reliability.trco;
  return (
    <div className="fig">
      <div className="fig-row">
        <div>
          {TRCO_ITEMS.map((it, i) => (
            <label key={it} className="ctl"><span>λ {it}</span><input type="range" min={0.1} max={0.95} step={0.01} value={l[i]} onChange={e => { const n = l.slice(); n[i] = +e.target.value; setL(n); }} /><output>{f2(l[i])}</output></label>
          ))}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="tool" onClick={() => setL(l.map(() => mean))}>make them equal (tau-equivalent)</button>
            <button className="tool" onClick={() => setL([0.2, 0.3, 0.8, 0.9])}>very unequal</button>
            <button className="tool" onClick={() => setL(start)}>the data</button>
          </div>
        </div>
        <div className="fig-text">
          <div className="why-bars">
            <div><span>omega ω (congeneric)</span><i className="lat" style={{ width: `${om * 100}%` }} /><b>{f3(om)}</b></div>
            <div><span>Cronbach’s alpha α</span><i className="obs" style={{ width: `${al * 100}%` }} /><b>{f3(al)}</b></div>
          </div>
          <p>{Math.abs(om - al) < 0.002
            ? 'Equal loadings: alpha and omega agree. Alpha is the reliability of a sum score — if the items are tau-equivalent.'
            : `Unequal loadings: alpha (${f3(al)}) is below omega (${f3(om)}). Alpha assumes tau-equivalence; when the items differ, it underestimates the reliability of the sum.`}</p>
          <p className="hint">Computed here from the standardized loadings, as for standardized items — R works on the raw scale, hence slightly different values. From R, for the four tradition/conformity items: ω = {f3(r.omega_congeneric)}, α = {f3(r.alpha)} — close, because the loadings differ only moderately; but the tau-equivalent model that alpha assumes is rejected by the data (section 5).</p>
          <div className="sc-formula"><Tex block>{'\\omega = \\frac{(\\sum_i \\lambda_i)^2}{(\\sum_i \\lambda_i)^2 + \\sum_i \\theta_{ii}}'}</Tex></div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- identification by hand
export function ByHand({ d }: { d: Day3 }) {
  const b = d.by_hand, r = b.r;
  const r12 = r[1][0], r13 = r[2][0], r23 = r[2][1];
  const [v, setV] = useState('');
  const [two, setTwo] = useState(0.6);
  return (
    <div className="fig">
      <div className="fig-row">
        <div>
          <p><b>Three items.</b> With the factor variance fixed to 1, the model says r<sub>ij</sub> = λ<sub>i</sub> λ<sub>j</sub>. Three correlations, three loadings — three equations, three unknowns:</p>
          <table className="rp-table">
            <thead><tr><th /><th>{b.items[0]}</th><th>{b.items[1]}</th></tr></thead>
            <tbody>
              <tr><td>{b.items[1]}</td><td>r₁₂ = {f3(r12)}</td><td /></tr>
              <tr><td>{b.items[2]}</td><td>r₁₃ = {f3(r13)}</td><td>r₂₃ = {f3(r23)}</td></tr>
            </tbody>
          </table>
          <div className="sc-formula"><Tex block>{`\\lambda_1 = \\sqrt{\\frac{r_{12}\\, r_{13}}{r_{23}}} = \\sqrt{\\frac{${f3(r12)} \\cdot ${f3(r13)}}{${f3(r23)}}}`}</Tex></div>
          <NumberCheck label="λ₁ (ipeqopt) =" expect={b.lambda[0]} tol={0.006} value={v} onChange={setV} unit="the standardized loading lavaan estimates" hint="multiply r₁₂ by r₁₃, divide by r₂₃, take the square root" />
          {Math.abs(Number(v.replace(',', '.')) - b.lambda[0]) <= 0.006 && <p className="est-goal ok">✓ By hand: λ = {b.lambda.map(f3).join(', ')} — lavaan’s standardized loadings: {b.lavaan.map(f3).join(', ')}. Identical: a just-identified model is solved, not estimated.</p>}
        </div>
        <div className="fig-text">
          <p><b>Two items.</b> One correlation, two loadings: r₁₂ = λ₁λ₂. Choose λ₁ — λ₂ follows, and every choice reproduces the data perfectly:</p>
          <label className="ctl"><span>λ₁</span><input type="range" min={0.15} max={1} step={0.01} value={two} onChange={e => setTwo(+e.target.value)} /><output>{f2(two)}</output></label>
          <p className="idrow">λ₂ = r₁₂ / λ₁ = {f3(r12)} / {f2(two)} = <b>{f3(r12 / two)}</b>{r12 / two > 1 ? ' — above 1: impossible for a standardized loading' : ''} · λ₁λ₂ = {f3(r12)} ✓</p>
          <p>The data cannot choose between these solutions: the model is <b>not identified</b>. A two-item factor needs help — an equality (λ₁ = λ₂, tau-equivalence) or a correlation with another factor that lends it information (the simultaneous CFA of section 7).</p>
          <p className="hint">The counting rule says it at once: two items give p = 3 variances and covariances, the factor needs q = 4 parameters (1 loading, 2 error variances, 1 factor variance): df = −1.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the simultaneous CFA
const ALLOW_LABELS: Record<string, string> = {
  imsmetn: 'Allow many/few immigrants of the same race or ethnic group as the majority',
  imdfetn: 'Allow many/few immigrants of a different race or ethnic group from the majority',
  impcntr: 'Allow many/few immigrants from poorer countries outside Europe',
};
export const SCFA_LABELS = ALLOW_LABELS;
export function ScfaView({ d, labels }: { d: Day3; labels: Record<string, string> }) {
  const s = d.scfa;
  const [k, setK] = useState(0);
  const m = s.mi[k];
  const fc = (a: string, b: string) => { const i = s.factor_cor.names.indexOf(a), j = s.factor_cor.names.indexOf(b); return s.factor_cor.values[Math.max(i, j)][Math.min(i, j)]; };
  const std = (f: string, it: string) => pick(s.estimates, '=~', f, it)?.std ?? 0;
  const isCross = m.op === '=~';
  const facts: [string, string[], number][] = [['TRCO', TRCO_ITEMS, 60], ['UNIV', UNIV_ITEMS, 190], ['ALLOW', ALLOW_ITEMS, 300]];
  const yOf = (it: string) => { let y = 0; facts.forEach(([, its, c]) => { const i = its.indexOf(it); if (i >= 0) y = c + (i - (its.length - 1) / 2) * 30; }); return y; };
  const fy = (f: string) => facts.find(x => x[0] === f)![2];
  return (
    <div className="fig">
      <div className="fig-row">
        <svg viewBox="0 0 450 360" className="fig-svg" role="img" aria-label="Simultaneous CFA of three constructs with factor correlations; the selected modification index is drawn dashed" style={{ color: 'var(--ink)' }}>
          <defs><marker id="sc-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor" /></marker></defs>
          {facts.map(([f, its]) => its.map(it => (
            <g key={it}>
              <line x1="236" y1={fy(f)} x2="318" y2={yOf(it)} className="sc-load" markerEnd="url(#sc-a)" />
              <text x="282" y={(fy(f) + yOf(it)) / 2 - 2} className="f-lbl sm c">{f2(std(f, it))}</text>
              <rect x="320" y={yOf(it) - 11} width="84" height="22" rx="3" className="f-obs" /><text x="362" y={yOf(it) + 4} className="f-lbl c sm">{it}</text>
            </g>
          )))}
          {[['TRCO', 'UNIV', -60], ['UNIV', 'ALLOW', -60], ['TRCO', 'ALLOW', -130]].map(([a, b, c]) => (
            <g key={`${a}${b}`}>
              <path d={`M188 ${fy(a as string) + 8} Q ${188 + (c as number)} ${(fy(a as string) + fy(b as string)) / 2} 188 ${fy(b as string) - 8}`} fill="none" className="sc-cor" markerStart="url(#sc-a)" markerEnd="url(#sc-a)" />
              <text x={188 + (c as number) / 2 - 4} y={(fy(a as string) + fy(b as string)) / 2 + 4} className="f-lbl c b">{f2(fc(a as string, b as string))}</text>
            </g>
          ))}
          {isCross && <line x1="236" y1={fy(m.lhs)} x2="318" y2={yOf(m.rhs)} className="sc-mi" markerEnd="url(#sc-a)" />}
          {!isCross && <path d={`M406 ${yOf(m.lhs)} Q 440 ${(yOf(m.lhs) + yOf(m.rhs)) / 2} 406 ${yOf(m.rhs)}`} fill="none" className="sc-mi" markerStart="url(#sc-a)" markerEnd="url(#sc-a)" />}
          {facts.map(([f]) => <g key={f}><ellipse cx="212" cy={fy(f)} rx="30" ry="20" className="f-lat" /><text x="212" y={fy(f) + 4} className="f-lbl c b sm">{f}</text></g>)}
        </svg>
        <div className="fig-text">
          <table className="rp-table mi-pick">
            <thead><tr><th>lhs</th><th>op</th><th>rhs</th><th>mi</th><th>epc</th><th>sepc.all</th></tr></thead>
            <tbody>{s.mi.slice(0, 8).map((r, i) => <tr key={i} className={i === k ? 'on' : ''} onClick={() => setK(i)} style={{ cursor: 'pointer' }}><td>{r.lhs}</td><td>{r.op}</td><td>{r.rhs}</td><td>{r.mi.toFixed(1)}</td><td>{sgn(r.epc)}</td><td>{sgn(r.sepc)}</td></tr>)}</tbody>
          </table>
          <p className="hint">Click a row: the parameter is drawn dashed in the diagram.</p>
          <p>{isCross
            ? <><b>A cross-loading:</b> {m.rhs} (“{labels[m.rhs] ?? ALLOW_LABELS[m.rhs]}”) would load on {m.lhs} too. χ² would drop by about {m.mi.toFixed(1)}; the loading would be about {sgn(m.sepc, 2)} (standardized). A cross-loading says the item measures two constructs — the items of one factor are no longer pure.</>
            : <><b>An error covariance:</b> {m.lhs} and {m.rhs} share something beyond their factors (“{labels[m.lhs] ?? ALLOW_LABELS[m.lhs]}” · “{labels[m.rhs] ?? ALLOW_LABELS[m.rhs]}”). χ² would drop by about {m.mi.toFixed(1)}; the residual correlation would be about {sgn(m.sepc, 2)}. Wording, a common response format, or a shared idea that is neither construct.</>}</p>
        </div>
      </div>
    </div>
  );
}

export function SeparateVsSimultaneous({ d }: { d: Day3 }) {
  const s = d.scfa;
  const rows: [string, Record<string, number>, string][] = [
    ['tradition/conformity alone', s.separate.trco, '4 items'],
    ['universalism alone', s.separate.univ, '3 items: just identified'],
    ['allow immigrants alone', s.separate.allow, '3 items: just identified'],
    ['all three together', s.fit, '10 items, 3 factor correlations'],
  ];
  return (
    <table className="rp-table">
      <thead><tr><th>model</th><th /><th>χ² scaled (df)</th><th>CFI</th><th>RMSEA</th><th>SRMR</th></tr></thead>
      <tbody>{rows.map(([n, f, w]) => <tr key={n}><td><b>{n}</b></td><td><small>{w}</small></td><td>{f['chisq.scaled'].toFixed(2)} ({f.df})</td><td>{f.df ? f3(f['cfi.robust']) : '—'}</td><td>{f.df ? f3(f['rmsea.robust']) : '—'}</td><td>{f3(f.srmr)}</td></tr>)}</tbody>
    </table>
  );
}

// ---------------------------------------------------------------- standardized and unstandardized
export function StdConverter({ d }: { d: Day3 }) {
  const [k, setK] = useState(3);
  const [v, setV] = useState('');
  const e = d.trco.estimates.congeneric, it = TRCO_ITEMS[k];
  const b = pick(e, '=~', 'TRCO', it)!.est, th = pick(e, '~~', it, it)!.est, psi = pick(e, '~~', 'TRCO', 'TRCO')!.est;
  const sy = Math.sqrt(b * b * psi + th), sx = Math.sqrt(psi), std = (b * sx) / sy;
  return (
    <div className="fig">
      <div className="seg wrap" role="group" aria-label="Item">{TRCO_ITEMS.map((x, i) => <button key={x} aria-pressed={k === i} onClick={() => { setK(i); setV(''); }}>{x}</button>)}</div>
      <div className="fig-row">
        <div>
          <table className="rp-table left">
            <tbody>
              <tr><td>unstandardized loading b</td><td><b>{b.toFixed(3)}</b>{k === 0 ? ' (fixed: the marker)' : ''}</td></tr>
              <tr><td>factor variance ψ, its SD √ψ</td><td>{psi.toFixed(3)}, <b>{sx.toFixed(3)}</b></td></tr>
              <tr><td>error variance θ</td><td>{th.toFixed(3)}</td></tr>
              <tr><td>model-implied SD of the item √(b²ψ + θ)</td><td><b>{sy.toFixed(3)}</b></td></tr>
            </tbody>
          </table>
          <div className="sc-formula"><Tex block>{`b^{*} = b\\,\\frac{SD_\\eta}{SD_y} = ${b.toFixed(3)} \\cdot \\frac{${sx.toFixed(3)}}{${sy.toFixed(3)}}`}</Tex></div>
          <NumberCheck label={`standardized loading of ${it} =`} expect={std} tol={0.006} value={v} onChange={setV} unit="std.all in lavaan’s output" hint="b times the SD of the factor, divided by the SD of the item" />
        </div>
        <div className="fig-text">
          <p>The unstandardized loading is in the units of the items: one unit more of the factor (in the unit of the marker item, ipmodst) moves the answer to {it} by {b.toFixed(2)} points on the 1–6 scale.</p>
          <p>The standardized loading puts both in standard deviations: one SD more of tradition/conformity goes with {std.toFixed(2)} SD more on {it} — and, with one factor, it is the correlation of item and factor. Its square, {(std * std).toFixed(2)}, is the item’s R²: the share of its variance the factor explains.</p>
          <p className="hint">lavaan prints two standardized columns: <code>Std.lv</code> standardizes only the factor (b · SD<sub>η</sub> = {(b * sx).toFixed(3)}: the item’s change in its own points per SD of the factor), <code>Std.all</code> both factor and item. When a study reports a “standardized solution”, check which one it is.</p>
        </div>
      </div>
    </div>
  );
}
