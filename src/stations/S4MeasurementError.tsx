// Station 04 · Noise hides relationships
// Classical test theory as a moving picture: true scores, observed answers, and
// why every single-item correlation underestimates the relationship we care about.
import { useMemo, useState } from 'react';
import { Beat, Explain, Formula, Metric, Predict, Slider, StationHead, Tex, Yours, fmt } from '../components/ui.tsx';
import { attenuated, correlation, normals, rng, spearmanBrown } from '../math/stats.ts';
import { constructName, markDone, namedItems, outcomeName, type YourModel } from '../state.ts';

const N = 260, MAXK = 6;

// One fixed sample of respondents: true scores and six error draws per variable.
function useSample() {
  return useMemo(() => {
    const u = rng(2027);
    // standardise z1 and make z2 exactly uncorrelated with it in this sample,
    // so the true scores correlate exactly at ρ and only the noise varies
    const std = (v: number[]) => { const m = v.reduce((a, b) => a + b, 0) / v.length; const c = v.map(x => x - m); const s = Math.sqrt(c.reduce((a, b) => a + b * b, 0) / v.length); return c.map(x => x / s); };
    const z1 = std(normals(u, N)), raw = std(normals(u, N));
    const b = raw.reduce((a, v, i) => a + v * z1[i], 0) / N;
    const z2 = std(raw.map((v, i) => v - b * z1[i]));
    return { z1, z2, ex: Array.from({ length: MAXK }, () => normals(u, N)), ey: Array.from({ length: MAXK }, () => normals(u, N)) };
  }, []);
}

type View = 'true' | 'both' | 'observed';

export function S4MeasurementError({ model }: { model: YourModel }) {
  const s = useSample();
  const [rho, setRho] = useState(0.6);
  const [relX, setRelX] = useState(0.5);
  const [relY, setRelY] = useState(0.5);
  const [k, setK] = useState(1);
  const [view, setView] = useState<View>('both');

  // True scores with correlation rho; observed = true + noise with Var(E) = (1 − rel)/rel,
  // averaged over k parallel items (so the noise shrinks by 1/k).
  const pts = useMemo(() => {
    const tx = s.z1, ty = s.z1.map((v, i) => rho * v + Math.sqrt(1 - rho * rho) * s.z2[i]);
    const sdx = Math.sqrt((1 - relX) / relX), sdy = Math.sqrt((1 - relY) / relY);
    const mean = (draws: number[][], i: number) => draws.slice(0, k).reduce((a, d) => a + d[i], 0) / k;
    const ox = tx.map((v, i) => v + sdx * mean(s.ex, i)), oy = ty.map((v, i) => v + sdy * mean(s.ey, i));
    return { tx, ty, ox, oy, rTrue: correlation(tx, ty), rObs: correlation(ox, oy) };
  }, [s, rho, relX, relY, k]);

  const relXk = spearmanBrown(relX, k), relYk = spearmanBrown(relY, k);
  const expected = attenuated(rho, relXk, relYk);
  const W = 340, R = 4.2, X = (v: number) => W / 2 + (v / R) * (W / 2 - 14), Y = (v: number) => W / 2 - (v / R) * (W / 2 - 14);
  const clamp = (v: number) => Math.max(-R, Math.min(R, v));
  const touch = () => markDone('s4');

  const items = namedItems(model);
  const [yRho, setYRho] = useState(0.5);
  const [yRel, setYRel] = useState(0.5);
  const yourK = Math.max(1, items.length);

  return (
    <article>
      <StationHead kicker="Station 04 · Why latent variables?" title="Noise hides relationships"
        lead="Every survey answer is part attitude, part noise. Before we build any model, see what that noise does to the relationships you want to study." />

      <Beat kind="wonder" title="Make a guess">
        <Predict question="Two attitudes are truly correlated at .60. Each is measured with one survey item that is only 50% reliable. What correlation will you see in your data?"
          min={0} max={0.6} step={0.01} start={0.55} truth={0.3} format={v => v.toFixed(2)} onDone={touch}
          explain={() => <>The noise in each item does not move with the other attitude, so it dilutes the relationship: .60 × √(.5 × .5) = .30. Half the relationship is gone before you run a single model.</>} />
      </Beat>

      <Beat kind="play" title="Watch the noise">
        <div className="card play">
          <div className="play-grid">
            <div>
              <div className="row" style={{ marginBottom: 10 }}>
                <span className="seg" role="group" aria-label="Which scores to show">
                  {(['true', 'both', 'observed'] as View[]).map(v => (
                    <button key={v} aria-pressed={view === v} onClick={() => { setView(v); touch(); }}>{v === 'true' ? 'True scores' : v === 'both' ? 'Both' : 'Observed answers'}</button>
                  ))}
                </span>
              </div>
              <svg viewBox={`0 0 ${W} ${W}`} width="100%" role="img" aria-label={`Scatterplot of ${N} simulated respondents. True correlation ${pts.rTrue.toFixed(2)}, observed correlation ${pts.rObs.toFixed(2)}.`}>
                <rect x="0" y="0" width={W} height={W} rx="14" fill="var(--bg)" stroke="var(--ink)" strokeWidth="2" />
                <line x1={X(-R)} x2={X(R)} y1={Y(0)} y2={Y(0)} stroke="var(--muted)" strokeOpacity=".35" />
                <line y1={Y(-R)} y2={Y(R)} x1={X(0)} x2={X(0)} stroke="var(--muted)" strokeOpacity=".35" />
                {view === 'both' && pts.tx.map((_, i) => (
                  <line key={'l' + i} x1={X(clamp(pts.tx[i]))} y1={Y(clamp(pts.ty[i]))} x2={X(clamp(pts.ox[i]))} y2={Y(clamp(pts.oy[i]))} stroke="var(--muted)" strokeOpacity=".25" />
                ))}
                {view === 'both' && pts.tx.map((_, i) => (
                  <circle key={'t' + i} r="2.6" cx={X(clamp(pts.tx[i]))} cy={Y(clamp(pts.ty[i]))} fill="var(--latent)" stroke="var(--ink)" strokeWidth=".8" />
                ))}
                {pts.tx.map((_, i) => {
                  const showObs = view !== 'true';
                  const x = showObs ? pts.ox[i] : pts.tx[i], y = showObs ? pts.oy[i] : pts.ty[i];
                  return <circle key={i} r="3.4" cx="0" cy="0" fill={showObs ? 'var(--obs)' : 'var(--latent)'} stroke="var(--ink)" strokeWidth="1"
                    style={{ transform: `translate(${X(clamp(x))}px, ${Y(clamp(y))}px)`, transition: 'transform .6s ease' }} />;
                })}
                <text className="lbl-s" x={W - 12} y={Y(0) - 6} textAnchor="end" style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 4 }}>attitude A →</text>
                <text className="lbl-s" x={X(0) + 6} y="20" style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 4 }}>attitude B ↑</text>
                {view === 'both' && <text className="lbl-s" x="12" y={W - 12}>lavender = true score · peach = observed answer</text>}
              </svg>
            </div>
            <div>
              <Slider label="True correlation ρ" min={0} max={0.95} step={0.05} value={rho} onChange={v => { setRho(v); touch(); }} />
              <Slider label="Reliability of A" min={0.1} max={1} step={0.05} value={relX} onChange={v => { setRelX(v); touch(); }} />
              <Slider label="Reliability of B" min={0.1} max={1} step={0.05} value={relY} onChange={v => { setRelY(v); touch(); }} />
              <Slider label="Items per attitude" min={1} max={MAXK} step={1} value={k} onChange={v => { setK(v); touch(); }} format={v => String(v)} />
              <div className="metrics">
                <Metric label="True correlation" value={fmt(pts.rTrue)} />
                <Metric label="Observed correlation" value={fmt(pts.rObs)} />
                <Metric label="Share that survives" value={`${Math.round((100 * pts.rObs) / Math.max(pts.rTrue, 1e-6))}%`} />
              </div>
              <p className="hint">Try it: set reliability to 1 and the two clouds coincide. Then add items — averaging shrinks the noise, but the observed correlation never quite reaches ρ.</p>
            </div>
          </div>
        </div>
      </Beat>

      <Beat kind="explain" title="Noise adds spread, not shared spread">
        <Explain>
          <p>Each observed answer is the true attitude plus a bit of noise. The noise in item A has nothing to do with attitude B, so it adds to the <b>spread</b> of A but not to what A and B <b>share</b>. A correlation is shared spread divided by total spread, so it shrinks.</p>
          <p>Averaging several items helps: the noise partly cancels. But it never disappears, so a sum score always underestimates the relationship. A <b>latent variable</b> takes a different route — it uses the pattern among several items to estimate the noise and set it aside. That is the machine we build next.</p>
        </Explain>
      </Beat>

      <Beat kind="formula" title="Classical test theory in three lines">
        <Formula plug={<Tex block>{`r_{AB} = ${rho.toFixed(2)} \\times \\sqrt{${relXk.toFixed(2)} \\times ${relYk.toFixed(2)}} = ${expected.toFixed(2)}`}</Tex>}>
          <Tex block>{'X = T + E, \\qquad \\text{reliability} = \\frac{\\operatorname{Var}(T)}{\\operatorname{Var}(X)}'}</Tex>
          <Tex block>{'r_{AB} = \\rho_{T_A T_B}\\,\\sqrt{\\text{rel}_A \\cdot \\text{rel}_B} \\qquad \\text{(attenuation)}'}</Tex>
          <Tex block>{'\\text{rel}_k = \\frac{k \\cdot \\text{rel}}{1 + (k-1)\\,\\text{rel}} \\qquad \\text{(Spearman–Brown, } k \\text{ items)}'}</Tex>
        </Formula>
      </Beat>

      <Beat kind="yours" title={`What this means for ${constructName(model)}`}>
        <Yours>
          <p>Suppose {constructName(model)} truly relates to {outcomeName(model) || 'your outcome'} at the strength below, and a single item of yours is this reliable:</p>
          <Slider label="True relation" min={0.1} max={0.9} step={0.05} value={yRho} onChange={setYRho} />
          <Slider label="One item's reliability" min={0.2} max={0.9} step={0.05} value={yRel} onChange={setYRel} />
          <p>With one item each you would observe <b>{fmt(attenuated(yRho, yRel, yRel))}</b>. With your {yourK} item{yourK === 1 ? '' : 's'} averaged: <b>{fmt(attenuated(yRho, spearmanBrown(yRel, yourK), spearmanBrown(yRel, yourK)))}</b>. A latent variable model aims at the full <b>{fmt(yRho)}</b>.</p>
          {items.length < 3 && <p className="verdict">Give {constructName(model)} at least three items in the studio — station 1.3 shows why three is the minimum.</p>}
        </Yours>
      </Beat>
    </article>
  );
}
