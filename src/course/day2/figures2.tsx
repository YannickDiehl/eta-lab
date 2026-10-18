// Day 2 · the course's figures, made interactive (part 2): ordinal items and thresholds, the
// global fit rulers, the worksheet's evaluation checklist, local fit (modification indices and
// Wald tests), nested model comparisons, Jöreskog's three situations, and the homework.
import { useState } from 'react';
import { Choose, Tex } from '../../components/ui.tsx';
import { CUTOFFS } from '../../math/cutoffs.ts';
import { f2, f3 } from '../day1/data.ts';
import { est, factorCor, loadings, type Day2, type Fit } from './data.ts';
import { TwoFactorDiagram, type Extra } from './figures1.tsx';

const SCALE = ['not like me at all', 'not like me', 'a little like me', 'somewhat like me', 'like me', 'very much like me'];
const phi = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
function Phi(x: number) {   // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// ---------------------------------------------------------------- thresholds
export function Thresholds({ d, labels }: { d: Day2; labels: Record<string, string> }) {
  const [item, setItem] = useState('imptrad');
  const [hover, setHover] = useState<number | null>(4);
  const th = d.ord.thresholds.filter(t => t.item === item).sort((a, b) => a.t - b.t).map(t => t.value);
  const frq = d.frq.find(f => f.item === item)!, total = frq.counts.reduce((a, b) => a + b, 0);
  const W = 460, H = 200, X = (z: number) => 20 + ((z + 3.2) / 6.4) * (W - 40), Y = (p: number) => 150 - p * 300;
  const cuts = [-3.2, ...th, 3.2];
  const area = (k: number) => {
    const pts = Array.from({ length: 30 }, (_, i) => cuts[k] + (i / 29) * (cuts[k + 1] - cuts[k]));
    return `M${X(cuts[k])} 150 ` + pts.map(z => `L${X(z).toFixed(1)} ${Y(phi(z)).toFixed(1)}`).join(' ') + ` L${X(cuts[k + 1])} 150 Z`;
  };
  const model = (k: number) => Phi(cuts[k + 1]) - Phi(cuts[k]);
  return (
    <div className="fig">
      <div className="seg wrap" role="group" aria-label="Item">
        {d.items.map(it => <button key={it} aria-pressed={item === it} onClick={() => setItem(it)}>{it}</button>)}
      </div>
      <div className="fig-row">
        <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label={`Latent response variable of ${item} with five thresholds`}>
          {cuts.slice(0, -1).map((_, k) => <path key={k} d={area(k)} className={`th-area k${k} ${hover === k ? 'on' : ''}`} onMouseEnter={() => setHover(k)} onClick={() => setHover(k)} />)}
          <path d={Array.from({ length: 121 }, (_, i) => { const z = -3.2 + i * 6.4 / 120; return `${i ? 'L' : 'M'}${X(z).toFixed(1)} ${Y(phi(z)).toFixed(1)}`; }).join(' ')} className="h-curve" />
          <line x1="20" x2={W - 20} y1="150" y2="150" className="f-arr" />
          {th.map((t, k) => (
            <g key={k}>
              <line x1={X(t)} x2={X(t)} y1="30" y2="156" className="th-line" />
              <text x={X(t)} y="24" className="f-lbl c b">ν{'₁₂₃₄₅'[k]}</text>
              <text x={X(t)} y="170" className="f-lbl c sm">{t.toFixed(2)}</text>
            </g>
          ))}
          {cuts.slice(0, -1).map((_, k) => <text key={k} x={X((cuts[k] + cuts[k + 1]) / 2)} y="142" className="f-lbl c b">{k + 1}</text>)}
          <text x={W / 2} y="192" className="f-lbl c">latent response variable y*</text>
        </svg>
        <div className="fig-text">
          <p><b>{item}</b> — “{labels[item]}”</p>
          {hover !== null && <p className="idrow big">answer {hover + 1}: “{SCALE[hover]}”</p>}
          {hover !== null && <p>y* {hover === 0 ? `below ν₁ = ${th[0].toFixed(2)}` : hover === 5 ? `above ν₅ = ${th[4].toFixed(2)}` : `between ν${'₁₂₃₄₅'[hover - 1]} and ν${'₁₂₃₄₅'[hover]}`} → {(100 * model(hover)).toFixed(1)}% of the area; observed {(100 * frq.counts[hover] / total).toFixed(1)}% ({frq.counts[hover]} respondents).</p>}
          <p className="hint">Six categories, five thresholds. They partition the latent response variable: if y* exceeds a threshold, the observed answer moves to the next category.</p>
        </div>
      </div>
    </div>
  );
}

export function PearsonVsPolychoric({ d }: { d: Day2 }) {
  const pts: { a: string; b: string; r: number; p: number }[] = [];
  d.items.forEach((a, i) => d.items.forEach((b, j) => { if (j < i) pts.push({ a, b, r: d.R_obs[i][j], p: d.ord.R_poly[i][j] }); }));
  const [sel, setSel] = useState(pts.reduce((m, x, k) => (x.p - x.r > pts[m].p - pts[m].r ? k : m), 0));
  const all = pts.flatMap(x => [x.r, x.p]);
  const lo = Math.floor(Math.min(...all) * 10) / 10, hi = Math.ceil(Math.max(...all) * 10) / 10;
  const S = 220, P = (v: number) => 24 + ((v - lo) / (hi - lo)) * (S - 44);
  const lamC = loadings(d.mlr.estimates), lamO = loadings(d.ord.estimates);
  const s = pts[sel];
  return (
    <div className="fig">
      <div className="fig-row">
        <svg viewBox={`-14 0 ${S + 14} ${S + 14}`} className="fig-svg poly-plot" role="img" aria-label="Polychoric against Pearson correlations of the 21 item pairs">
          <rect x={P(lo)} y={S - P(hi)} width={P(hi) - P(lo)} height={P(hi) - P(lo)} className="f-plot" />
          <line x1={P(lo)} y1={S - P(lo)} x2={P(hi)} y2={S - P(hi)} className="f-arr dash" />
          {[lo, hi].map(v => <g key={v}><text x={P(v)} y={S - 8} className="f-lbl c sm">{f2(v)}</text><text x="20" y={S - P(v) + 4} className="f-lbl sm" textAnchor="end">{f2(v)}</text></g>)}
          {pts.map((x, k) => <circle key={k} cx={P(x.r)} cy={S - P(x.p)} r={k === sel ? 6 : 4} className={`f-dot ${k === sel ? 'on' : ''}`} onClick={() => setSel(k)} onMouseEnter={() => setSel(k)} />)}
          <text x={S / 2 + 8} y={S + 8} className="f-lbl c sm">Pearson r (FIML)</text>
          <text x="-4" y={S / 2 - 10} className="f-lbl c sm" transform={`rotate(-90 -4 ${S / 2 - 10})`}>polychoric r (WLSMV)</text>
        </svg>
        <div className="fig-text">
          <p className="idrow"><b>{s.a} · {s.b}</b>: Pearson {f2(s.r)} → polychoric {f2(s.p)}</p>
          <p>All 21 points lie above the diagonal: treating six ordered boxes as continuous <b>attenuates</b> the correlations between the indicators — and with them the loadings.</p>
          <table className="rp-table">
            <thead><tr><th>std. loading</th><th>MLR</th><th>WLSMV</th></tr></thead>
            <tbody>{lamC.map(l => <tr key={l.rhs}><td><code>{l.rhs}</code></td><td>{f2(l.std)}</td><td>{f2(lamO.find(o => o.rhs === l.rhs)!.std)}</td></tr>)}
              <tr><td>factor r</td><td>{f2(factorCor(d.mlr.estimates))}</td><td>{f2(factorCor(d.ord.estimates))}</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- global fit
type EstName = 'ML' | 'MLR' | 'WLSMV';
const pickFit = (d: Day2, e: EstName) => {
  const f: Fit = e === 'ML' ? d.ml.fit : e === 'MLR' ? d.mlr.fit : d.ord.fit;
  const chi = e === 'ML' ? f.chisq : f['chisq.scaled'];
  return { chi, df: f.df, cfi: e === 'ML' ? f.cfi : f['cfi.robust'], rmsea: e === 'ML' ? f.rmsea : f['rmsea.robust'], srmr: f.srmr };
};
interface Ruler { key: string; label: string; min: number; max: number; zones: { to: number; cls: string; txt: string }[]; v: number; fmt: (v: number) => string }

export function FitRulers({ d }: { d: Day2 }) {
  const [e, setE] = useState<EstName>('MLR');
  const f = pickFit(d, e);
  const rulers: Ruler[] = [
    { key: 'chi', label: 'χ²/df', min: 0, max: 8, v: f.chi / f.df, fmt: v => v.toFixed(2), zones: [{ to: 1, cls: 'fair', txt: 'overfitted' }, { to: 2, cls: 'good', txt: 'good' }, { to: 3, cls: 'fair', txt: 'satisfactory' }, { to: 8, cls: 'poor', txt: 'underfitted' }] },
    { key: 'cfi', label: 'CFI', min: 0.8, max: 1, v: f.cfi, fmt: f3, zones: [{ to: CUTOFFS.cfi.fair, cls: 'poor', txt: 'poor' }, { to: CUTOFFS.cfi.good, cls: 'fair', txt: 'acceptable' }, { to: 1, cls: 'good', txt: 'good' }] },
    { key: 'rmsea', label: 'RMSEA', min: 0, max: 0.12, v: f.rmsea, fmt: f3, zones: [{ to: CUTOFFS.rmsea.good, cls: 'good', txt: 'good' }, { to: CUTOFFS.rmsea.fair, cls: 'fair', txt: 'moderate' }, { to: 0.12, cls: 'poor', txt: 'poor' }] },
    { key: 'srmr', label: 'SRMR', min: 0, max: 0.12, v: f.srmr, fmt: f3, zones: [{ to: CUTOFFS.srmr.good, cls: 'good', txt: 'good' }, { to: CUTOFFS.srmr.fair, cls: 'fair', txt: 'moderate' }, { to: 0.12, cls: 'poor', txt: 'poor' }] },
  ];
  return (
    <div className="fig">
      <div className="seg" role="group" aria-label="Estimator">
        {(['ML', 'MLR', 'WLSMV'] as const).map(x => <button key={x} aria-pressed={e === x} onClick={() => setE(x)}>{x}</button>)}
      </div>
      <div className="rulers">
        {rulers.map(r => {
          const pos = (v: number) => (100 * (Math.min(r.max, Math.max(r.min, v)) - r.min)) / (r.max - r.min);
          let from = r.min;
          const zone = r.zones.find(z => r.v <= z.to) ?? r.zones[r.zones.length - 1];
          return (
            <div key={r.key} className="ruler">
              <span className="r-lbl">{r.label}</span>
              <div className="r-track">
                {r.zones.map(z => { const el = <i key={z.to} className={z.cls} style={{ left: `${pos(from)}%`, width: `${pos(z.to) - pos(from)}%` }} title={z.txt} />; from = z.to; return el; })}
                <b className="r-mark" style={{ left: `${pos(r.v)}%` }} />
              </div>
              <span className={`r-val ${zone.cls}`}>{r.fmt(r.v)} <small>{zone.txt}</small></span>
            </div>
          );
        })}
      </div>
      <p className="hint">{e === 'ML' ? `χ²(${f.df}) = ${f.chi.toFixed(2)}, the standard test — as if the answers were multivariate normal.` : e === 'MLR' ? `χ²(${f.df}) = ${f.chi.toFixed(2)} scaled; robust CFI and RMSEA. AIC ${d.mlr.fit.aic.toFixed(0)}, BIC ${d.mlr.fit.bic.toFixed(0)} — only meaningful in comparison with another model of the same data.` : `χ²(${f.df}) = ${f.chi.toFixed(2)} scaled, robust CFI and RMSEA; the items treated as ordinal. Larger correlations are harder to reproduce: the WLSMV fit is not better, only more honest about the categories.`} Which index reacts to the estimator — and which does not?</p>
      <details className="deeper"><summary><span className="shape d" aria-hidden="true" /><span>Answer</span></summary><div className="deeper-body"><p>SRMR stays the same under ML and MLR ({f3(d.ml.fit.srmr)}): it compares S and Σ(θ) directly, and MLR does not change the estimates. χ²/df, CFI and RMSEA react, because MLR corrects the test statistic. Under WLSMV everything changes: the model now has to reproduce other (polychoric) correlations.</p></div></details>
    </div>
  );
}

// ---------------------------------------------------------------- the evaluation checklist
export function EvalChecklist({ d }: { d: Day2 }) {
  const [guess, setGuess] = useState<Record<number, 'good' | 'fair' | 'poor'>>({});
  const f = d.mlr.fit, e = d.mlr.estimates;
  const negVar = e.filter(x => x.op === '~~' && x.lhs === x.rhs && x.est < 0).length;
  const maxStd = Math.max(...loadings(e).map(l => Math.abs(l.std)));
  const minStd = Math.min(...loadings(e).map(l => l.std));
  const r = factorCor(e);
  const z: { a: string; b: string; z: number }[] = [];
  d.items.forEach((a, i) => d.items.forEach((b, j) => { if (j < i && Math.abs(d.resid_z[i][j]) > 1.96) z.push({ a, b, z: d.resid_z[i][j] }); }));
  const mi4 = d.mi.filter(m => m.mi > 4);
  const rows: { q: string; ok: 'good' | 'fair' | 'poor'; a: string }[] = [
    { q: 'Is the model identified?', ok: 'good', a: `p = 28, q = ${f.npar - 7}, df = ${f.df} > 0: overidentified, its fit can be tested. (lavaan reports ${f.npar} parameters: with FIML it also estimates the 7 intercepts from the 7 means, which adds as many parameters as observations.)` },
    { q: 'Is the solution admissible? (Positive definite: no negative variances or impossible correlations; a Heywood case is a negative error variance or a standardized loading above 1.)', ok: negVar || maxStd >= 1 ? 'poor' : 'good', a: `${negVar ? `${negVar} negative variance(s)!` : 'No negative variances'}, the largest standardized loading is ${f2(maxStd)} (< 1), and lavaan ended normally.` },
    { q: 'Multicollinearity — do two factors correlate above |.85|?', ok: Math.abs(r) > 0.85 ? 'poor' : 'good', a: `TRCO and UNIV correlate ${f2(r)}: clearly two factors, not one — discriminant validity, the factors measure different things.` },
    { q: 'Global fit?', ok: 'fair', a: `χ²(${f.df}) = ${f['chisq.scaled'].toFixed(1)} (χ²/df = ${(f['chisq.scaled'] / f.df).toFixed(1)}), CFI ${f3(f['cfi.robust'])}, RMSEA ${f3(f['rmsea.robust'])}, SRMR ${f3(f.srmr)}. CFI and SRMR good, RMSEA moderate, χ²/df too high — a usable model with a strain somewhere.` },
    { q: 'Substantive interpretation — signs, sizes, meaning?', ok: minStd >= 0.4 ? 'good' : 'fair', a: `All loadings positive and ≥ .40 (lowest ${f2(minStd)}). The factor correlation is positive — in uncentered value ratings most values correlate positively, partly through response style.` },
    { q: 'Modification indices > 4?', ok: mi4.length ? 'fair' : 'good', a: `All ${mi4.length} shown are above 4 (and more below them); the largest: ${d.mi[0].lhs} ${d.mi[0].op} ${d.mi[0].rhs}, MI = ${d.mi[0].mi.toFixed(1)}. Modify stepwise and only with a theoretical reason.` },
    { q: 'Standardized residuals > 1.96?', ok: z.length ? 'fair' : 'good', a: `${z.length} of the 21 covariances: ${z.sort((x, y) => Math.abs(y.z) - Math.abs(x.z)).slice(0, 3).map(x => `${x.a}–${x.b} (${x.z.toFixed(1).replace('-', '−')})`).join(', ')}${z.length > 3 ? ' and more' : ''}. Mostly pairs across the two factors.` },
  ];
  const SYM = { good: '✓', fair: '!', poor: '✗' } as const;
  return (
    <>
      <div className="card checklist">
        <p><b>Before the numbers</b> — for your own model, or one an AI assistant drafted:</p>
        <ol>
          <li>Every arrow in the diagram appears in the code, and nothing else does.</li>
          <li>The estimator matches the answers: MLR for skewed items with five or more categories, WLSMV for few categories (section 9).</li>
          <li>Every change has a reason in the logbook — written before or at the change, not after the fit improved.</li>
        </ol>
      </div>
      <p><b>Then the output</b>, point by point. For each, first make your guess — ✓ fine, ! a warning, ✗ a problem — then see the answer.</p>
      <ol className="evalcheck">
        {rows.map((row, k) => {
          const g = guess[k];
          return (
            <li key={k} className={g ? `seen ${row.ok}` : ''}>
              <div className="ec-row">
                <span className="ec-q">{row.q}</span>
                <span className="ec-guess" role="group" aria-label="Your guess">{(['good', 'fair', 'poor'] as const).map(x => (
                  <button key={x} className={`ec-v ${g === x ? (x === row.ok ? 'right' : 'wrong') : ''}`} disabled={!!g} onClick={() => setGuess(m => ({ ...m, [k]: x }))}>{SYM[x]}</button>
                ))}</span>
              </div>
              {g && <p>{g === row.ok ? '✓ Right. ' : `The answer is ${SYM[row.ok]}. `}{row.a}</p>}
            </li>
          );
        })}
      </ol>
    </>
  );
}

// ---------------------------------------------------------------- local fit
const REASONS = ['method effects', 'item wording', 'acquiescence', 'social desirability', 'unaccounted common causes'];
export function MiExplorer({ d, labels }: { d: Day2; labels: Record<string, string> }) {
  const list = d.mi.slice(0, 8);
  const [k, setK] = useState(0);
  const m = list[k];
  const extra: Extra = m.op === '=~' ? { kind: 'cross', a: m.lhs, b: m.rhs } : { kind: 'ecov', a: m.lhs, b: m.rhs };
  const twin = list.find((x, i) => i !== k && Math.abs(x.mi - m.mi) < 0.01);
  return (
    <div className="fig">
      <div className="fig-row">
        <TwoFactorDiagram items={d.items} extras={[extra]} focus={extra} />
        <div className="fig-text">
          <table className="rp-table mi-pick">
            <thead><tr><th>lhs op rhs</th><th>mi</th><th>epc</th><th>sepc.all</th></tr></thead>
            <tbody>{list.map((x, i) => <tr key={i} className={`${i === k ? 'on' : ''} ${list.some((y, j) => j !== i && Math.abs(y.mi - x.mi) < 0.01) ? 'twin' : ''}`} onClick={() => setK(i)} style={{ cursor: 'pointer' }}><td>{x.lhs} {x.op} {x.rhs}</td><td>{x.mi.toFixed(1)}</td><td>{x.epc.toFixed(2)}</td><td>{f2(x.sepc)}</td></tr>)}</tbody>
          </table>
          <p>{m.op === '~~'
            ? <>A <b>residual covariance</b> between “{labels[m.lhs]}” and “{labels[m.rhs]}”: freeing it would lower χ² by about {m.mi.toFixed(1)}; the residual correlation would be about {f2(m.sepc)}.</>
            : <>A <b>cross-loading</b>: {m.rhs} (“{labels[m.rhs]}”) would also load on {m.lhs} — standardized about {f2(m.sepc)}; χ² would drop by about {m.mi.toFixed(1)}.</>}</p>
          {twin && <p className="hint"><b>Same MI as “{twin.lhs} {twin.op} {twin.rhs}”:</b> two different changes, the same fit. The data cannot tell them apart — only theory can.</p>}
          <p className="hint">MIs estimate the drop in the standard (ML) χ². What do the two share beyond their factor? Possible reasons: {REASONS.join(', ')}. No reason, no modification.</p>
        </div>
      </div>
    </div>
  );
}

export function WaldTable({ d }: { d: Day2 }) {
  const rows = d.mlr.estimates.filter(e => e.z !== null && (e.op === '=~' || e.lhs !== e.rhs));
  const zmax = Math.max(...rows.map(r => Math.abs(r.z!)));
  return (
    <div className="lbars wald">
      {rows.map(r => (
        <div key={r.lhs + r.op + r.rhs} className="lbar"><span>{r.op === '=~' ? `${r.lhs}→${r.rhs}` : `${r.lhs}↔${r.rhs}`}</span><i style={{ width: `${(Math.abs(r.z!) / zmax) * 100}%` }} className={Math.abs(r.z!) >= 1.96 ? 'ok' : 'low'} /><b>{r.z!.toFixed(1)}</b></div>
      ))}
      <div className="lcut" style={{ left: `calc(130px + (100% - 180px) * ${1.96 / zmax})` }}><span>1.96</span></div>
    </div>
  );
}

// ---------------------------------------------------------------- nested models
export function NestedCompare({ d }: { d: Day2 }) {
  const [c, setC] = useState<'1v2' | 'mod'>('1v2');
  const lrt = c === '1v2' ? d.lrt_1v2 : d.lrt_mod;
  const row = lrt.find(x => x.dchisq !== null)!;
  const models = c === '1v2'
    ? [{ name: 'values_fit', what: 'one factor: all seven items', fit: d.one.fit }, { name: 'trco_univ_fit', what: 'two factors (the course model)', fit: d.mlr.fit }]
    : [{ name: 'trco_univ_fit', what: 'two factors (the course model)', fit: d.mlr.fit }, { name: 'trco_univ_fit_mod', what: `two factors + ${d.freed}`, fit: d.mod.fit }];
  const restricted = models.reduce((a, b) => (a.fit.df > b.fit.df ? a : b));
  return (
    <div className="fig">
      <div className="seg wrap" role="group" aria-label="Comparison">
        <button aria-pressed={c === '1v2'} onClick={() => setC('1v2')}>one factor vs. two</button>
        <button aria-pressed={c === 'mod'} onClick={() => setC('mod')}>two factors vs. one covariance freed</button>
      </div>
      <table className="rp-table">
        <thead><tr><th>model</th><th>df</th><th>χ² scaled</th><th>CFI</th><th>RMSEA</th><th>SRMR</th><th>AIC</th><th>BIC</th></tr></thead>
        <tbody>{models.map(m => <tr key={m.name} className={m === restricted ? '' : 'on'}><td><code>{m.name}</code><br /><small>{m.what}</small></td><td>{m.fit.df}</td><td>{m.fit['chisq.scaled'].toFixed(1)}</td><td>{f3(m.fit['cfi.robust'])}</td><td>{f3(m.fit['rmsea.robust'])}</td><td>{f3(m.fit.srmr)}</td><td>{m.fit.aic.toFixed(0)}</td><td>{m.fit.bic.toFixed(0)}</td></tr>)}</tbody>
      </table>
      <p className="idrow big"><Tex>{`\\Delta\\chi^2_{SB}(${row.ddf}) = ${row.dchisq!.toFixed(1)},\\; p ${row.p! < 0.001 ? '< .001' : '= ' + f3(row.p!)}`}</Tex></p>
      <p className="hint">{c === '1v2'
        ? 'The one-factor model is the two-factor model with the factor correlation fixed to 1: it is nested, with one degree of freedom more. The restriction costs far more than one df is worth — and AIC and BIC agree: tradition/conformity and universalism are two values.'
        : `The course model is the modified model with ${d.freed} fixed to 0. Freeing it improves the fit significantly, and AIC and BIC drop. Statistically clear — whether it is justified is a question of content (section 5).`}</p>
    </div>
  );
}

// ---------------------------------------------------------------- Jöreskog's three situations
const SITUATIONS = [
  { s: 'You test Schwartz’s two-factor structure on the Dutch data and accept or reject it as it is.', a: 0 },
  { s: 'You estimate one value factor and two, and let the data choose between them.', a: 1 },
  { s: 'The model strains; you free the largest modification index, refit, look at the next one …', a: 2 },
  { s: 'You compare the two-factor model of the Netherlands with a three-factor model that splits tradition from conformity.', a: 1 },
];
const TYPES = ['Strictly confirmatory (SC)', 'Alternative models (AM)', 'Model generating (MG)'];
export function TestingTypes() {
  const [ans, setAns] = useState<Record<number, number>>({});
  return (
    <div className="fig">
      <div className="tt-grid">
        {SITUATIONS.map((x, i) => (
          <div key={i} className="tt-card">
            <p>{x.s}</p>
            <div className="seg wrap" role="group" aria-label="Type of model testing">
              {TYPES.map((t, k) => <button key={t} aria-pressed={ans[i] === k} className={ans[i] === k ? (k === x.a ? 'right' : 'wrong') : ''} onClick={() => setAns(a => ({ ...a, [i]: k }))}>{t.match(/\((\w+)\)/)![1]}</button>)}
            </div>
            {ans[i] !== undefined && <small className={ans[i] === x.a ? 'okc' : 'poor'}>{ans[i] === x.a ? '✓ ' : '✗ '}{TYPES[x.a]}</small>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- homework: alternative identifications
export function IdentHomework({ d }: { d: Day2 }) {
  const [done, setDone] = useState(false);
  const v = d.ident, items = ['ipmodst', 'imptrad', 'ipfrule', 'ipbhprp'];
  const lam = (k: 'first' | 'fourth' | 'fixed', it: string) => est(v[k].estimates, 'TraditionConformity', '=~', it)!;
  const psi = (k: 'first' | 'fourth' | 'fixed') => est(v[k].estimates, 'TraditionConformity', '~~', 'TraditionConformity')!;
  return (
    <div>
      <Choose question="Are the estimates — or the standardized loadings — different between the three identifications?"
        options={['Both differ: a different model gives different results.', 'The unstandardized loadings and the factor variance differ; the standardized loadings and the fit are identical.', 'Nothing differs at all.']} answer={1}
        explain="Fixing a loading or the variance only chooses the unit of the latent variable. The model — and so χ², df and every standardized value — stays the same." onDone={() => setDone(true)} />
      {done && (
        <table className="rp-table">
          <thead><tr><th></th><th colSpan={2}>ipmodst = 1</th><th colSpan={2}>ipbhprp = 1</th><th colSpan={2}>variance = 1</th></tr>
            <tr><th>loading</th><th>est</th><th>std</th><th>est</th><th>std</th><th>est</th><th>std</th></tr></thead>
          <tbody>
            {items.map(it => <tr key={it}><td><code>{it}</code></td>{(['first', 'fourth', 'fixed'] as const).flatMap(k => [<td key={k + 'e'} className={lam(k, it).se === 0 ? 'fixedc' : ''}>{lam(k, it).est.toFixed(3)}</td>, <td key={k + 's'}>{f3(lam(k, it).std)}</td>])}</tr>)}
            <tr><td>factor variance</td>{(['first', 'fourth', 'fixed'] as const).flatMap(k => [<td key={k + 'e'} className={psi(k).se === 0 ? 'fixedc' : ''}>{psi(k).est.toFixed(3)}</td>, <td key={k + 's'}>1</td>])}</tr>
            <tr><td>χ² scaled</td>{(['first', 'fourth', 'fixed'] as const).map(k => <td key={k} colSpan={2}>{v[k].chisq.toFixed(3)}</td>)}</tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
