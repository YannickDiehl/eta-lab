// Day 2 · the slide figures, made interactive (part 1): the model as a set of assumptions,
// CFA versus sum scores, the input matrices (observed, implied, residual) and ML versus MLR.
import { useMemo, useState } from 'react';
import { Tex } from '../../components/ui.tsx';
import { f2, f3, type Est } from '../day1/data.ts';
import { est, FACTORS, factorCor, factorOf, loadings, type Day2 } from './data.ts';

const SUB = '₁₂₃₄₅₆₇';

// ---------------------------------------------------------------- the two-factor diagram
export interface Extra { kind: 'cross' | 'ecov'; a: string; b: string }   // cross: factor a → item b; ecov: ε_a ↔ ε_b
export const extraKey = (x: Extra) => `${x.kind}:${x.a}:${x.b}`;
const ROW = (i: number) => 18 + i * 44;
const FY = { TRCO: 84, UNIV: 260 } as const;

export function TwoFactorDiagram({ items, extras = [], labels, focus, onItem, corLabel }: {
  items: string[]; extras?: Extra[]; labels?: Record<string, string>; focus?: Extra | null; onItem?: (it: string) => void; corLabel?: string;
}) {
  const yi = (it: string) => ROW(items.indexOf(it)) + 16;
  return (
    <svg viewBox="0 0 470 330" className="fig-svg" role="img" aria-label="Two-factor model: TRCO measured by four items, UNIV by three, factors correlated, each item with an error">
      <defs><marker id="d2-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink)" /></marker>
        <marker id="d2-arr-w" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--neg)" /></marker></defs>
      <path d={`M48 ${FY.TRCO + 22} C 0 ${FY.TRCO + 70} 0 ${FY.UNIV - 70} 48 ${FY.UNIV - 22}`} className="f-arr" markerStart="url(#d2-arr)" markerEnd="url(#d2-arr)" />
      {corLabel && <text x="22" y={(FY.TRCO + FY.UNIV) / 2 + 4} className="f-lbl b halo">{corLabel}</text>}
      {(['TRCO', 'UNIV'] as const).map(f => (
        <g key={f}>
          <ellipse cx="88" cy={FY[f]} rx="48" ry="26" className="f-lat" />
          <text x="88" y={FY[f] + 5} className="f-sym sm">{f}</text>
        </g>
      ))}
      {items.map((it, i) => {
        const f = factorOf(it), first = FACTORS[f][0] === it;
        const lbl = labels?.[it] ?? (first ? '1' : `λ${SUB[i]}`);
        const mid = { x: 136 + 0.72 * 90, y: FY[f] + 0.72 * (yi(it) - FY[f]) };
        return (
          <g key={it} className={`f-item ${focus && (focus.b === it || focus.a === it) ? 'on' : ''}`} onClick={() => onItem?.(it)}>
            <line x1="136" y1={FY[f]} x2="226" y2={yi(it)} className="f-arr" markerEnd="url(#d2-arr)" />
            <text x={mid.x} y={mid.y + 4} className={`f-lbl c b halo ${first && !labels ? 'fixed' : ''}`}>{lbl}</text>
            <rect x="228" y={ROW(i)} width="84" height="32" rx="4" className="f-obs" />
            <text x="270" y={ROW(i) + 21} className="f-lbl c b">{it}</text>
            <line x1="360" y1={yi(it)} x2="315" y2={yi(it)} className="f-arr" markerEnd="url(#d2-arr)" />
            <text x="368" y={yi(it) + 5} className="f-sym sm">ε{SUB[i]}</text>
          </g>
        );
      })}
      {extras.map(x => {
        const on = focus && extraKey(focus) === extraKey(x);
        if (x.kind === 'cross') {
          const f = x.a as 'TRCO' | 'UNIV';
          return <line key={extraKey(x)} x1="136" y1={FY[f]} x2="226" y2={yi(x.b)} className={`f-arr warm ${on ? '' : 'dash'}`} markerEnd="url(#d2-arr-w)" />;
        }
        const ya = yi(x.a), yb = yi(x.b), bend = 400 + Math.min(60, Math.abs(yb - ya) / 3.5);
        return <path key={extraKey(x)} d={`M384 ${ya} C ${bend} ${ya} ${bend} ${yb} 384 ${yb}`} className={`f-arr warm ${on ? '' : 'dash'}`} markerStart="url(#d2-arr-w)" markerEnd="url(#d2-arr-w)" />;
      })}
    </svg>
  );
}

// ---------------------------------------------------------------- everything you see or not see
export function AssumptionDiagram({ d }: { d: Day2 }) {
  const items = d.items;
  const [freed, setFreed] = useState<Extra[]>([]);
  const [notation, setNotation] = useState<'latin' | 'greek'>('latin');
  const cross: Extra[] = items.map(it => ({ kind: 'cross' as const, a: factorOf(it) === 'TRCO' ? 'UNIV' : 'TRCO', b: it }));
  const ecov: Extra[] = items.flatMap((a, i) => items.slice(i + 1).map(b => ({ kind: 'ecov' as const, a, b })));
  const isFree = (x: Extra) => freed.some(y => extraKey(y) === extraKey(x));
  const toggle = (x: Extra) => setFreed(f => isFree(x) ? f.filter(y => extraKey(y) !== extraKey(x)) : [...f, x]);
  const p = (items.length * (items.length + 1)) / 2, q = 15 + freed.length, df = p - q;
  const eq = (it: string) => {
    const i = items.indexOf(it), f = factorOf(it), first = FACTORS[f][0] === it;
    const extra = freed.find(x => x.kind === 'cross' && x.b === it);
    const term = (fac: string, k: string) => notation === 'latin' ? `${k}\\cdot \\text{${fac}}` : `${k}\\,\\eta_{\\text{${fac}}}`;
    const k = first ? '1' : notation === 'latin' ? `f_${i + 1}` : `\\lambda_${i + 1}`;
    return `${notation === 'latin' ? `X_${i + 1}` : `y_${i + 1}`} = ${term(f, k)}${extra ? ` + ${term(extra.a, notation === 'latin' ? `f_{${i + 1}'}` : `\\lambda_{${i + 1}'}`)}` : ''} + ${notation === 'latin' ? `e_${i + 1}` : `\\varepsilon_${i + 1}`}`;
  };
  return (
    <div className="fig">
      <div className="fig-row">
        <TwoFactorDiagram items={items} extras={freed} />
        <div className="fig-formulas">
          <div className="seg" role="group" aria-label="Notation">
            <button aria-pressed={notation === 'latin'} onClick={() => setNotation('latin')}>Latin (X = f·A + e)</button>
            <button aria-pressed={notation === 'greek'} onClick={() => setNotation('greek')}>Greek (y = λη + ε)</button>
          </div>
          <div className="fig-box eqs">{items.map(it => <div key={it} className="eq"><Tex>{eq(it)}</Tex><small>{it}</small></div>)}</div>
          <div className="fig-box">
            <Tex>{notation === 'latin' ? '\\mathrm{Cov}(A, e_i) = 0 \\qquad E(e_i) = 0' : '\\mathrm{Cov}(\\eta, \\varepsilon_i) = 0 \\qquad E(\\varepsilon_i) = 0'}</Tex>
            <span className={`idrow big ${df < 0 ? 'poor' : df === 0 ? 'fair' : 'good'}`}>p = {p} · q = {q} · df = {df}{df < 0 ? ' — not identified' : ''}</span>
          </div>
        </div>
      </div>
      <div className="asm">
        <p><b>What you do not see is fixed to zero.</b> Click an assumption to drop it — the path appears in red and costs one degree of freedom.</p>
        <div className="asm-group"><span>Cross-loadings = 0 ({cross.filter(x => !isFree(x)).length} of 7)</span>
          {cross.map(x => <button key={extraKey(x)} className={`asm-chip ${isFree(x) ? "free" : ""}`} aria-pressed={isFree(x)} onClick={() => toggle(x)}>{x.a} → {x.b}</button>)}</div>
        <div className="asm-group"><span>Error covariances = 0 ({ecov.filter(x => !isFree(x)).length} of 21)</span>
          {ecov.map(x => <button key={extraKey(x)} className={`asm-chip ${isFree(x) ? "free" : ""}`} aria-pressed={isFree(x)} onClick={() => toggle(x)}>ε {x.a} ↔ {x.b}</button>)}</div>
        {freed.length > 0 && <button className="tool" onClick={() => setFreed([])}>Back to the example model</button>}
      </div>
      <p className="hint">Three kinds of restrictions: <b>fixed</b> parameters (a loading set to 1 for the scale; every path you do not draw, set to 0), <b>constrained</b> (equal) parameters — Day 3 — and <b>free</b> parameters, which the data estimate. Each restriction does one of three jobs: it states a <b>theoretical assumption</b> (a cross-loading of 0: ipeqopt has nothing to do with tradition), it <b>identifies</b> the model (the loading of 1 gives the factor its unit), or it is an <b>assumption of the statistical model</b> (Cov(η, ε) = 0).</p>
      <p className="hint">Careful: df ≥ 0 is necessary for an identified model, not sufficient. Free all seven cross-loadings and df is still 6 — but the two factors can no longer be told apart, and the model cannot be estimated.</p>
    </div>
  );
}

// ---------------------------------------------------------------- CFA versus sum scores
export function SumScoreVsFactor({ d }: { d: Day2 }) {
  const items = d.items;
  const [use, setUse] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map(i => [i, true])));
  const S = d.S, idx = (it: string) => items.indexOf(it);
  const pick = (f: 'TRCO' | 'UNIV') => FACTORS[f].filter(it => use[it]);
  const varSum = (a: readonly string[]) => a.reduce((s, x) => s + a.reduce((t, y) => t + S[idx(x)][idx(y)], 0), 0);
  const alpha = (a: readonly string[]) => a.length < 2 ? NaN : (a.length / (a.length - 1)) * (1 - a.reduce((s, x) => s + S[idx(x)][idx(x)], 0) / varSum(a));
  const T = pick('TRCO'), U = pick('UNIV');
  const cov = T.reduce((s, x) => s + U.reduce((t, y) => t + S[idx(x)][idx(y)], 0), 0);
  const rSum = T.length && U.length ? cov / Math.sqrt(varSum(T) * varSum(U)) : NaN;
  const rho = factorCor(d.mlr.estimates);
  const lam = loadings(d.mlr.estimates);
  const avgStd = (f: 'TRCO' | 'UNIV') => { const l = lam.filter(x => (FACTORS[f] as readonly string[]).includes(x.rhs)); return l.reduce((a, x) => a + x.std, 0) / l.length; };
  return (
    <div className="fig">
      <div className="fig-row">
        <div>
          {(['TRCO', 'UNIV'] as const).map(f => (
            <div key={f} className="ss-block">
              <b>{f} sum score</b> = {FACTORS[f].filter(it => use[it]).join(' + ') || '—'}
              {FACTORS[f].map(it => {
                const l = lam.find(x => x.rhs === it)!;
                return (
                  <label key={it} className="ss-row">
                    <input type="checkbox" checked={use[it]} onChange={e => setUse(u => ({ ...u, [it]: e.target.checked }))} />
                    <code>{it}</code>
                    <span className="ss-bars"><i className="eq" style={{ width: use[it] ? `${avgStd(f) * 100}%` : 0 }} title="weight in the sum score" /><i className="lam" style={{ width: `${l.std * 100}%` }} title="standardized loading" /></span>
                    <small>{f2(l.std)}</small>
                  </label>
                );
              })}
              <small className="hint">α = {Number.isFinite(alpha(f === 'TRCO' ? T : U)) ? f2(alpha(f === 'TRCO' ? T : U)) : '–'}</small>
            </div>
          ))}
          <p className="hint"><i className="key eq" /> equal weight in the sum score (drawn at the factor’s average loading) · <i className="key lam" /> the item’s standardized loading in the CFA</p>
        </div>
        <div className="fig-text">
          <p className="idrow big">r between the sum scores = {Number.isFinite(rSum) ? f2(rSum) : '–'}</p>
          <p className="idrow big good">r between the factors = {f2(rho)} <small>(estimated once, with all items)</small></p>
          {Number.isFinite(rSum) && T.length > 1 && U.length > 1 && <p className="idrow"><Tex>{`\\frac{r_{sum}}{\\sqrt{\\alpha_T\\,\\alpha_U}} = \\frac{${f2(rSum)}}{\\sqrt{${f2(alpha(T))} \\cdot ${f2(alpha(U))}}} = ${f2(rSum / Math.sqrt(alpha(T) * alpha(U)))}`}</Tex></p>}
          <p>The sum scores correlate less than the constructs: their measurement error is part of the score and <b>attenuates</b> the correlation. The factors are free of measurement error. Dividing by the square root of the two reliabilities (α) undoes the attenuation — and lands close to the factor correlation.</p>
          <p className="hint"><b>Try it:</b> untick <code>ipmodst</code>. What happens to α and to the correlation of the sum scores? Why does the factor correlation not move?</p>
          <p className="hint">A sum score assumes equal weights for all items, equal measurement errors — and that the items are unidimensional. The CFA estimates the weights, separates error from the construct, and tests unidimensionality.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- observed, implied, residual
type View = 'S' | 'Sigma' | 'res' | 'R_obs' | 'R_imp' | 'resid_cor' | 'resid_z';
const VIEWS: { id: View; label: string; tex: string; kind: 'seq' | 'div'; what: string }[] = [
  { id: 'S', label: 'observed S', tex: 'S', kind: 'seq', what: 'The sample covariance matrix: the data a CFA works with — p = 28 variances and covariances.' },
  { id: 'Sigma', label: 'implied Σ(θ)', tex: '\\Sigma(\\hat\\theta)', kind: 'seq', what: 'The covariances the estimated model implies: within a factor, loading × loading × factor variance; across the factors, loading × loading × factor covariance; on the diagonal, loading² × factor variance + error variance.' },
  { id: 'res', label: 'S − Σ(θ)', tex: 'S - \\Sigma(\\hat\\theta)', kind: 'div', what: 'What the model does not reproduce. ML chooses the parameters to make this as small as possible, in the sense of F_ML.' },
  { id: 'R_obs', label: 'observed R', tex: 'R', kind: 'seq', what: 'The same data as correlations: easier to read, but the CFA is estimated from covariances.' },
  { id: 'R_imp', label: 'implied R', tex: '\\hat R', kind: 'seq', what: 'The implied covariances, standardized.' },
  { id: 'resid_cor', label: 'residual r', tex: 'R - \\hat R', kind: 'div', what: 'Correlation residuals: |r| > .10 is worth a look.' },
  { id: 'resid_z', label: 'standardized', tex: 'z', kind: 'div', what: 'Standardized residuals: a residual divided by its standard error. |z| > 1.96 is significant at the 5% level.' },
];

export function MatrixPanel({ d }: { d: Day2 }) {
  const [view, setView] = useState<View>('res');
  const [cell, setCell] = useState<[number, number] | null>([6, 1]);
  const v = VIEWS.find(x => x.id === view)!;
  const M = useMemo(() => view === 'res' ? d.S.map((r, i) => r.map((x, j) => x - d.Sigma[i][j])) : (d[view] as number[][]), [d, view]);
  const max = Math.max(...M.flatMap((r, i) => r.filter((_, j) => j < i || (v.kind === 'seq' && j === i)).map(Math.abs)));
  const bg = (x: number) => v.kind === 'div'
    ? `rgba(${x >= 0 ? '29,158,117' : '216,90,48'},${Math.min(0.85, (Math.abs(x) / max) * 0.85)})`
    : `rgba(127,119,221,${Math.min(0.85, (Math.abs(x) / max) * 0.85)})`;
  const dec = view === 'resid_z' ? 1 : view === 'res' || view === 'resid_cor' ? 3 : 2;
  const items = d.items, nT = FACTORS.TRCO.length;
  const [i, j] = cell ?? [-1, -1];
  return (
    <div className="fig">
      <div className="seg wrap" role="group" aria-label="Matrix">
        {VIEWS.map(x => <button key={x.id} aria-pressed={view === x.id} onClick={() => setView(x.id)}>{x.label}</button>)}
      </div>
      <div className="fig-row">
        <div className="mx2" style={{ gridTemplateColumns: `var(--mx-lab, 70px) repeat(${items.length}, minmax(0, 1fr))` }} role="table" aria-label={v.label}>
          <div />
          {items.map((it, c) => <div key={it} className={`h ${c === nT ? 'gap' : ''}`}>{it}</div>)}
          {M.map((row, r) => [
            <div key={'r' + r} className={`h l ${r === nT ? 'gapr' : ''}`}>{items[r]}</div>,
            ...row.map((x, c) => {
              if (c > r || (c === r && v.kind === 'div')) return <div key={c} className={c === nT ? 'gap' : ''} />;
              const on = (r === i && c === j);
              const sig = view === 'resid_z' && Math.abs(x) > 1.96;
              return (
                <button key={c} className={`${on ? 'on' : ''} ${sig ? 'sig' : ''} ${c === nT ? 'gap' : ''} ${r === nT ? 'gapr' : ''}`} style={{ background: bg(x) }}
                  onClick={() => setCell([r, c])} aria-label={`${items[r]} and ${items[c]}: ${x.toFixed(dec)}`}>{x.toFixed(dec).replace(/^(-?)0\./, '$1.')}</button>
              );
            }),
          ])}
        </div>
        <div className="fig-text">
          <p><Tex>{v.tex}</Tex> — {v.what}</p>
          {cell && i !== j && (
            <div className="fig-box">
              <b>{items[i]} · {items[j]}</b>
              <span>observed covariance {f3(d.S[i][j])} · implied {f3(d.Sigma[i][j])}</span>
              <span>observed r {f2(d.R_obs[i][j])} · implied r {f2(d.R_imp[i][j])}</span>
              <span className={Math.abs(d.resid_z[i][j]) > 1.96 ? 'poor' : 'good'}>standardized residual z = {d.resid_z[i][j].toFixed(2)}</span>
              <small className="hint">{factorOf(items[i]) === factorOf(items[j]) ? `Both items measure ${factorOf(items[i])}: the model explains their covariance with the two loadings and the factor variance.` : 'One item of each factor: the model explains this covariance only through the one factor correlation.'}</small>
            </div>
          )}
          {cell && i === j && <div className="fig-box"><b>{items[i]}</b><span>variance {f3(d.S[i][i])} — reproduced exactly: λ²ψ + θ has its own error variance θ to fill the gap.</span></div>}
        </div>
      </div>
      <p className="hint"><b>How to read it:</b> 1. start with S − Σ(θ) and click the darkest cell; 2. switch to “standardized”: which cells are framed (|z| &gt; 1.96)? 3. In which block do they lie? The gaps separate the tradition/conformity block, the universalism block and the twelve covariances between them. Click a cell; in the standardized view, a frame marks |z| &gt; 1.96.</p>
    </div>
  );
}

// ---------------------------------------------------------------- ML versus MLR
export function EstimatorCompare({ d }: { d: Day2 }) {
  const rows = d.ml.estimates.filter(e => e.op === '=~' || e.lhs !== e.rhs || e.lhs === 'TRCO' || e.lhs === 'UNIV');
  const pair = (e: Est) => est(d.mlr.estimates, e.lhs, e.op, e.rhs)!;
  const ml = d.ml.fit, mlr = d.mlr.fit;
  const maxSe = Math.max(...rows.map(e => Math.max(e.se, pair(e).se)));
  return (
    <div className="fig">
      <div className="fig-row">
        <table className="rp-table est-cmp">
          <thead><tr><th>parameter</th><th>estimate</th><th>SE · ML</th><th>SE · MLR</th></tr></thead>
          <tbody>{rows.map(e => {
            const r = pair(e);
            return (
              <tr key={e.lhs + e.op + e.rhs}>
                <td><code>{e.lhs} {e.op} {e.rhs}</code></td>
                <td>{e.se === 0 ? '1 (fixed)' : e.est.toFixed(3)}</td>
                <td><span className="sebar"><i style={{ width: `${(e.se / maxSe) * 100}%` }} /></span>{e.se ? e.se.toFixed(3) : '–'}</td>
                <td><span className="sebar mlr"><i style={{ width: `${(r.se / maxSe) * 100}%` }} /></span>{r.se ? r.se.toFixed(3) : '–'}</td>
              </tr>
            );
          })}</tbody>
        </table>
        <div className="fig-text">
          <p className="idrow"><Tex>{`\\chi^2_{ML} = ${ml.chisq.toFixed(2)} \\quad (df = ${ml.df})`}</Tex></p>
          <p className="idrow"><Tex>{`\\chi^2_{MLR} = \\frac{${ml.chisq.toFixed(2)}}{${mlr['chisq.scaling.factor'].toFixed(3)}} = ${mlr['chisq.scaled'].toFixed(2)}`}</Tex></p>
          <p>Same estimates, larger standard errors, a smaller χ²: MLR does not change <i>what</i> the model estimates, only how certain it claims to be. The skewed answers make ML overconfident.</p>
          <p className="hint">The scaling correction factor {mlr['chisq.scaling.factor'].toFixed(3)} says, roughly, how much heavier the tails of the data are than under normality (1: no correction). Because of it, two MLR χ² values cannot simply be subtracted — use the Satorra–Bentler difference test (section 6).</p>
        </div>
      </div>
    </div>
  );
}
