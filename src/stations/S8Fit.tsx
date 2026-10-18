// Station 08 · How close is close enough?
// From residuals to fit indices: χ² grows with n, RMSEA and CFI ask different
// questions, SRMR is the residual matrix in one number. Freeing a parameter always
// helps the numbers — only a reason makes it right.
import { useMemo, useState } from 'react';
import { Beat, Choose, Explain, Formula, MatrixView, Slider, StationHead, Tex, Yours, fmt } from '../components/ui.tsx';
import { DATASETS, ITEM_TEXT, SHORT, byId } from '../data/datasets.ts';
import { discrepancy, oneFactor } from '../math/cfa.ts';
import { estimate, fitIndices, type FitIndices } from '../math/fit.ts';
import { subtract } from '../math/linalg.ts';
import { chisqP } from '../math/stats.ts';
import { CUTOFF_TEXT, light } from '../math/cutoffs.ts';
import { constructName, markDone, type YourModel } from '../state.ts';

const verdict = (key: 'p' | 'rmsea' | 'cfi' | 'srmr', v: number) => {
  if (key === 'p') return v < 0.05 ? '✗ rejects exact fit' : '✓ exact fit not rejected';
  const l = light(key, v);
  return l === 'good' ? (key === 'rmsea' ? '✓ close fit' : '✓ good') : l === 'fair' ? '~ acceptable' : '✗ poor';
};

function Board({ fit, n }: { fit: FitIndices; n: number }) {
  const p = chisqP(fit.chisq, fit.df);
  return (
    <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
      <div className="metric"><span>χ²({fit.df}), n = {n.toLocaleString('en')}</span><b>{fit.chisq.toFixed(1)}</b><span>p = {p < 0.001 ? '< .001' : fmt(p, 3)} · {verdict('p', p)}</span></div>
      <div className="metric"><span>RMSEA</span><b>{fmt(fit.rmsea, 3)}</b><span>{verdict('rmsea', fit.rmsea)}</span></div>
      <div className="metric"><span>CFI</span><b>{fmt(fit.cfi, 3)}</b><span>{verdict('cfi', fit.cfi)}</span></div>
      <div className="metric"><span>SRMR</span><b>{fmt(fit.srmr, 3)}</b><span>{verdict('srmr', fit.srmr)}</span></div>
    </div>
  );
}

export function S8Fit({ model }: { model: YourModel }) {
  const [dsId, setDs] = useState('gb2014');
  const ds = byId(dsId);
  const spec = useMemo(() => oneFactor(ds.items), [ds]);
  const base = useMemo(() => estimate(spec, ds.S, ds.n), [spec, ds]);
  const [n, setN] = useState(ds.n);
  const [freed, setFreed] = useState<[number, number][]>([]);
  const labels = ds.items.map(i => SHORT[i]);

  // same discrepancy, different n: only χ² (and with it RMSEA/CFI slightly) changes
  const F = discrepancy(ds.S, base.Sigma);
  const atN = useMemo(() => fitIndices(ds.S, base.Sigma, n, base.fit.df), [ds, base, n]);
  const freedFit = useMemo(() => (freed.length ? estimate({ ...spec, residualCovs: freed }, ds.S, ds.n) : null), [spec, ds, freed]);
  const current = freedFit ?? base;
  const Res = subtract(ds.S, current.Sigma);
  const toggle = (i: number, j: number) => {
    markDone('s8');
    setFreed(f => (f.some(([a, b]) => a === i && b === j) ? f.filter(([a, b]) => !(a === i && b === j)) : f.length >= 2 ? f : [...f, [i, j]]));
  };
  const lastPair = freed[freed.length - 1];
  const yourFit = fitIndices(ds.S, base.Sigma, Math.max(model.n, 50), base.fit.df);
  const gb = byId('gb2014');
  const gbFit = useMemo(() => estimate(oneFactor(gb.items), gb.S, gb.n), [gb]);

  return (
    <article>
      <StationHead kicker="Station 08 · Model fit" title="How close is close enough?"
        lead="No model reproduces the data perfectly. Fit indices turn the leftover residuals into verdicts — and each one asks a different question." />

      <Beat kind="wonder" title="Guess the fit">
        <Choose onDone={() => markDone('s8')} answer={1}
          question="These are the residuals of the one-factor model in Great Britain (n = 1,780). How would you judge the model?"
          options={['Good — the residuals are tiny.', 'Mixed — χ² says “wrong”, the other indices say “close enough”.', 'Poor — several residuals are large.']}
          explain={<>χ²(2) = {gbFit.fit.chisq.toFixed(1)} rejects exact fit, but RMSEA = {fmt(gbFit.fit.rmsea, 3)}, CFI = {fmt(gbFit.fit.cfi, 3)} and SRMR = {fmt(gbFit.fit.srmr, 3)} call it acceptable to good. The largest residual is under .05. With 1,780 respondents, χ² notices even differences this small.</>}>
          <div style={{ maxWidth: 420, margin: '0 0 14px' }}><MatrixView M={subtract(gb.S, gbFit.Sigma)} labels={gb.items.map(i => SHORT[i])} mode="res" /></div>
        </Choose>
      </Beat>

      <Beat kind="play" title="Same misfit, different sample size">
        <div className="card play">
          <div className="row" style={{ marginBottom: 10 }}>
            <label className="hint" style={{ margin: 0 }}>Data&nbsp;
              <select value={dsId} onChange={e => { const d = byId(e.target.value); setDs(d.id); setN(d.n); setFreed([]); }}>
                {DATASETS.map(d => <option key={d.id} value={d.id}>{d.label} (n = {d.n.toLocaleString('en')})</option>)}
              </select>
            </label>
          </div>
          <p className="hint" style={{ marginTop: 0 }}>The model and its discrepancy stay fixed (F = {F.toFixed(4)}). Only the number of respondents changes.</p>
          <Slider label="Sample size n" min={100} max={20000} step={100} value={n} onChange={v => { setN(v); markDone('s8'); }} format={v => v.toLocaleString('en')} />
          <Board fit={atN} n={n} />
          <p className="hint">χ² = n × F: it grows in a straight line with n. RMSEA divides the misfit by n and by df, so it barely moves. CFI compares your model with the worst possible one — a model where nothing correlates.</p>
        </div>
      </Beat>

      <Beat kind="play" title="Free a parameter — and justify it">
        <div className="card play">
          <div className="play-grid">
            <div>
              <p className="mx-cap">Residuals S − Σ. Click a cell to let those two items share extra variance (a residual covariance). Up to two.</p>
              <MatrixView M={Res} labels={labels} mode="res" onCell={toggle} marked={freed} />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => setFreed([])} disabled={!freed.length}>Back to the one-factor model</button>
              </div>
            </div>
            <div>
              <Board fit={current.fit} n={ds.n} />
              {freedFit && <p className="hint"><b>Δχ² = {(base.fit.chisq - freedFit.fit.chisq).toFixed(1)}</b> for {freed.length} parameter{freed.length > 1 ? 's' : ''}, df {base.fit.df} → {freedFit.fit.df}. {freedFit.fit.df === 0 && 'With df = 0 the model now fits perfectly — and tests nothing.'}</p>}
              {lastPair && (
                <div className="reveal" style={{ marginTop: 10 }}>
                  <p style={{ margin: '0 0 6px' }}><b>Do these two items share something besides the factor?</b></p>
                  <p style={{ margin: '0 0 4px' }}>“{ITEM_TEXT[ds.items[lastPair[0]]]}”</p>
                  <p style={{ margin: 0 }}>“{ITEM_TEXT[ds.items[lastPair[1]]]}”</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Beat>

      <Beat kind="explain" title="Four questions, four numbers">
        <Explain>
          <p><b>χ²</b> asks: is the model <i>exactly</i> right? With thousands of respondents, almost nothing is. <b>RMSEA</b> asks: how much misfit is there per degree of freedom and per person — is the model <i>approximately</i> right? <b>CFI</b> asks: how much better is it than a model in which nothing is related? <b>SRMR</b> asks: how big is the average leftover correlation — the matrix you can see.</p>
          <p>Freeing a parameter always lowers χ²: you spend one of your spare facts from station 1.4 to explain one residual. That is legitimate only if you can say <i>why</i> two items share more than the factor — similar wording, the same response format, a substantive overlap. Otherwise you are fitting this sample, not the population.</p>
        </Explain>
      </Beat>

      <Beat kind="formula" title="From F to the indices">
        <Formula plug={<Tex block>{`\\chi^2 = ${n} \\times ${F.toFixed(4)} = ${atN.chisq.toFixed(1)}, \\qquad \\text{RMSEA} = \\sqrt{\\tfrac{\\max(${atN.chisq.toFixed(1)} - ${atN.df},\\,0)}{${atN.df} \\times ${n}}} = ${atN.rmsea.toFixed(3)}`}</Tex>}>
          <Tex block>{'\\chi^2 = n\\,F_{ML}, \\qquad \\text{RMSEA} = \\sqrt{\\frac{\\max(\\chi^2 - df,\\,0)}{df \\cdot n}}'}</Tex>
          <Tex block>{'\\text{CFI} = 1 - \\frac{\\max(\\chi^2_M - df_M,\\,0)}{\\max(\\chi^2_B - df_B,\\ \\chi^2_M - df_M,\\ 0)}, \\qquad \\text{SRMR} = \\sqrt{\\overline{r_{ij}^2}}'}</Tex>
          <p className="hint">B is the baseline model in which all items are uncorrelated; r<sub>ij</sub> are the residual correlations, averaged over the lower triangle. η Lab’s rules of thumb — {CUTOFF_TEXT} — are conventions from simulations, not laws.</p>
        </Formula>
      </Beat>

      <Beat kind="yours" title={`What your ${model.n.toLocaleString('en')} respondents will do to χ²`}>
        <Yours task={{ id: 'd2-strain', label: 'The day’s task: where does the two-factor model strain?' }}>
          <p>If {constructName(model)} had the same small misfit as the {ds.label} model, your sample would give χ²({base.fit.df}) = <b>{yourFit.chisq.toFixed(1)}</b> (p {chisqP(yourFit.chisq, yourFit.df) < 0.001 ? '< .001' : '= ' + fmt(chisqP(yourFit.chisq, yourFit.df), 3)}) and RMSEA = <b>{fmt(yourFit.rmsea, 3)}</b>.</p>
          <p className="verdict">Report χ², but judge with RMSEA, CFI, SRMR and the residual matrix together — and write down, before you look, which residual covariances you would accept on substantive grounds (Day 2’s project step asks exactly that).</p>
          <p>On the Dutch data of 2004, the one-factor model of tradition and conformity fits almost exactly. The strain appears once universalism joins it in one model — that is the day’s task in the studio.</p>
        </Yours>
      </Beat>
    </article>
  );
}
