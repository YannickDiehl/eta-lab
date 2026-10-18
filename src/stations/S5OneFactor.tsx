// Station 05 · The measurement machine
// A one-factor model is a machine that manufactures correlations: r_ij = λ_i · λ_j.
// Learners drive the machine by hand, then watch maximum likelihood drive it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Beat, Choose, Explain, Formula, Metric, MatrixView, Slider, StationHead, Tex, Yours } from '../components/ui.tsx';
import { DATASETS, ITEM_TEXT, SHORT, byId } from '../data/datasets.ts';
import { discrepancy, implied, oneFactor, parameters } from '../math/cfa.ts';
import { estimate } from '../math/fit.ts';
import { subtract, type Matrix } from '../math/linalg.ts';
import { constructName, markDone, namedItems, type YourModel } from '../state.ts';

/** Implied correlation matrix of a standardized one-factor model (θ_i = 1 − λ_i²). */
const machine = (lam: number[]): Matrix => lam.map((a, i) => lam.map((b, j) => (i === j ? 1 : a * b)));
const sub = (S: Matrix, idx: number[]) => idx.map(i => idx.map(j => S[i][j]));

export function S5OneFactor({ model }: { model: YourModel }) {
  const [dsId, setDs] = useState('gb2014');
  const [four, setFour] = useState(true);
  const ds = byId(dsId);
  const idx = four ? [0, 1, 2, 3] : [0, 1, 2];
  const items = idx.map(i => ds.items[i]);
  const S = useMemo(() => sub(ds.S, four ? [0, 1, 2, 3] : [0, 1, 2]), [ds, four]);
  const [lam, setLam] = useState<number[]>([0.5, 0.5, 0.5, 0.5]);
  const [Sig, setSig] = useState<Matrix | null>(null); // set while ML is running/finished, else machine(lam)
  const [msg, setMsg] = useState('');
  const timer = useRef<number | null>(null);
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  useEffect(() => stop, []);

  const L = lam.slice(0, idx.length);
  const Sigma = Sig ?? machine(L);
  const Res = subtract(S, Sigma);
  const F = discrepancy(S, Sigma);
  const maxRes = Math.max(...Res.flatMap((r, i) => r.filter((_, j) => j < i).map(Math.abs)));

  const drag = (i: number, v: number) => { stop(); setSig(null); setMsg(''); setLam(l => l.map((x, k) => (k === i ? v : x))); markDone('s5'); };

  const solveExactly = () => {
    // three items: λ1 = √(r12·r13/r23) etc. — the machine can hit the data exactly
    stop(); setSig(null);
    const [r12, r13, r23] = [S[1][0], S[2][0], S[2][1]];
    setLam([Math.sqrt((r12 * r13) / r23), Math.sqrt((r12 * r23) / r13), Math.sqrt((r13 * r23) / r12), lam[3]]);
    setMsg('Solved exactly: with three items, three loadings can reproduce three correlations perfectly. Nothing is left to test.');
    markDone('s5');
  };

  const runML = () => {
    stop();
    const spec = oneFactor(items), params = parameters(spec);
    const est = estimate(spec, S, ds.n);
    const path = est.path;
    let k = 0;
    const tick = () => {
      const x = path[Math.min(k, path.length - 1)];
      setLam(l => l.map((v, i) => (i < idx.length ? Math.abs(x[i]) : v)));
      setSig(implied(spec, params, x.map((v, i) => (params[i].kind === 'loading' ? Math.abs(v) : v))));
      setMsg(k < path.length - 1 ? `Maximum likelihood is searching … step ${k + 1} of ${path.length}` :
        `Done in ${est.iterations} steps — the same loadings lavaan reports. ${idx.length === 4 ? 'Some residuals remain: no setting of four loadings reproduces all six correlations.' : ''}`);
      if (k >= path.length - 1) stop();
      k++;
    };
    timer.current = window.setInterval(tick, 160);
    tick();
    markDone('s5');
  };

  // the three tetrads: under one factor, r12·r34 = r13·r24 = r14·r23
  const tetrads = four ? [S[1][0] * S[3][2], S[2][0] * S[3][1], S[3][0] * S[2][1]] : [];
  const xs = idx.map((_, i) => 40 + i * (four ? 90 : 120) + (four ? 0 : 20));
  const yourItems = namedItems(model);
  const yourP = yourItems.length;

  return (
    <article>
      <StationHead kicker="Station 05 · One latent variable" title="The measurement machine"
        lead="A factor model is a machine that manufactures correlations. Turn its dials yourself, then watch maximum likelihood turn them for you." />

      <Beat kind="wonder" title="What pattern would one attitude leave?">
        <Choose onDone={() => markDone('s5')} answer={1}
          question="Suppose a single attitude — tradition and conformity — drives all four answers, and nothing else connects them. What pattern must their correlations follow?"
          options={['All correlations are equal.', 'Each correlation is the product of two item-specific strengths.', 'There is no particular pattern.']}
          explain={<>If the attitude is the only thing the items share, item <i>i</i> and item <i>j</i> are connected only through it — once via strength λ<sub>i</sub>, once via λ<sub>j</sub>. So r<sub>ij</sub> = λ<sub>i</sub> · λ<sub>j</sub>. Strong items correlate strongly with everything; weak items weakly.</>} />
      </Beat>

      <Beat kind="play" title="Drive the machine">
        <div className="card play">
          <div className="row" style={{ marginBottom: 12 }}>
            <label className="hint" style={{ margin: 0 }}>Data&nbsp;
              <select value={dsId} onChange={e => { stop(); setSig(null); setMsg(''); setDs(e.target.value); }}>
                {DATASETS.map(d => <option key={d.id} value={d.id}>{d.label} (n = {d.n.toLocaleString('en')})</option>)}
              </select>
            </label>
            <span className="seg" role="group" aria-label="Number of items">
              <button aria-pressed={!four} onClick={() => { stop(); setSig(null); setMsg(''); setFour(false); }}>3 items</button>
              <button aria-pressed={four} onClick={() => { stop(); setSig(null); setMsg(''); setFour(true); }}>4 items</button>
            </span>
          </div>
          <div className="play-grid">
            <div>
              <svg viewBox="0 0 340 190" width="100%" role="img" aria-label="Path diagram: the latent variable η with arrows to each item; arrow thickness shows the loading">
                <ellipse cx="170" cy="40" rx="78" ry="28" fill="var(--latent)" stroke="var(--ink)" strokeWidth="2" />
                <text className="lbl-d" x="170" y="46" textAnchor="middle">η · tradition</text>
                {idx.map((_, i) => {
                  const x = xs[i] + 34;
                  return (
                    <g key={i}>
                      <line x1={170 + (x - 170) * 0.3} y1="66" x2={x} y2="130" stroke="var(--link)" strokeWidth={1 + L[i] * 7} strokeLinecap="round" />
                      <text className="lbl" x={(170 + x) / 2 + (x < 170 ? -16 : 16)} y="100" textAnchor="middle">{L[i].toFixed(2)}</text>
                      <rect x={xs[i]} y="132" width="68" height="34" rx="7" fill="var(--obs)" stroke="var(--ink)" strokeWidth="2" />
                      <text className="lbl" x={x} y="153" textAnchor="middle">{SHORT[items[i]]}</text>
                    </g>
                  );
                })}
              </svg>
              {idx.map((_, i) => <Slider key={i} label={`λ ${SHORT[items[i]]}`} min={0} max={0.95} step={0.01} value={L[i]} onChange={v => drag(i, v)} />)}
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn primary" onClick={runML}>▶ Let ML estimate</button>
                {!four && <button className="btn" onClick={solveExactly}>Solve exactly</button>}
                <button className="btn" onClick={() => { stop(); setSig(null); setMsg(''); setLam([0.5, 0.5, 0.5, 0.5]); }}>Reset</button>
              </div>
              <p className="hint" aria-live="polite">{msg || 'Drag a loading and watch the right side. Can you make every residual zero?'}</p>
            </div>
            <div>
              <p className="mx-cap">Observed correlations S</p>
              <MatrixView M={S} labels={items.map(i => SHORT[i])} mode="cor" />
              <p className="mx-cap" style={{ marginTop: 12 }}>Made by your machine Σ</p>
              <MatrixView M={Sigma} labels={items.map(i => SHORT[i])} mode="cor" />
              <p className="mx-cap" style={{ marginTop: 12 }}>Left over S − Σ (green: model too low, orange: too high)</p>
              <MatrixView M={Res} labels={items.map(i => SHORT[i])} mode="res" />
              <div className="metrics">
                <Metric label="Discrepancy F" value={F.toFixed(4)} />
                <Metric label="Largest residual" value={maxRes.toFixed(3)} />
              </div>
            </div>
          </div>
        </div>
      </Beat>

      <Beat kind="explain" title="Why three items fit perfectly and four can fail">
        <Explain>
          <p>Each correlation is a product of two loadings. With <b>three items</b> there are three correlations and three loadings — the machine can always hit all three exactly. A perfect fit here says nothing about whether the model is right.</p>
          <p>A <b>fourth item</b> adds three new correlations but only one new loading. Now the data must obey a pattern the model predicts: the products r<sub>12</sub>·r<sub>34</sub>, r<sub>13</sub>·r<sub>24</sub> and r<sub>14</sub>·r<sub>23</sub> must be equal. {four && <>In these data they are {tetrads.map(t => t.toFixed(3)).join(', ')} — {Math.max(...tetrads) - Math.min(...tetrads) > 0.02 ? 'not quite equal, so some correlation is left unexplained' : 'almost equal, so one factor explains the pattern well'}.</>} That is what makes the model testable.</p>
        </Explain>
      </Beat>

      <Beat kind="formula" title="The machine in matrix form">
        <Formula plug={<Tex block>{`r_{\\text{${SHORT[items[0]]}},\\text{${SHORT[items[1]]}}} = ${L[0].toFixed(2)} \\times ${L[1].toFixed(2)} = ${(L[0] * L[1]).toFixed(3)} \\quad\\text{(observed: ${S[1][0].toFixed(3)})}`}</Tex>}>
          <Tex block>{'\\Sigma(\\theta) = \\Lambda\\,\\Phi\\,\\Lambda^\\top + \\Theta'}</Tex>
          <Tex block>{'\\text{one standardized factor:}\\quad \\sigma_{ij} = \\lambda_i\\lambda_j, \\qquad \\theta_i = 1-\\lambda_i^2'}</Tex>
          <p className="hint">Θ holds the noise you met in station 1.2: the part of each item the factor does not explain. Its item text, for reference — <i>{SHORT[items[0]]}</i>: “{ITEM_TEXT[items[0]]}”</p>
        </Formula>
      </Beat>

      <Beat kind="yours" title={`Can ${constructName(model)} be tested?`}>
        <Yours>
          {yourP < 3 && <p className="verdict">You have named {yourP} item{yourP === 1 ? '' : 's'}. A single factor needs at least three to be estimated at all — and four to be tested.</p>}
          {yourP === 3 && <p className="verdict">Three items: your model will be estimated, but it will fit perfectly by construction. Consider a fourth item, or combine {constructName(model)} with a second factor.</p>}
          {yourP >= 4 && <p className="verdict">{yourP} items: your one-factor model makes {(yourP * (yourP - 1)) / 2} correlations from {yourP} loadings, leaving {(yourP * (yourP - 1)) / 2 - yourP} that can contradict it. That is a real test.</p>}
          <p>Ask yourself for each item: is {constructName(model)} the <i>only</i> thing it shares with the others? Similar wording or a common reversed format would create extra shared noise — which station 2.3 will show as a leftover residual.</p>
        </Yours>
      </Beat>
    </article>
  );
}
