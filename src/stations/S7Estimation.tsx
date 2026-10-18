// Station 07 · Rolling downhill
// Estimation as a search on a landscape: the height is the discrepancy F between
// the data and the model. Learners drop a ball, watch it roll, compare ML with ULS,
// and see a standard error as the width of the valley.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Beat, Choose, Deeper, Explain, Formula, Metric, Slider, StationHead, Tex, Yours, fmt } from '../components/ui.tsx';
import { DATASETS, byId } from '../data/datasets.ts';
import { discrepancy, implied, oneFactor, parameters, type Estimator } from '../math/cfa.ts';
import { estimate } from '../math/fit.ts';
import { hessian } from '../math/optimize.ts';
import { inverse } from '../math/linalg.ts';
import { constructName, markDone, type YourModel } from '../state.ts';

const A = 1, B = 2;            // the two loadings on the axes: rules (1) and behave (2)
const LO = 0.05, HI = 1.0, G = 90, SIZE = 320;

export function S7Estimation({ model }: { model: YourModel }) {
  const [dsId, setDs] = useState('gb2014');
  const [est, setEst] = useState<Estimator>('ML');
  const [n, setN] = useState(1780);
  const [path, setPath] = useState<[number, number][]>([]);
  const [steps, setSteps] = useState(0);
  const timer = useRef<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ds = byId(dsId);
  const spec = useMemo(() => oneFactor(ds.items), [ds]);
  const params = useMemo(() => parameters(spec), [spec]);
  const fitML = useMemo(() => estimate(spec, ds.S, ds.n), [spec, ds]);
  const fitULS = useMemo(() => estimate(spec, ds.S, ds.n, { estimator: 'ULS' }), [spec, ds]);
  const base = est === 'ML' ? fitML.x : fitULS.x;

  // the landscape: F as a function of two loadings, all other parameters at their best values
  const F2 = useMemo(() => (a: number, b: number) => {
    const x = base.slice(); x[A] = a; x[B] = b;
    return discrepancy(ds.S, implied(spec, params, x), est);
  }, [base, ds, spec, params, est]);

  const toPx = (v: number) => ((v - LO) / (HI - LO)) * SIZE;
  const fromPx = (px: number) => LO + (px / SIZE) * (HI - LO);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const vals: number[] = [];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) vals.push(F2(LO + ((i + 0.5) / G) * (HI - LO), LO + ((j + 0.5) / G) * (HI - LO)));
    const fin = vals.filter(Number.isFinite), mn = Math.min(...fin), mx = Math.max(...fin);
    const cell = SIZE / G;
    vals.forEach((v, idx) => {
      const i = idx % G, j = Math.floor(idx / G);
      const eps = 1e-4, lo = Math.log(eps), hi = Math.log(mx - mn + eps);
      const t = Number.isFinite(v) ? (Math.log(v - mn + eps) - lo) / (hi - lo) : 1;   // 0 = valley floor, 1 = highest
      const band = Math.max(0, Math.min(11, Math.floor(t * 12)));   // quantised → contour look
      const light = 50 + band * 3.8;
      ctx.fillStyle = `hsl(248 70% ${light}%)`;
      ctx.fillRect(i * cell, SIZE - (j + 1) * cell, cell + 0.5, cell + 0.5);
    });
  }, [F2]);

  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  useEffect(() => stop, []);
  useEffect(() => { stop(); setPath([]); setSteps(0); }, [dsId, est]);

  const roll = (a0: number, b0: number) => {
    stop();
    let a = a0, b = b0, k = 0;
    const pts: [number, number][] = [[a, b]];
    setPath([[a, b]]);
    timer.current = window.setInterval(() => {
      for (let s = 0; s < 3; s++) {
        const h = 1e-5;
        const ga = (F2(a + h, b) - F2(a - h, b)) / (2 * h), gb = (F2(a, b + h) - F2(a, b - h)) / (2 * h);
        let da = -0.12 * ga, db = -0.12 * gb;
        const len = Math.hypot(da, db);
        if (len > 0.03) { da *= 0.03 / len; db *= 0.03 / len; }
        a = Math.max(LO, Math.min(HI, a + da)); b = Math.max(LO, Math.min(HI, b + db));
        k++;
        if (Math.hypot(ga, gb) < 2e-4 || k > 600) { stop(); break; }
      }
      pts.push([a, b]);
      setPath(pts.slice()); setSteps(k);
    }, 40);
    markDone('s7');
  };

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const a = fromPx(((e.clientX - r.left) / r.width) * SIZE), b = fromPx(SIZE - ((e.clientY - r.top) / r.height) * SIZE);
    roll(a, b);
  };

  // standard-error ellipse from the curvature of the valley (2×2 Hessian at the ML minimum)
  const ellipse = useMemo(() => {
    const fML = (v: number[]) => { const x = fitML.x.slice(); x[A] = v[0]; x[B] = v[1]; return discrepancy(ds.S, implied(spec, params, x), 'ML'); };
    const H = hessian(fML, [fitML.x[A], fitML.x[B]]);
    const C = inverse(H).map(row => row.map(v => (2 / n) * v));
    const tr = C[0][0] + C[1][1], det = C[0][0] * C[1][1] - C[0][1] ** 2, disc = Math.sqrt(Math.max(tr * tr / 4 - det, 0));
    const l1 = tr / 2 + disc, l2 = tr / 2 - disc, ang = Math.atan2(l1 - C[0][0], C[0][1] || 1e-12);
    const k95 = Math.sqrt(5.991);
    return { rx: k95 * Math.sqrt(Math.max(l1, 0)), ry: k95 * Math.sqrt(Math.max(l2, 0)), ang, seA: Math.sqrt(C[0][0]), seB: Math.sqrt(C[1][1]) };
  }, [fitML, ds, spec, params, n]);

  const minML: [number, number] = [fitML.x[A], fitML.x[B]];
  const minULS: [number, number] = [fitULS.x[A], fitULS.x[B]];
  const last = path[path.length - 1];
  const sc = SIZE / (HI - LO);
  const yourSE = ellipse.seA * Math.sqrt(n / Math.max(model.n, 50));

  return (
    <article>
      <StationHead kicker="Station 07 · Estimation" title="Rolling downhill"
        lead="“Estimating a model” sounds like magic. It is a search: find the dial settings at which the model’s correlations are closest to the data. Here is the landscape that search walks on." />

      <Beat kind="wonder" title="What does the computer actually do?">
        <Choose onDone={() => markDone('s7')} answer={1}
          question="When lavaan “estimates” your factor model, what is it doing?"
          options={['It averages the items to get factor scores, then regresses each item on them.', 'It searches for the parameter values whose implied correlations are closest to the observed ones.', 'It computes the loadings with one closed formula, like a mean.']}
          explain={<>It searches. Each candidate set of loadings produces a matrix Σ; a discrepancy function scores how far Σ is from S; an optimizer walks downhill until no step makes it better. For most models there is no closed formula — only the search.</>} />
      </Beat>

      <Beat kind="play" title="Drop the ball">
        <div className="card play">
          <div className="row" style={{ marginBottom: 12 }}>
            <label className="hint" style={{ margin: 0 }}>Data&nbsp;
              <select value={dsId} onChange={e => setDs(e.target.value)}>{DATASETS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select>
            </label>
            <span className="seg" role="group" aria-label="Discrepancy function">
              <button aria-pressed={est === 'ML'} onClick={() => { setEst('ML'); markDone('s7'); }}>Maximum likelihood</button>
              <button aria-pressed={est === 'ULS'} onClick={() => { setEst('ULS'); markDone('s7'); }}>Least squares</button>
            </span>
          </div>
          <div className="play-grid">
            <div style={{ position: 'relative', width: '100%', maxWidth: SIZE + 40 }}>
              <div style={{ position: 'relative', marginLeft: 34 }}>
                <canvas ref={canvas} width={SIZE} height={SIZE} style={{ width: '100%', display: 'block', borderRadius: 12, border: '2px solid var(--ink)' }} aria-hidden="true" />
                <svg viewBox={`0 0 ${SIZE} ${SIZE}`} onClick={onClick} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair' }}
                  role="img" aria-label="Discrepancy landscape over two loadings; click anywhere to drop a ball and let it roll to the lowest point">
                  <ellipse cx={toPx(minML[0])} cy={SIZE - toPx(minML[1])} rx={ellipse.rx * sc} ry={ellipse.ry * sc}
                    transform={`rotate(${(-ellipse.ang * 180) / Math.PI} ${toPx(minML[0])} ${SIZE - toPx(minML[1])})`} fill="var(--sun)" fillOpacity=".55" stroke="var(--ink)" strokeWidth="2" strokeDasharray="5 4" />
                  {path.length > 1 && <polyline points={path.map(([a, b]) => `${toPx(a)},${SIZE - toPx(b)}`).join(' ')} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />}
                  {path[0] && <circle cx={toPx(path[0][0])} cy={SIZE - toPx(path[0][1])} r="6" fill="var(--card)" stroke="var(--ink)" strokeWidth="2" />}
                  {last && <circle cx={toPx(last[0])} cy={SIZE - toPx(last[1])} r="8" fill="var(--obs)" stroke="var(--ink)" strokeWidth="2.5" />}
                  <g transform={`translate(${toPx(minML[0])} ${SIZE - toPx(minML[1])})`}><path d="M-6,-6 L6,6 M6,-6 L-6,6" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" /></g>
                  {est === 'ULS' && <g transform={`translate(${toPx(minULS[0])} ${SIZE - toPx(minULS[1])})`}><circle r="6" fill="none" stroke="var(--ink)" strokeWidth="2.5" /></g>}
                  {path.length === 0 && <text className="lbl" x={SIZE / 2} y="28" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 4 }}>click anywhere to drop a ball</text>}
                </svg>
                <div className="lbl-s" style={{ textAlign: 'center', fontSize: 13, marginTop: 4 }}>λ rules →</div>
                <div className="lbl-s" style={{ position: 'absolute', left: -34, top: '45%', transform: 'rotate(-90deg)', fontSize: 13 }}>λ behave →</div>
              </div>
            </div>
            <div>
              <div className="metrics">
                <Metric label="Height F here" value={last ? F2(last[0], last[1]).toFixed(4) : '–'} />
                <Metric label="Steps rolled" value={String(steps)} />
                <Metric label="lavaan-style search" value={`${fitML.iterations} steps`} />
              </div>
              <p className="hint">✕ marks the ML minimum{est === 'ULS' ? ', ○ the least-squares minimum — close, but not the same point' : ''}. Darker = lower. The ball takes many small steps; a quasi-Newton search like lavaan’s uses the curvature and needs only a few.</p>
              <Slider label="Sample size n" min={100} max={10000} step={50} value={n} onChange={v => { setN(v); markDone('s7'); }} format={v => v.toLocaleString('en')} />
              <div className="metrics">
                <Metric label="SE λ rules" value={fmt(ellipse.seA, 3)} />
                <Metric label="SE λ behave" value={fmt(ellipse.seB, 3)} />
              </div>
              <p className="hint">The yellow ellipse is the 95% region: how far the minimum could wander in another sample of the same size. Slide n and watch it shrink.</p>
            </div>
          </div>
        </div>
      </Beat>

      <Beat kind="explain" title="Valleys, likelihoods and certainty">
        <Explain>
          <p>The landscape’s height is a <b>discrepancy</b> F: how far the model’s correlations are from the data. Least squares simply adds up squared differences. Maximum likelihood asks something sharper: <i>if the model were true, how likely would these exact data be?</i> Its F is low where that likelihood is high — and because it weighs each misfit by how informative it is, ML lands at a slightly different spot.</p>
          <p>The <b>shape</b> of the valley matters as much as its lowest point. A steep, narrow valley means the data pin the loading down: a small standard error. A flat valley means many values are almost equally good. More respondents make every valley steeper — the ellipse shrinks with √n.</p>
        </Explain>
      </Beat>

      <Beat kind="formula" title="What the ball is minimising">
        <Formula plug={<Tex block>{`\\text{SE}(\\hat\\lambda_{\\text{rules}}) = ${ellipse.seA.toFixed(3)} \\text{ at } n = ${n}; \\quad \\text{at } 4n: ${(ellipse.seA / 2).toFixed(3)}`}</Tex>}>
          <Tex block>{'F_{ML} = \\ln|\\Sigma(\\theta)| - \\ln|S| + \\operatorname{tr}\\!\\big(S\\,\\Sigma(\\theta)^{-1}\\big) - k'}</Tex>
          <p className="hint">F<sub>ML</sub> is zero exactly when Σ = S, and grows the further the model’s matrix is from the data’s. Its minimum is the maximum-likelihood estimate — under the assumption that the answers are multivariate normal, which station 2.4 puts to the test. k is the number of items. Standard errors shrink with √n.</p>
        </Formula>
      </Beat>

      <Deeper title="Under the hood: least squares, curvature, lavaan’s search">
        <Tex block>{'F_{ULS} = \\tfrac{1}{2}\\operatorname{tr}\\!\\big[(S-\\Sigma(\\theta))^2\\big]'}</Tex>
        <p>Least squares adds up the squared differences between S and Σ. ML weighs each difference by how much the data say about it, which is why the two minima (✕ and ○ in the landscape) differ a little. Switch the landscape to “Least squares” to see it.</p>
        <Tex block>{`\\operatorname{Cov}(\\hat\\theta) \\approx \\tfrac{2}{n}\\,H^{-1} \\quad\\Rightarrow\\quad \\text{SE}(\\hat\\lambda_{\\text{rules}}) \\approx \\sqrt{\\tfrac{2}{${n}}\\,[H^{-1}]_{11}} = ${ellipse.seA.toFixed(3)}`}</Tex>
        <p>H is the curvature of F<sub>ML</sub> at the minimum: a steep valley, a large H, a small standard error. For ML with complete data lavaan uses the expected curvature instead (<code>information = "expected"</code>); with MLR or missing data (FIML) it uses the observed one, as here. With large samples the two agree. And this landscape holds the other parameters fixed while two move; the standard errors lavaan reports let all parameters move at once, so they are a little larger (Day 2, section 5, shows the difference). Its optimizer (<code>optim.method = "nlminb"</code>) is a quasi-Newton search that needs a handful of steps where the rolling ball needs hundreds.</p>
        <p className="hint"><b>Reading.</b> Brown (2015), chapter 3 (estimation) and chapter 4 (interpreting the output).</p>
      </Deeper>

      <Beat kind="yours" title={`How precise could ${constructName(model)} be?`}>
        <Yours>
          <p>With your planned <b>{model.n.toLocaleString('en')}</b> respondents, a loading like the ones here would have a standard error of about <b>{fmt(yourSE, 3)}</b> — a 95% interval of roughly ±{fmt(1.96 * yourSE, 2)}.</p>
          <p className="verdict">{yourSE > 0.08 ? 'That is a wide valley: consider more respondents or stronger items.' : yourSE > 0.04 ? 'Workable precision for most purposes.' : 'A narrow valley — your loadings will be pinned down tightly.'}</p>
          <p>Precision grows with √n: four times the respondents halve the standard error. Doubling them only shrinks it by about 30%.</p>
        </Yours>
      </Beat>
    </article>
  );
}
