// Day 1 · the figures, made interactive (part 1): classic test theory, the formal
// measurement model, reflective vs. formative, and the two ways to scale a latent variable.
// Each one follows the layout of the static figure it replaces (figs/*.png in the earlier
// course scripts): the latent variable on the left, its indicators on the right, errors outside.
import { useMemo, useState } from 'react';
import { Tex } from '../../components/ui.tsx';
import { correlation, normals, rng } from '../../math/stats.ts';
import { factorVar, f2, f3, loading, residualVar, type ItemSet } from './data.ts';

const Marker = () => (
  <defs>
    <marker id="d1-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink)" /></marker>
  </defs>
);

// ---------------------------------------------------------------- classic test theory
export function ClassicTestTheory() {
  const [rel, setRel] = useState(0.6);
  const sample = useMemo(() => { const u = rng(11); return { t: normals(u, 160), e1: normals(u, 160), e2: normals(u, 160) }; }, []);
  const k = Math.sqrt((1 - rel) / rel);
  // standardized observed scores, so the cloud keeps its size and only its shape changes
  const sd = Math.sqrt(1 + k * k);
  const x1 = sample.t.map((t, i) => (t + k * sample.e1[i]) / sd), x2 = sample.t.map((t, i) => (t + k * sample.e2[i]) / sd);
  const r12 = correlation(x1, x2), rxt = correlation(x1, sample.t);
  const S = 220, sc = (v: number) => S / 2 + (Math.max(-3.4, Math.min(3.4, v)) / 3.4) * (S / 2 - 10);
  return (
    <div className="fig">
      <div className="fig-row">
        <svg viewBox="0 0 330 150" className="fig-svg" role="img" aria-label="The true score tau and the error epsilon both point to the observed score x">
          <Marker />
          <ellipse cx="62" cy="52" rx="48" ry="26" className="f-lat" />
          <text x="62" y="58" className="f-sym">τ</text>
          <rect x="150" y="30" width="70" height="44" rx="4" className="f-obs" />
          <text x="185" y="58" className="f-sym it">x</text>
          <line x1="110" y1="52" x2="147" y2="52" className="f-arr" markerEnd="url(#d1-arr)" />
          <line x1="280" y1="52" x2="223" y2="52" className="f-arr" markerEnd="url(#d1-arr)" />
          <text x="296" y="58" className="f-sym">ε</text>
          <rect x="150" y="30" width={70 * (1 - rel)} height="5" className="f-err-bar" />
          <text x="12" y="110" className="f-lbl">τ  true score · x  observed score · ε  error</text>
          <text x="12" y="132" className="f-lbl">share of error in x: {Math.round((1 - rel) * 100)}%</text>
        </svg>
        <div className="fig-formulas">
          <div className="fig-box"><Tex>{'x = \\tau + \\varepsilon'}</Tex><Tex>{'E(\\varepsilon) = 0'}</Tex><Tex>{'cor_{\\tau\\varepsilon} = 0'}</Tex><Tex>{'\\tau = E(x)'}</Tex></div>
          <div className="fig-box"><Tex>{`rel(x) = r^2_{x\\tau} = ${f2(rxt * rxt)}`}</Tex><Tex>{`r^2_{x\\tau} \\approx r_{x_1x_2} = ${f2(r12)}`}</Tex></div>
          <ul className="fig-gloss"><li><Tex>{'E(\\varepsilon) = 0'}</Tex>: errors cancel out on average</li><li><Tex>{'cor_{\\tau\\varepsilon} = 0'}</Tex>: the error is unrelated to the true score</li><li><Tex>{'\\tau = E(x)'}</Tex>: the true score is the mean of many repeated measurements</li><li>reliability: the share of the observed variance that is true-score variance</li></ul>
        </div>
      </div>
      <div className="fig-row">
        <svg viewBox={`0 0 ${S} ${S}`} className="fig-scatter" role="img" aria-label={`Two measurements of the same true score correlate at ${f2(r12)}`}>
          <rect x="0" y="0" width={S} height={S} rx="10" className="f-plot" />
          {x1.map((v, i) => <circle key={i} cx={sc(v)} cy={S - sc(x2[i])} r="2.6" className="f-dot" />)}
          <text x="8" y={S - 8} className="f-lbl">x₁ →</text>
          <text x="8" y="16" className="f-lbl">x₂ ↑</text>
        </svg>
        <div className="fig-ctl">
          <label className="ctl"><span>Reliability</span><input type="range" min={0.1} max={1} step={0.05} value={rel} onChange={e => setRel(+e.target.value)} /><output>{f2(rel)}</output></label>
          <p>Two items measure the same true score τ, each with its own error. The only thing they share is τ — so <b>the latent construct is “responsible” for the correlation between x₁ and x₂</b>, and that correlation estimates the reliability.</p>
          <p className="hint"><b>Try it:</b> set the reliability to .30, then to .90. With more error the cloud widens and r<sub>x₁x₂</sub> drops — although τ has not changed.</p>
          <p className="hint">A CFA generalizes this idea: each item reflects the construct with its own strength (its loading λ) and has its own error.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the formal model
const ROWS = [34, 84, 134, 184];
export function FormalModel({ s, initial = 'sym' }: { s: ItemSet; initial?: 'sym' | 'est' | 'std' }) {
  const [sel, setSel] = useState<number | null>(initial === 'sym' ? 1 : null);
  const [show, setShow] = useState<'sym' | 'est' | 'std'>(initial);
  const lam = loading(s), psi = factorVar(s);
  const label = (i: number) => show === 'sym' ? `λ${'₁₂₃₄'[i]}` : show === 'est' ? (i === 0 ? '1.0' : f2(lam[i].est)) : f2(lam[i].std);
  return (
    <div className="fig">
      <div className="fig-row">
        <svg viewBox="0 0 420 220" className="fig-svg" role="img" aria-label="Formal measurement model: eta measured by four indicators y1 to y4, each with an error">
          <Marker />
          <path d="M42 96 C10 70 30 50 58 82" fill="none" className="f-arr" markerEnd="url(#d1-arr)" />
          <text x="20" y="60" className="f-sym sm">ψ</text>
          <ellipse cx="80" cy="110" rx="46" ry="26" className="f-lat" />
          <text x="80" y="117" className="f-sym">η</text>
          {s.items.map((it, i) => {
            const on = sel === i;
            return (
              <g key={it} className={`f-item ${on ? 'on' : ''}`} onClick={() => setSel(on ? null : i)} role="button" tabIndex={0} aria-label={`${it}: equation ${i + 1}`}>
                <line x1="126" y1="110" x2="266" y2={ROWS[i] + 18} className="f-arr" markerEnd="url(#d1-arr)" />
                <text x={196} y={(110 + ROWS[i] + 18) / 2 - 6} className="f-lbl c">{label(i)}</text>
                <rect x="268" y={ROWS[i]} width="84" height="36" rx="4" className="f-obs" />
                <text x="310" y={ROWS[i] + 23} className="f-lbl c b">{it}</text>
                <line x1="398" y1={ROWS[i] + 18} x2="355" y2={ROWS[i] + 18} className="f-arr" markerEnd="url(#d1-arr)" />
                <text x="404" y={ROWS[i] + 23} className="f-sym sm">ε{'₁₂₃₄'[i]}</text>
              </g>
            );
          })}
          {show !== 'sym' && psi && <text x="20" y="40" className="f-lbl">{show === 'std' ? '1' : f2(psi.est)}</text>}
        </svg>
        <div className="fig-formulas">
          <div className="seg" role="group" aria-label="Show">
            <button aria-pressed={show === 'sym'} onClick={() => setShow('sym')}>symbols</button>
            <button aria-pressed={show === 'est'} onClick={() => setShow('est')}>estimates</button>
            <button aria-pressed={show === 'std'} onClick={() => setShow('std')}>standardized</button>
          </div>
          <div className="fig-box eqs">
            {s.items.map((it, i) => (
              <button key={it} className={`eq ${sel === i ? 'on' : ''}`} onClick={() => setSel(sel === i ? null : i)}>
                <Tex>{`y_${i + 1} = ${show === 'sym' ? `\\lambda_${i + 1}` : label(i)}\\,\\eta + \\varepsilon_${i + 1}`}</Tex>
                <small>{it}</small>
              </button>
            ))}
          </div>
          <div className="fig-box"><Tex>{'\\boldsymbol{Y} = \\boldsymbol{\\Lambda}\\eta + \\boldsymbol{E}'}</Tex></div>
        </div>
      </div>
      <p className="hint">Click an indicator or an equation: each item is the latent variable times its loading, plus an error of its own. {sel !== null && show !== 'sym' && <>For <b>{s.items[sel]}</b>: a one-unit higher η means {show === 'std' ? `${f2(lam[sel].std)} standard deviations` : `${f2(lam[sel].est)} scale points`} more on the item; the error variance is {show === 'std' ? `${f2(residualVar(s, s.items[sel])?.std ?? NaN)} (the share of the item’s variance that is error)` : f2(residualVar(s, s.items[sel])?.est ?? NaN)}.</>}</p>
      <p className="hint">ψ (psi) is the variance of η: how much people differ on the construct. In lavaan we will call η <code>{s.factor}</code>. {show === 'est' && <>The first loading shows 1.0 — why, step 3 explains.</>}</p>
    </div>
  );
}

// ---------------------------------------------------------------- reflective vs. formative
export function ReflectiveFormative({ s }: { s: ItemSet }) {
  const [mode, setMode] = useState<'refl' | 'form'>('refl');
  const meanR = s.correlation.reduce((a, c) => a + c.r, 0) / s.correlation.length;
  const refl = mode === 'refl';
  return (
    <div className="fig">
      <div className="seg" role="group" aria-label="Measurement model">
        <button aria-pressed={refl} onClick={() => setMode('refl')}>Reflective</button>
        <button aria-pressed={!refl} onClick={() => setMode('form')}>Formative</button>
      </div>
      <div className="fig-row">
        <svg viewBox="0 0 420 220" className="fig-svg" role="img" aria-label={refl ? 'Reflective: arrows from the construct to the indicators' : 'Formative: arrows from the indicators to the construct'}>
          <Marker />
          <ellipse cx="80" cy="110" rx="46" ry="26" className="f-lat" />
          <text x="80" y="117" className="f-sym">η</text>
          {s.items.map((it, i) => (
            <g key={it}>
              {refl
                ? <line x1="126" y1="110" x2="266" y2={ROWS[i] + 18} className="f-arr" markerEnd="url(#d1-arr)" />
                : <line x1="266" y1={ROWS[i] + 18} x2="128" y2="110" className="f-arr" markerEnd="url(#d1-arr)" />}
              <rect x="268" y={ROWS[i]} width="84" height="36" rx="4" className="f-obs" />
              <text x="310" y={ROWS[i] + 23} className="f-lbl c b">{it}</text>
              {refl && <><line x1="398" y1={ROWS[i] + 18} x2="355" y2={ROWS[i] + 18} className="f-arr" markerEnd="url(#d1-arr)" /><text x="404" y={ROWS[i] + 23} className="f-sym sm">ε</text></>}
            </g>
          ))}
          {!refl && <>
            <path d="M356 52 C392 80 392 160 356 196" fill="none" className="f-arr dash" markerStart="url(#d1-arr)" markerEnd="url(#d1-arr)" />
            <line x1="80" y1="190" x2="80" y2="139" className="f-arr" markerEnd="url(#d1-arr)" />
            <text x="80" y="208" className="f-sym sm c">ζ</text>
          </>}
        </svg>
        <div className="fig-text">
          {refl ? <>
            <p><b>Reflective:</b> the indicators are “effects” of the latent variable. A change in η shows up in every item.</p>
            <ul><li>items must correlate — they share a cause</li><li>each item has its own measurement error ε</li><li>items are exchangeable: dropping one does not change the construct</li></ul>
          </> : <>
            <p><b>Formative:</b> the latent variable is “caused” by, or composed of, its indicators — like socio-economic status from income, education and occupation.</p>
            <ul><li>items need not correlate (the dashed arrow: they may correlate freely)</li><li>the error ζ (zeta) sits on the construct: the part its indicators do not cover</li><li>dropping an item changes what the construct is</li></ul>
          </>}
          <p className="fig-check">Tradition and conformity: the four items correlate on average at <b>r = {f2(meanR)}</b> — what a reflective model expects. Correlation is necessary for a reflective model, not proof of it: the argument comes from theory.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- scaling (step 3)
export function Scaling({ s }: { s: ItemSet }) {
  const [mode, setMode] = useState<'ref' | 'fix'>('ref');
  const [marker, setMarker] = useState(0);
  const [std, setStd] = useState(false);
  const lam = loading(s), psi = factorVar(s)!.est;
  const lfix = lam.map(l => l.est * Math.sqrt(psi));                 // loadings when the factor variance is 1
  const shown = mode === 'ref' ? lfix.map(v => v / lfix[marker]) : lfix;
  const psiShown = mode === 'ref' ? lfix[marker] ** 2 : 1;
  const fit = s.fit;
  const order = mode === 'ref' ? [marker, ...s.items.map((_, i) => i).filter(i => i !== marker)].map(i => s.items[i]) : s.items;
  const code = mode === 'ref'
    ? `${s.factor === 'TRCO' ? 'tradition_conformity' : 'model'} <- "${s.factor} =~ ${order.join(' + ')}"`
    : `${s.factor === 'TRCO' ? 'tradition_conformity' : 'model'} <- "
# specification of the measurement model
${s.factor} =~ NA*${s.items[0]} + ${s.items.slice(1).join(' + ')}
# specification of the variance
${s.factor} ~~ 1*${s.factor}
"`;
  return (
    <div className="fig">
      <div className="row" style={{ gap: 12 }}>
        <div className="seg" role="group" aria-label="Scaling method">
          <button aria-pressed={mode === 'ref'} onClick={() => setMode('ref')}>Reference indicator</button>
          <button aria-pressed={mode === 'fix'} onClick={() => setMode('fix')}>Fixed factor</button>
        </div>
        {mode === 'ref' && <label className="hint" style={{ margin: 0 }}>reference item&nbsp;
          <select value={marker} onChange={e => setMarker(+e.target.value)}>{s.items.map((it, i) => <option key={it} value={i}>{it}</option>)}</select></label>}
        <label className="chk"><input type="checkbox" checked={std} onChange={e => setStd(e.target.checked)} /> standardized</label>
      </div>
      <div className="fig-row">
        <svg viewBox="0 0 420 220" className="fig-svg" role="img" aria-label="Path diagram with the loadings and the factor variance of the chosen scaling">
          <Marker />
          <path d="M42 96 C10 70 30 50 58 82" fill="none" className="f-arr" markerEnd="url(#d1-arr)" />
          <text x="12" y="44" className={`f-lbl ${mode === 'fix' && !std ? 'fixed' : ''}`}>ψ = {std ? '1' : mode === 'fix' ? '1 (fixed)' : f3(psiShown)}</text>
          <ellipse cx="80" cy="110" rx="46" ry="26" className="f-lat" />
          <text x="80" y="117" className="f-sym sm">{s.factor}</text>
          {s.items.map((it, i) => {
            const fixed = mode === 'ref' && i === marker && !std;
            return (
              <g key={it}>
                <line x1="126" y1="110" x2="266" y2={ROWS[i] + 18} className={`f-arr ${fixed ? 'thick' : ''}`} markerEnd="url(#d1-arr)" />
                <text x="196" y={(110 + ROWS[i] + 18) / 2 - 6} className={`f-lbl c ${fixed ? 'fixed' : ''}`}>{std ? f3(lam[i].std) : fixed ? '1 (fixed)' : f3(shown[i])}</text>
                <rect x="268" y={ROWS[i]} width="84" height="36" rx="4" className="f-obs" />
                <text x="310" y={ROWS[i] + 23} className="f-lbl c b">{it}</text>
              </g>
            );
          })}
        </svg>
        <div className="fig-text">
          <div className="metrics" style={{ marginTop: 0 }}>
            <div className="metric"><span>Fit — the same in both</span><b>χ²({fit.df}) = {fit['chisq.scaled'].toFixed(2)}</b><span>CFI {f3(fit['cfi.robust'])} · RMSEA {f3(fit['rmsea.robust'])}</span></div>
          </div>
          <p>{mode === 'ref'
            ? <><b>{s.items[marker]}</b> gives the latent variable its unit: its loading is fixed to 1, so the factor variance is estimated — ψ = {f3(psiShown)}, which is {f3(lfix[marker])}².</>
            : <>The factor variance is fixed to 1, so <b>all four loadings</b> are estimated freely. Each is the reference-indicator loading × √ψ.</>}</p>
          <p className="hint"><b>Try it:</b> switch to “Fixed factor”, then choose another reference item. Which numbers change — and which stay the same? The unstandardized numbers change; the fit and the standardized loadings do not. The two methods are statistically equivalent — same fit, different parameterization. The fixed-factor loadings reappear in the output of step 5, in the column <code>Std.lv</code>.</p>
        </div>
      </div>
      <pre className="syntax"><code>{code}</code></pre>
    </div>
  );
}
