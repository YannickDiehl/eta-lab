// The map of SEM · when the data break ML's assumptions. A chooser for the estimator, and one
// widget for each repair the course uses:
//   EstimatorChooser  three questions about your items → the lavaan call in the course's style
//   MlrSimulation     non-normal data: ML's standard errors and χ² are overconfident, MLR repairs them
//                     (Monte Carlo from R, map-mc.json)
//   WlsmvPipeline     ordinal items: thresholds from frequencies, a polychoric correlation found by
//                     hand, then weighted least squares
//   FimlWidget        missing answers: who contributes what to the likelihood, and when listwise
//                     deletion goes wrong (Monte Carlo from R)
import { useMemo, useState } from 'react';
import { Tex } from '../../components/ui.tsx';
import { rng } from '../../math/stats.ts';
import { NumberCheck } from '../day0/widgets.tsx';
import { chooseEstimator, PILE_UP_TEXT, type Categories } from '../../math/estimatorRule.ts';
import { cellProbs, logLik, pearsonOfTable, thresholdsFromCounts } from './estimate.ts';
import type { EstData, McData } from './estimation.tsx';

// ---------------------------------------------------------------- E5.0 · which estimator?
export function EstimatorChooser() {
  const [cats, setCats] = useState<Categories | null>(null);
  const [skew, setSkew] = useState<boolean | null>(null);
  const [miss, setMiss] = useState<boolean | null>(null);
  const ready = cats !== null && skew !== null && miss !== null;
  const advice = ready ? chooseEstimator(cats, skew) : null;
  const ord = advice?.estimator === 'WLSMV';
  const why = advice ? `${advice.why}${advice.check ? ` Check: estimate the model with ${advice.check} too and compare.` : ''}` : '';
  const code = ord
    ? `fit <- cfa(\n  model = model,\n  data = data,\n  estimator = "WLSMV",\n  ordered = T${miss ? ',\n  missing = "pairwise"' : ''}\n)`
    : `fit <- cfa(\n  model = model,\n  data = data,\n  estimator = "MLR"${miss ? ',\n  missing = "fiml.x"' : ''}\n)`;
  const Q = <T,>({ q, opts, v, set }: { q: string; opts: [T, string][]; v: T | null; set: (x: T) => void }) => (
    <div className="chooser-q"><p>{q}</p><div className="seg wrap" role="group" aria-label={q}>{opts.map(([o, l]) => <button key={l} aria-pressed={v === o} onClick={() => set(o)}>{l}</button>)}</div></div>
  );
  return (
    <div className="fig chooser">
      <Q q="How many answer categories do your items have?" opts={[['2–3', '2–3'], ['4', '4'], ['5–6', '5–6'], ['7+', '7 or more']] as [Categories, string][]} v={cats} set={setCats} />
      <Q q={`Do the answers pile up at one end — ${PILE_UP_TEXT} (frq() shows it)?`} opts={[[false, 'no'], [true, 'yes']]} v={skew} set={setSkew} />
      <Q q="Are some answers missing?" opts={[[false, 'none'], [true, 'yes, some']]} v={miss} set={setMiss} />
      {ready && <div className="chooser-out">
        <p><b>{ord ? 'WLSMV' : 'MLR'}</b> — {why} {miss ? (ord ? 'Missing answers: WLSMV uses every pair of items that was answered (pairwise).' : 'Missing answers: full-information ML keeps every respondent (fiml.x also uses incomplete covariates).') : ''}</p>
        <pre className="syntax"><code>{code}</code></pre>
        <p className="hint">The course’s rule (Day 2, section 9). Your project step of Day 2 asks the same questions — and writes the choice into your project’s R code.</p>
      </div>}
    </div>
  );
}

// ---------------------------------------------------------------- E5.1 · MLR: overconfident ML
const DIST: Record<string, string> = { normal: 'normal', moderate: 'moderately non-normal (skewness 2, kurtosis 7)', severe: 'severely non-normal (skewness 3, kurtosis 21)' };
export function MlrSimulation({ mc, scaling }: { mc: McData | null; scaling: number }) {
  const [dist, setDist] = useState('severe');
  const [n, setN] = useState(500);
  if (!mc) return <p className="hint">Loading the simulation…</p>;
  const r = mc.mlr.rows.find(x => x.dist === dist && x.n === n)!;
  const W = 560, H = 230, bins = r.hist.length, top = Math.max(...r.hist);
  const X = (v: number) => 20 + ((v - r.lo) / (r.hi - r.lo)) * (W - 40);
  const bw = (W - 40) / bins;
  const band = (half: number, y: number, cls: string, label: string) => (
    <g className={cls}><line x1={X(r.truth - half)} x2={X(r.truth + half)} y1={y} y2={y} /><line x1={X(r.truth - half)} x2={X(r.truth - half)} y1={y - 5} y2={y + 5} /><line x1={X(r.truth + half)} x2={X(r.truth + half)} y1={y - 5} y2={y + 5} />{X(r.truth + half) + 6 + label.length * 6.5 < W
      ? <text x={X(r.truth + half) + 6} y={y + 4} className="f-lbl">{label}</text>
      : <text x={X(r.truth - half) - 6} y={y + 4} className="f-lbl r">{label}</text>}</g>
  );
  const pct = (v: number) => `${(100 * v).toFixed(1)} %`;
  return (
    <div className="fig">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="seg wrap" role="group" aria-label="Distribution">{Object.keys(DIST).map(k => <button key={k} aria-pressed={dist === k} onClick={() => setDist(k)}>{k}</button>)}</div>
        <div className="seg" role="group" aria-label="Sample size">{[200, 500, 1000].map(k => <button key={k} aria-pressed={n === k} onClick={() => setN(k)}>n = {k}</button>)}</div>
      </div>
      <p className="hint">{r.reps} samples of {n} respondents, {DIST[dist]}, simulated from the course’s two-factor model; each estimated with ML and with MLR. The loading of ipbhprp (true value {r.truth.toFixed(2)}):</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label="Histogram of the estimates with the spread ML and MLR claim">
        {r.hist.map((c, i) => <rect key={i} x={20 + i * bw + 1} y={H - 24 - (c / top) * (H - 100)} width={bw - 2} height={(c / top) * (H - 100)} className="mc-bar" />)}
        <line x1={X(r.truth)} x2={X(r.truth)} y1={66} y2={H - 24} className="mc-truth" />
        {band(1.96 * r.sd, 14, 'mc-emp', 'how much the estimates really vary (95 %)')}
        {band(1.96 * r.se_ml, 34, 'mc-ml', 'what ML claims')}
        {band(1.96 * r.se_mlr, 54, 'mc-mlr', 'what MLR claims')}
        {[r.lo, r.truth, r.hi].map((t, i) => <text key={t} x={X(t)} y={H - 8} className="f-lbl c">{i === 2 ? '≥ ' : i === 0 ? '≤ ' : ''}{t.toFixed(2)}</text>)}
      </svg>
      <div className="fig-row">
        <div className="fig-text">
          <table className="rp-table left">
            <thead><tr><th /><th>ML</th><th>MLR</th></tr></thead>
            <tbody>
              <tr><td>average standard error (true spread {r.sd.toFixed(3)})</td><td>{r.se_ml.toFixed(3)}</td><td>{r.se_mlr.toFixed(3)}</td></tr>
              <tr><td>95 % intervals that contain the truth (should be 95 %)</td><td className={r.cover_ml < 0.92 ? 'est-changed' : ''}>{pct(r.cover_ml)}</td><td>{pct(r.cover_mlr)}</td></tr>
              <tr><td>true model rejected by χ² (should be 5 %)</td><td className={r.reject_ml > 0.08 ? 'est-changed' : ''}>{pct(r.reject_ml)}</td><td className={r.reject_mlr > 0.08 ? 'est-changed' : ''}>{pct(r.reject_mlr)} <small>(scaled)</small></td></tr>
            </tbody>
          </table>
        </div>
        <div className="fig-text">
          <p>{dist === 'normal'
            ? 'With normal data ML and MLR agree: both standard errors match the true spread, and χ² rejects the true model about 5 % of the time.'
            : 'The estimates themselves stay near the truth (with small samples a little too high, for ML and MLR alike — MLR has the same estimates). But ML is overconfident: its standard errors are too small, its intervals too narrow, and its χ² rejects a true model far too often. MLR’s “sandwich” standard errors and scaled χ² repair most of it.'}</p>
          {dist === 'severe' && n === 200 && <p className="hint">With severe non-normality and only 200 respondents, even the scaled χ² rejects too often: robust corrections need samples of reasonable size too.</p>}
        </div>
      </div>
      <p className="hint">In the course data the scaling factor of χ² is {scaling.toFixed(3)}: the ML χ² is divided by it — the data are moderately non-normal. Satorra & Bentler (1994) proposed the scaled χ², Yuan & Bentler (2000) the version lavaan’s MLR uses.</p>
      <details className="deeper">
        <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>The sandwich</span></summary>
        <div className="deeper-body">
          <div className="sc-formula"><Tex block>{'\\operatorname{Cov}_{\\text{robust}}(\\hat\\theta) = \\tfrac1N\\; A^{-1}\\,B\\,A^{-1}'}</Tex></div>
          <p>A is the curvature of the valley (the information matrix of ML: the “bread”); B is how much the slope of the likelihood actually varies from respondent to respondent (the “meat”). With normal data A = B and the sandwich shrinks to ML’s A⁻¹. With heavy tails, single respondents pull harder than normal theory expects: B is larger, and so are the standard errors. The point estimates are ML’s — MLR changes only standard errors and the test.</p>
        </div>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------- E5.2 · WLSMV as a pipeline
export function WlsmvPipeline({ d }: { d: EstData }) {
  const o = d.ord;
  const [v, setV] = useState('');
  const [rho, setRho] = useState(0);
  const ta = o.thresholds[0], tb = o.thresholds[1];
  const counts = o.counts[0], N = counts.reduce((a, b) => a + b, 0);
  // a cross table simulated from R's thresholds and polychoric correlation (the real one stays in R)
  const table = useMemo(() => {
    const P = cellProbs(ta, tb, o.poly).flat(), u = rng(2004), n = 1840, out = Array(P.length).fill(0);
    const cum = P.map((_, i) => P.slice(0, i + 1).reduce((a, b) => a + b, 0));
    for (let k = 0; k < n; k++) { const r = u() * cum[cum.length - 1]; out[cum.findIndex(c => c >= r)]++; }
    return Array.from({ length: 6 }, (_, i) => out.slice(i * 6, i * 6 + 6));
  }, [ta, tb, o.poly]);
  const grid = useMemo(() => Array.from({ length: 51 }, (_, i) => -0.2 + i * 0.02).map(r => ({ r, ll: logLik(table, cellProbs(ta, tb, r)) })), [table, ta, tb]);
  const best = grid.reduce((a, b) => (b.ll > a.ll ? b : a));
  const ll = logLik(table, cellProbs(ta, tb, rho));
  const pear = pearsonOfTable(table);
  const found = Math.abs(rho - best.r) <= 0.021;
  const probs = cellProbs(ta, tb, rho), nT = table.flat().reduce((a, b) => a + b, 0);
  const th = thresholdsFromCounts(counts);
  let cum = 0;
  // the bivariate normal and its cuts
  const S = 200, Z = (z: number) => S / 2 + (z / 3.2) * (S / 2 - 6), Zy = (z: number) => S / 2 - (z / 3.2) * (S / 2 - 6);
  const ell = (rad: number) => Array.from({ length: 73 }, (_, i) => { const t = (i / 72) * 2 * Math.PI, a = Math.cos(t), b = Math.sin(t); return `${Z(rad * a)},${Zy(rad * (rho * a + Math.sqrt(1 - rho * rho) * b))}`; }).join(' ');
  const LW = 300, LH = 120, lmax = best.ll, span = 120;   // show the top 120 units of log L
  const LX = (r: number) => 30 + ((r + 0.2) / 1) * (LW - 40), LY = (l: number) => 10 + (Math.min(lmax - l, span) / span) * (LH - 30);
  return (
    <div className="fig wlsmv">
      <div className="pipe-step">
        <span className="sc-tag">1 · thresholds</span>
        <p>Behind each ordered answer WLSMV imagines a continuous, normal attitude y*. A respondent answers category c when y* lies between the thresholds ν<sub>c−1</sub> and ν<sub>c</sub>. The thresholds come straight from the frequencies: ν<sub>c</sub> is the point of the standard normal below which the share of answers up to c lies.</p>
        <table className="rp-table"><thead><tr><th>{o.items[0]}</th>{counts.map((_, i) => <th key={i}>{i + 1}</th>)}</tr></thead>
          <tbody>
            <tr><td>answers</td>{counts.map((c, i) => <td key={i}>{c}</td>)}</tr>
            <tr><td>share up to here</td>{counts.map((c, i) => { cum += c; return <td key={i}>{(cum / N).toFixed(3)}</td>; })}</tr>
            <tr><td>threshold ν</td>{th.map((t, i) => <td key={i}>{t.toFixed(3)}</td>)}<td>—</td></tr>
          </tbody></table>
        <NumberCheck label={`ν₁ = qnorm(${counts[0]} / ${N}) =`} expect={th[0]} tol={0.002} value={v} onChange={setV} unit={`the first threshold of ${o.items[0]}`} hint={`in R: qnorm(${counts[0]} / ${N})`} />
      </div>
      <div className="pipe-step">
        <span className="sc-tag">2 · polychoric correlations</span>
        <p>Two items, two latent attitudes, and a 6 × 6 table of answers. Which correlation ρ of the attitudes, cut at the thresholds, makes this table most likely? Move ρ until the log-likelihood is as large as it gets.</p>
        <div className="fig-row">
          <svg viewBox={`0 0 ${S} ${S}`} className="fig-svg poly-svg" role="img" aria-label="Bivariate normal of two latent attitudes, cut into 6 by 6 cells by the thresholds">
            {ta.map((t, i) => <line key={'a' + i} x1={Z(t)} x2={Z(t)} y1="4" y2={S - 4} className="poly-cut" />)}
            {tb.map((t, i) => <line key={'b' + i} y1={Zy(t)} y2={Zy(t)} x1="4" x2={S - 4} className="poly-cut" />)}
            <polyline points={ell(1)} className="poly-ell" fill="none" /><polyline points={ell(2)} className="poly-ell faint" fill="none" />
            <text x={S - 6} y={S - 8} className="f-lbl r">{o.items[0]}*</text><text x="8" y="14" className="f-lbl">{o.items[1]}*</text>
          </svg>
          <div>
            <label className="ctl"><span>correlation ρ of the attitudes</span><input type="range" min={-0.2} max={0.8} step={0.01} value={rho} onChange={e => setRho(+e.target.value)} /><output>{rho.toFixed(2)}</output></label>
            <svg viewBox={`0 0 ${LW} ${LH}`} className="fig-svg" role="img" aria-label="Log-likelihood of the table for each value of rho">
              <polyline points={grid.map(g => `${LX(g.r)},${LY(g.ll)}`).join(' ')} className="vl-curve" fill="none" />
              <circle cx={LX(rho)} cy={LY(ll)} r="5" className="srch-dot" />
              {[0, 0.2, 0.4, 0.6].map(t => <text key={t} x={LX(t)} y={LH - 4} className="f-lbl c">{t.toFixed(1)}</text>)}
              <text x="4" y="12" className="f-lbl">log L</text>
            </svg>
            <div className="poly-res" aria-label="Observed minus expected answers in the 36 cells">
              {table.map((r, i) => r.map((c, j) => { const e = probs[i][j] * nT, z = (c - e) / Math.sqrt(e); return <i key={`${i}${j}`} style={{ background: z >= 0 ? `rgba(29,158,117,${Math.min(0.85, Math.abs(z) / 6)})` : `rgba(216,90,48,${Math.min(0.85, Math.abs(z) / 6)})` }} title={`${c} observed, ${e.toFixed(0)} expected`} />; }))}
            </div>
            <p className="hint">The 36 cells: green where more people answered than ρ predicts, orange where fewer.</p>
          </div>
        </div>
        {found
          ? <p className="est-goal ok">✓ ρ̂ = {best.r.toFixed(2)} — the polychoric correlation (R estimates {o.poly.toFixed(3)} on the real table). The Pearson correlation of the answers 1–6 is only {pear.toFixed(2)} (R: {o.pearson.toFixed(3)}): the boxes attenuate it.</p>
          : <p className="est-goal">Your turn: find the top of the curve. The colours of the 36 cells fade as ρ gets right.</p>}
        <p className="hint">The table is simulated from R’s thresholds and polychoric correlation, so that no respondent’s answers leave R; it behaves like the real one. The figure above compares Pearson and polychoric correlations for all seven items.</p>
      </div>
      <div className="pipe-step">
        <span className="sc-tag">3 · the model</span>
        <p>The factor model is then fitted not to S but to the matrix of polychoric correlations — by least squares, each correlation weighted by how precisely it is known (<b>diagonally weighted least squares</b>). The standard errors and the χ² are then corrected for the weights, in mean and variance: <b>WLSMV</b> (Muthén, du Toit & Spisic, 1997).</p>
        <ol className="loop-flow wl-flow"><li>frequencies → thresholds</li><li>pairs of items → polychoric correlations</li><li>weighted least squares → loadings, χ²</li></ol>
        <details className="deeper">
          <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>Why not full WLS? And what about missing answers?</span></summary>
          <div className="deeper-body">
            <p>Full weighted least squares (Browne’s ADF, 1984) weights with the whole covariance matrix of all polychoric correlations — for seven items that is a 21 × 21 matrix that must be estimated from the data, and it needs thousands of respondents to be stable. WLSMV uses only its diagonal for the estimates and the full matrix only for the corrections: stable with a few hundred respondents.</p>
            <p>Because every polychoric correlation uses only one pair of items, WLSMV handles missing answers <i>pairwise</i>: each pair with all respondents who answered both (<code>missing = "pairwise"</code>, the course’s choice). This assumes that answers are missing completely at random — a stronger assumption than FIML needs.</p>
          </div>
        </details>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- E5.3 · FIML
const PEOPLE: (number | null)[][] = [[4, 5, 5, 6], [3, 4, null, 5], [5, 5, 6, 6], [null, null, 4, 5], [2, 3, 5, 4], [4, 4, 5, null], [5, null, 6, 6], [3, 3, 4, 4]];
const MECH: Record<string, string> = {
  mcar: 'completely at random (MCAR): a random share skips the universalism questions',
  mar: 'at random (MAR): who skips them depends on an answer we have — those who value modesty (ipmodst) most skip more often',
  mnar: 'not at random (MNAR): who skips them depends on the missing answer itself — those who care most about the environment skip more often',
};
export function FimlWidget({ d, mc }: { d: EstData; mc: McData | null }) {
  const [who, setWho] = useState(3);
  const [listwise, setListwise] = useState(false);
  const [mech, setMech] = useState('mar');
  const [share, setShare] = useState(0.3);
  const items = d.toy.items, p = PEOPLE[who], seen = p.map(v => v !== null);
  const complete = (r: (number | null)[]) => r.every(v => v !== null);
  const used = listwise ? !complete(p) ? [false, false, false, false] : seen : seen;
  const row = mc?.fiml.rows.find(r => r.mech === mech && Math.abs(r.share - share) < 1e-9);
  const c = d.course, partial = Object.entries(c.answered).filter(([k]) => +k > 0 && +k < 7).reduce((a, [, v]) => a + v, 0);
  const Dot = ({ lo, hi, truth, lw, fi, fmt }: { lo: number; hi: number; truth: number; lw: number; fi: number; fmt: (v: number) => string }) => {
    const X = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
    return (
      <div className="fiml-scale">
        <i className="truth" style={{ left: X(truth) }} title={`truth ${fmt(truth)}`} />
        <b className="lw" style={{ left: X(lw) }} title={`listwise ${fmt(lw)}`} />
        <b className="fi" style={{ left: X(fi) }} title={`FIML ${fmt(fi)}`} />
        <span>{fmt(lo)}</span><span>{fmt(hi)}</span>
      </div>
    );
  };
  return (
    <div className="fig">
      <div className="fig-row">
        <div>
          <p className="hint" style={{ marginTop: 0 }}>Eight invented respondents, four items. Click a person.</p>
          <table className="rp-table fiml-people">
            <thead><tr><th />{items.map(it => <th key={it}>{it}</th>)}</tr></thead>
            <tbody>{PEOPLE.map((r, i) => (
              <tr key={i} className={`${i === who ? 'on' : ''} ${listwise && !complete(r) ? 'gone' : ''}`} onClick={() => setWho(i)}>
                <th><button className="linklike" onClick={() => setWho(i)}>person {i + 1}</button></th>{r.map((v, j) => <td key={j} className={v === null ? 'na' : ''}>{v ?? 'NA'}</td>)}
              </tr>
            ))}</tbody>
          </table>
          <div className="seg" role="group" aria-label="Missing data treatment">
            <button aria-pressed={!listwise} onClick={() => setListwise(false)}>FIML: everyone</button>
            <button aria-pressed={listwise} onClick={() => setListwise(true)}>listwise: complete cases only</button>
          </div>
        </div>
        <div className="fig-text">
          <p>The likelihood is a sum over people. FIML lets each person contribute with <b>the items they answered</b>: their part of the mean vector μ and of Σ.</p>
          <div className="fiml-mats">
            <div><Tex>{'\\mu'}</Tex>{items.map((it, j) => <span key={it} className={used[j] ? 'on' : ''}>μ<sub>{j + 1}</sub></span>)}</div>
            <div className="fiml-sig"><Tex>{'\\Sigma'}</Tex>{items.map((_, a) => <div key={a}>{items.map((__, b) => <span key={b} className={b > a ? 'blank' : used[a] && used[b] ? 'on' : ''}>{b > a ? '' : `σ${a + 1}${b + 1}`}</span>)}</div>)}</div>
          </div>
          <p>{listwise && !complete(p)
            ? <>Listwise deletion drops person {who + 1} completely — their {p.filter(v => v !== null).length} answers are lost. Of eight people, {PEOPLE.filter(complete).length} remain.</>
            : <>Person {who + 1} answered {seen.filter(Boolean).length} of 4 items and contributes to {seen.filter(Boolean).length === 4 ? 'all of μ and Σ' : <>the {seen.filter(Boolean).length} μ’s and the cells of Σ shown in colour — nothing is invented for the missing answer</>}.</>}</p>
        </div>
      </div>
      <details className="deeper">
      <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>When does it matter? Listwise against FIML, in a simulation</span></summary>
      <div className="deeper-body">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="seg wrap" role="group" aria-label="Why answers are missing">{Object.keys(MECH).map(k => <button key={k} aria-pressed={mech === k} onClick={() => setMech(k)}>{k.toUpperCase()}</button>)}</div>
        <div className="seg" role="group" aria-label="Share missing">{[0.1, 0.3, 0.5].map(s => <button key={s} aria-pressed={share === s} onClick={() => setShare(s)}>{s * 100} % missing</button>)}</div>
      </div>
      <p className="hint">Missing {MECH[mech]}. {mc ? `${mc.fiml.reps} samples of ${mc.fiml.n} each, simulated from the course’s two-factor model.` : ''}</p>
      {mc && row && <>
        <div className="fiml-row"><span>correlation of the factors</span><Dot lo={0.5} hi={0.62} truth={mc.fiml.truth_r} lw={row.r_lw} fi={row.r_fi} fmt={v => v.toFixed(2)} /></div>
        <div className="fiml-row"><span>mean of impenv</span><Dot lo={4.0} hi={4.9} truth={mc.fiml.truth_m} lw={row.m_lw} fi={row.m_fi} fmt={v => v.toFixed(2)} /></div>
        <p className="srch-legend"><span><i className="truth" />truth</span><span><i className="lw" />listwise ({Math.round(row.n_lw)} of {mc.fiml.n} used)</span><span><i className="fi" />FIML (all {Math.round(row.n_fi)})</span></p>
        <p>{mech === 'mcar'
          ? 'Completely at random: both are right on average — but listwise throws away respondents and with them precision.'
          : mech === 'mar'
            ? 'At random: listwise deletion is biased — the remaining respondents are not like the others. FIML is not: the answers people did give (to ipmodst) carry the information about the ones they skipped.'
            : 'Not at random: both are biased. No estimator can recover what depends on the missing answers themselves — FIML is only a little better. Here only a better design helps (or a model of why people skip).'}</p>
      </>}
      </div>
      </details>
      <p className="hint">The course data: of {c.total} Dutch respondents, {c.answered['7']} answered all seven items, {partial} some, {c.answered['0']} none. Listwise ML uses {c.n} (χ² = {c.chisq.toFixed(1)}), FIML {c.fiml_n} (χ² = {c.fiml_chisq.toFixed(1)}) — the 20 who answered nothing cannot contribute. The course writes <code>missing = "fiml.x"</code>: the “x” also keeps respondents with missing values on exogenous covariates (Week 2). Arbuckle (1996) made FIML practical for SEM.</p>
      <details className="deeper">
        <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>The casewise likelihood</span></summary>
        <div className="deeper-body">
          <div className="sc-formula"><Tex block>{'\\log L = \\sum_i -\\tfrac12\\Big[k_i \\log 2\\pi + \\log|\\Sigma_i| + (y_i - \\mu_i)^{\\prime}\\,\\Sigma_i^{-1}\\,(y_i - \\mu_i)\\Big]'}</Tex></div>
          <p>For respondent i, y<sub>i</sub> holds the k<sub>i</sub> answers they gave; μ<sub>i</sub> and Σ<sub>i</sub> are the rows and columns of the model’s μ and Σ for exactly those items — the coloured cells above. Nothing is imputed. That is why FIML needs a mean structure and why it works under MAR: the likelihood of what was observed is correct whenever the reason for missingness lies in what was observed.</p>
        </div>
      </details>
    </div>
  );
}
