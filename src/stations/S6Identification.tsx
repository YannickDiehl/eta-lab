// Station 06 · The knowledge budget
// Identification as a budget: the data pay out p(p+1)/2 facts, every free
// parameter costs one. Plus the "ridge": two items, infinitely many perfect answers.
import { useState } from 'react';
import { Beat, Explain, Formula, Metric, Predict, Slider, StationHead, Tex, Yours } from '../components/ui.tsx';
import { byId } from '../data/datasets.ts';
import { constructName, markDone, namedItems, type YourModel } from '../state.ts';

type Scale = 'marker' | 'fixed';

function budget(p: number, k: number, resCovs: number, cross: number) {
  const knowns = (p * (p + 1)) / 2;
  const parts = [
    { key: 'loadings', label: 'loadings', count: p + cross - k, color: 'var(--latent)' },
    { key: 'fvar', label: 'factor variances', count: k, color: 'var(--sky)' },
    { key: 'fcov', label: 'factor correlations', count: (k * (k - 1)) / 2, color: 'var(--sky)' },
    { key: 'resvar', label: 'residual variances', count: p, color: 'var(--err)' },
    { key: 'rescov', label: 'residual covariances', count: resCovs, color: 'var(--rose)' },
  ];
  const q = parts.reduce((s, x) => s + x.count, 0);
  return { knowns, parts, q, df: knowns - q };
}

export function S6Identification({ model }: { model: YourModel }) {
  const [p, setP] = useState(4);
  const [k, setK] = useState(1);
  const [rc, setRc] = useState(0);
  const [cross, setCross] = useState(0);
  const [scale, setScale] = useState<Scale>('marker');
  const b = budget(p, k, rc, cross);
  const minPerFactor = Math.floor(p / k);
  const status = b.df < 0 ? 'under' : b.df === 0 ? 'just' : 'over';
  const touch = () => markDone('s6');

  // the ridge: two items, one correlation, two loadings
  const r = byId('gb2014').S[2][1]; // rules ↔ behave
  const [l1, setL1] = useState(0.62);
  const l2 = Math.min(0.99, r / l1);

  const yourP = namedItems(model).length;
  const yb = budget(Math.max(yourP, 1), 1, 0, 0);

  const COIN = 22;
  const coins = Array.from({ length: Math.max(b.knowns, b.q) }, (_, i) => i);
  let used = 0;
  const chips = b.parts.flatMap(part => Array.from({ length: part.count }, () => ({ color: part.color, label: part.label, i: used++ })));

  return (
    <article>
      <StationHead kicker="Station 06 · Identification" title="The knowledge budget"
        lead="Your data contain a fixed amount of information. Every number the model wants to estimate has to be paid for with it." />

      <Beat kind="wonder" title="How much do four items know?">
        <Predict question="SEM never sees your respondents — only the variances and covariances of the items. How many distinct numbers is that for four items?"
          min={0} max={20} step={1} start={4} truth={10} format={v => String(Math.round(v))} onDone={touch}
          explain={() => <>Four variances plus six covariances (each pair once): 4 × 5 / 2 = 10. That is the entire budget, no matter whether you have 200 or 20,000 respondents.</>} />
      </Beat>

      <Beat kind="play" title="Spend the budget">
        <div className="card play">
          <div className="play-grid">
            <div>
              <Slider label="Items" min={2} max={8} step={1} value={p} onChange={v => { setP(v); setK(Math.min(k, Math.floor(v / 2) || 1)); touch(); }} format={v => String(v)} />
              <Slider label="Factors" min={1} max={2} step={1} value={k} onChange={v => { setK(Math.min(v, Math.max(1, Math.floor(p / 2)))); touch(); }} format={v => String(v)} />
              <Slider label="Cross-loadings" min={0} max={2} step={1} value={cross} onChange={v => { setCross(v); touch(); }} format={v => String(v)} />
              <Slider label="Residual covariances" min={0} max={3} step={1} value={rc} onChange={v => { setRc(v); touch(); }} format={v => String(v)} />
              <div className="row" style={{ margin: '8px 0' }}>
                <span className="hint" style={{ margin: 0 }}>Give each factor a scale by</span>
                <span className="seg" role="group" aria-label="Scaling">
                  <button aria-pressed={scale === 'marker'} onClick={() => { setScale('marker'); touch(); }}>fixing one loading to 1</button>
                  <button aria-pressed={scale === 'fixed'} onClick={() => { setScale('fixed'); touch(); }}>fixing its variance to 1</button>
                </span>
              </div>
              <p className="hint">Either way the factor costs the same: {scale === 'marker' ? 'one loading becomes the ruler, the variance is estimated' : 'the variance becomes the ruler, all loadings are estimated'}. Same budget, same fit.</p>
            </div>
            <div>
              <p className="mx-cap">Facts in the data ({b.knowns}) — and what the model spends ({b.q})</p>
              <svg viewBox={`0 0 ${10 * COIN + 10} ${Math.ceil(coins.length / 10) * COIN + 10}`} width="100%" role="img" aria-label={`${b.knowns} facts available, ${b.q} parameters to estimate`}>
                {coins.map(i => {
                  const x = 5 + (i % 10) * COIN + COIN / 2, y = 5 + Math.floor(i / 10) * COIN + COIN / 2;
                  const chip = chips[i], avail = i < b.knowns;
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r={COIN / 2 - 2} fill={chip ? chip.color : 'var(--card)'} stroke="var(--ink)" strokeWidth={avail ? 2 : 2} strokeDasharray={avail ? undefined : '3 3'} opacity={avail || chip ? 1 : 0.4} />
                      {!avail && chip && <text x={x} y={y + 4} textAnchor="middle" className="lbl">!</text>}
                    </g>
                  );
                })}
              </svg>
              <p className="hint" style={{ fontSize: 13 }}>Solid ring = a fact the data provide. Filled = spent on a parameter. Dashed with “!” = the model wants more than the data can pay.</p>
              <div className="metrics">
                <Metric label="Facts" value={String(b.knowns)} />
                <Metric label="Parameters" value={String(b.q)} />
                <Metric label="Left over (df)" value={String(b.df)} />
              </div>
              <p className="hint"><b>{status === 'under' ? '✗ Not identified — the machine has more dials than facts.' : status === 'just' ? '~ Just identified — it will fit perfectly, so nothing is tested.' : `✓ Over-identified — ${b.df} spare fact${b.df === 1 ? '' : 's'} to test the model.`}</b>
                {k === 2 && minPerFactor < 3 && status !== 'under' && ' With only two items per factor, this works only if the two factors are correlated.'}</p>
            </div>
          </div>
        </div>
      </Beat>

      <Beat kind="play" title="What “not identified” looks like">
        <div className="card play">
          <div className="play-grid">
            <div>
              <p className="hint" style={{ marginTop: 0 }}>Two items, one factor: the data offer one correlation (r = {r.toFixed(3)}), the model wants two loadings. Drag the first loading — the second follows so that the fit stays perfect.</p>
              <Slider label="λ rules" min={Math.max(0.4, r + 0.01)} max={0.99} step={0.01} value={l1} onChange={v => { setL1(v); touch(); }} />
              <div className="metrics">
                <Metric label="λ behave" value={l2.toFixed(3)} />
                <Metric label="λ rules × λ behave" value={(l1 * l2).toFixed(3)} />
                <Metric label="Misfit" value="0.000" />
              </div>
            </div>
            <svg viewBox="0 0 260 220" width="100%" role="img" aria-label="Curve of all loading pairs that reproduce the correlation perfectly">
              <rect x="30" y="10" width="220" height="180" fill="var(--bg)" stroke="var(--ink)" strokeWidth="2" rx="10" />
              <path d={Array.from({ length: 60 }, (_, i) => { const a = r + 0.01 + (i / 59) * (0.99 - r - 0.01); const bb = r / a; return `${i ? 'L' : 'M'}${30 + a * 220},${190 - Math.min(bb, 1) * 180}`; }).join(' ')}
                fill="none" stroke="var(--link)" strokeWidth="4" strokeLinecap="round" />
              <circle cx={30 + l1 * 220} cy={190 - l2 * 180} r="8" fill="var(--sun)" stroke="var(--ink)" strokeWidth="2.5" />
              <text className="lbl-s" x="140" y="212" textAnchor="middle">λ rules →</text>
              <text className="lbl-s" x="20" y="100" textAnchor="middle" transform="rotate(-90 20 100)">λ behave →</text>
              <text className="lbl" x="44" y="160">every point on the line</text>
              <text className="lbl" x="44" y="176">fits the data perfectly</text>
            </svg>
          </div>
        </div>
      </Beat>

      <Beat kind="explain" title="A ridge instead of a peak">
        <Explain>
          <p>Estimating means finding the single best setting of the dials. When the model has more dials than the data have facts, there is no single best setting — there is a whole <b>ridge</b> of equally perfect ones, like the line above. The software either stops with an error or returns one arbitrary point on the ridge.</p>
          <p>With exactly as many dials as facts (df = 0), there is one solution and it fits perfectly — so the fit tells you nothing. Only <b>spare facts</b> (df &gt; 0) let the data say “this model is wrong”. And whatever ruler you pick for a factor, it costs the same: the scale is a convention, not a finding.</p>
        </Explain>
      </Beat>

      <Beat kind="formula" title="Counting rule">
        <Formula plug={<Tex block>{`df = \\frac{${p}\\,(${p}+1)}{2} - ${b.q} = ${b.knowns} - ${b.q} = ${b.df}`}</Tex>}>
          <Tex block>{'df = \\underbrace{\\tfrac{p(p+1)}{2}}_{\\text{facts in } S} - \\underbrace{q}_{\\text{free parameters}}'}</Tex>
          <p className="hint">df ≥ 0 is necessary, not sufficient. Rules of thumb: one factor needs three indicators; two correlated factors can manage with two each. Each factor needs a scale — fix one loading or its variance.</p>
        </Formula>
      </Beat>

      <Beat kind="yours" title={`The budget of ${constructName(model)}`}>
        <Yours>
          {yourP === 0 ? <p className="verdict">Draw a factor with its items in the studio to see your budget.</p> : <>
            <p>{yourP} item{yourP === 1 ? '' : 's'} give{yourP === 1 ? 's' : ''} you <b>{yb.knowns}</b> facts. A one-factor model spends <b>{yb.q}</b> ({yourP - 1} loadings + 1 factor variance + {yourP} residual variances).</p>
            <p className="verdict">{yb.df < 0 ? `Not identified on its own — add items or embed ${constructName(model)} in a model with other factors.` : yb.df === 0 ? 'Just identified: estimable, but untestable.' : `${yb.df} spare fact${yb.df === 1 ? '' : 's'} — enough to test whether ${constructName(model)} is really one thing.`}</p>
            <p>Each extra parameter you might add later — a residual covariance between two similarly worded items, a cross-loading — costs one more fact. Keep a few in reserve.</p>
          </>}
        </Yours>
      </Beat>
    </article>
  );
}
