// Station 2.4 · Data as they are (a mini-station)
// Survey answers are a few ordered boxes, often piled up at one end. ML assumes smooth normal
// variables. What the boxes do to a correlation — and what MLR and WLSMV change about it.
import { chooseEstimator, ESTIMATOR_RULE, PILE_UP } from '../math/estimatorRule.ts';
import { useMemo, useState } from 'react';
import { Beat, Deeper, Explain, Formula, Metric, Predict, Slider, StationHead, Tex, Yours, fmt } from '../components/ui.tsx';
import { markDone, type YourModel } from '../state.ts';
import { pearsonOfCategories, shares } from './categories.ts';

const touch = () => markDone('s9');

function Bars({ c, skew }: { c: number; skew: number }) {
  const p = shares(c, skew), W = 300, H = 120, bw = (W - 20) / c, top = Math.max(...p);
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" role="img" aria-label={`Share of answers per category: ${p.map(x => `${Math.round(x * 100)}%`).join(', ')}`}>
      {p.map((x, k) => (
        <g key={k}>
          <rect x={10 + k * bw + 3} y={H - (x / top) * (H - 10)} width={bw - 6} height={(x / top) * (H - 10)} rx="4" fill="var(--obs)" stroke="var(--ink)" strokeWidth="2" style={{ transition: 'all .3s' }} />
          <text className="lbl-s" x={10 + k * bw + bw / 2} y={H + 16} textAnchor="middle">{k + 1}</text>
        </g>
      ))}
    </svg>
  );
}

export function S9Data({ model }: { model: YourModel }) {
  const [c, setC] = useState(4);
  const [skew, setSkew] = useState(1.2);
  const [rho, setRho] = useState(0.6);
  const r = useMemo(() => pearsonOfCategories(rho, c, skew), [rho, c, skew]);
  const rule = chooseEstimator(c <= 3 ? '2–3' : c === 4 ? '4' : c <= 6 ? '5–6' : '7+', (() => { const sh = shares(c, skew); return Math.max(sh[0], sh[c - 1]) > PILE_UP; })());   // the rule used here
  const advice = `${rule.estimator}${rule.check ? `, with ${rule.check} as a check` : ''}: ${rule.why}`;
  const chosen = model.r?.estimator ?? 'ML';

  return (
    <article>
      <StationHead kicker="Station 09 · Estimators" title="Data as they are"
        lead="Maximum likelihood assumes smooth, normally distributed answers. Survey answers are a handful of boxes, often piled up at one end. What does that do — and what do MLR and WLSMV change?" />

      <Beat kind="wonder" title="Guess the shrinkage">
        <Predict question="Two attitudes correlate at .60 in people’s minds. The survey records each on a 4-point scale, and most people tick the top box. What correlation will the recorded answers show?"
          min={0} max={0.6} step={0.01} start={0.58} truth={pearsonOfCategories(0.6, 4, 1.2)} format={v => v.toFixed(2)} onDone={touch}
          explain={() => <>The boxes throw away the differences within each box. With most people in the top box, the answers hardly vary — and what does not vary cannot correlate. ML analyses these shrunken correlations; WLSMV estimates the .60 behind them.</>} />
      </Beat>

      <Beat kind="play" title="Put the answers in boxes">
        <div className="card play">
          <div className="play-grid">
            <div>
              <p className="mx-cap">How people answer one item</p>
              <Bars c={c} skew={skew} />
              <div className="metrics">
                <Metric label="In people’s minds (WLSMV)" value={fmt(rho)} />
                <Metric label="In the boxes (ML, MLR)" value={fmt(r)} />
                <Metric label="Lost" value={`${Math.round(100 * (1 - r / rho))}%`} />
              </div>
            </div>
            <div>
              <Slider label="Categories" min={2} max={7} step={1} value={c} onChange={v => { setC(v); touch(); }} format={v => String(v)} />
              <Slider label="Pile-up at the top" min={0} max={1.5} step={0.1} value={skew} onChange={v => { setSkew(v); touch(); }} format={v => v.toFixed(1)} />
              <Slider label="True correlation" min={0.2} max={0.9} step={0.05} value={rho} onChange={v => { setRho(v); touch(); }} />
              <p className="verdict" style={{ marginTop: 12 }}><b>η suggests:</b> {advice}</p>
              <p className="hint">The ESS value items have six boxes and pile up moderately at the top (“like me”). Set 6 categories and a pile-up of 0.5 — a skewness of about −0.6, typical of the Dutch value items: some 8% is lost. Tolerable, which is why η Lab treats them as continuous and estimates with MLR.</p>
            </div>
          </div>
        </div>
      </Beat>

      <Beat kind="explain" title="Three estimators, three promises">
        <Explain>
          <p><b>ML</b> treats the answers as continuous and normal. With non-normal answers its estimates are still fine, but its χ² is too large and its standard errors too small — it is overconfident. <b>MLR</b> keeps ML’s estimates and corrects exactly that: a scaled χ² and robust standard errors. It cannot undo shrunken correlations, though. <b>WLSMV</b> goes behind the boxes: it estimates thresholds and the correlations of the latent responses (polychoric correlations), and fits the model to those.</p>
          <p>η Lab’s rule of thumb (Rhemtulla, Brosseau-Liard & Savalei, 2012): {ESTIMATOR_RULE} In R, on the Dutch data of the Day 2 task (n = 1,830), MLR lowers χ² from 103.0 to 81.5 and raises the standard error of one loading from .111 to .140 — same estimates, honest uncertainty.</p>
        </Explain>
      </Beat>

      <Beat kind="formula" title="What MLR corrects">
        <Formula plug={<Tex block>{'c = \\frac{103.0}{81.5} = 1.26 \\quad\\Rightarrow\\quad \\text{the ML } \\chi^2 \\text{ was 26\\% too large for these answers}'}</Tex>}>
          <Tex block>{'\\chi^2_{\\text{scaled}} = \\frac{\\chi^2_{ML}}{c}, \\qquad \\operatorname{Cov}(\\hat\\theta)_{\\text{robust}} = A^{-1} B A^{-1}'}</Tex>
          <p className="hint">c grows with the kurtosis of the answers; A is the information ML uses, B the variability the data actually show. When the data are normal, B = A and MLR equals ML.</p>
        </Formula>
      </Beat>

      <Deeper title="Under the hood: estimators in lavaan">
        <p><code>cfa(model, data, estimator = "MLR")</code> — robust ML (Yuan–Bentler scaled χ², Huber–White standard errors). Report the robust CFI and RMSEA: <code>fitMeasures(fit, c("cfi.robust", "rmsea.robust"))</code>.</p>
        <p><code>cfa(model, data, ordered = c("item1", "item2", …))</code> — switches to WLSMV automatically. Thresholds appear as <code>item1|t1</code>, <code>item1|t2</code>, …; for multiple groups, see the ordinal ladder the studio writes with <code>semTools::measEq.syntax</code>.</p>
        <p><code>missing = "fiml"</code> — full-information ML: every respondent contributes the answers they gave. Valid when answers are missing at random given the model’s variables; with WLSMV, lavaan uses pairwise deletion instead.</p>
        <p className="hint"><b>Reading.</b> Brown (2015), chapter 9 (non-normal and categorical data); Rhemtulla, Brosseau-Liard & Savalei (2012), <i>Psychological Methods, 17</i>(3), 354–373.</p>
      </Deeper>

      <Beat kind="yours" title="Your items, your estimator">
        <Yours>
          <p>Your project’s R code currently uses <b>{chosen}</b>{model.r?.missing === 'fiml' ? ' with FIML' : ''}. The project step of Day 2 asks how your items are answered and suggests the estimator.</p>
          <p><a href="#/day/2#project">Go to the project step of Day 2 →</a></p>
        </Yours>
      </Beat>
    </article>
  );
}
