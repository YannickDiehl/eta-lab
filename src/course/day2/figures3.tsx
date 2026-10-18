// Day 2 · latent correlation against sum scores, in people (part 3): respondents simulated
// from the estimated two-factor model. Left their two latent values, right the sum scores of
// the same people. The items' measurement error stays in the sums and widens the cloud — the
// attenuation. No real answers leave R: the people are drawn from the estimates.
import { useMemo, useState } from 'react';
import { useTween } from '../../components/useTween.ts';
import { correlation, normals, rng } from '../../math/stats.ts';
import { f2 } from '../day1/data.ts';
import { est, FACTORS, factorCor, type Day2 } from './data.ts';

const N = 300;

export function LatentVsSumCloud({ d }: { d: Day2 }) {
  const [k, setK] = useState(1);
  const [boxes, setBoxes] = useState(false);
  const e = d.mlr.estimates;
  const psiT = est(e, 'TRCO', '~~', 'TRCO')!.est, psiU = est(e, 'UNIV', '~~', 'UNIV')!.est, phi = est(e, 'TRCO', '~~', 'UNIV')!.est;
  const lam = (it: string) => est(e, (FACTORS.TRCO as readonly string[]).includes(it) ? 'TRCO' : 'UNIV', '=~', it)!.est;
  const theta = (it: string) => est(e, it, '~~', it)!.est;
  const means = Object.fromEntries(d.frq.map(f => { const n = f.counts.reduce((a, b) => a + b, 0); return [f.item, f.counts.reduce((a, c, i) => a + c * (i + 1), 0) / n]; }));
  const draws = useMemo(() => { const u = rng(77); return { z1: normals(u, N), z2: normals(u, N), err: d.items.map(() => normals(u, N)) }; }, [d.items]);
  const [kk] = useTween([k]);
  const sim = useMemo(() => {
    const sdT = Math.sqrt(psiT), b = phi / sdT, sdRest = Math.sqrt(Math.max(psiU - b * b, 0.0001));
    const etaT = draws.z1.map(z => sdT * z), etaU = draws.z1.map((z, i) => b * z + sdRest * draws.z2[i]);
    const ans = d.items.map((it, j) => draws.err[j].map((ez, i) => {
      const eta = (FACTORS.TRCO as readonly string[]).includes(it) ? etaT[i] : etaU[i];
      const y = means[it] + lam(it) * eta + Math.sqrt(theta(it) * kk) * ez;
      return boxes ? Math.min(6, Math.max(1, Math.round(y))) : y;
    }));
    const sum = (f: 'TRCO' | 'UNIV') => draws.z1.map((_, i) => FACTORS[f].reduce((a, it) => a + ans[d.items.indexOf(it)][i], 0));
    const sT = sum('TRCO'), sU = sum('UNIV');
    return { etaT, etaU, sT, sU, rLat: correlation(etaT, etaU), rSum: correlation(sT, sU) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draws, kk, boxes]);
  const panel = (xs: number[], ys: number[], title: string, xl: string, yl: string, r: number, cls: string) => {
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const sx = Math.sqrt(xs.reduce((a, v) => a + (v - mx) ** 2, 0) / xs.length), sy = Math.sqrt(ys.reduce((a, v) => a + (v - my) ** 2, 0) / ys.length);
    const S = 220, P = 24, sc = (v: number, m: number, s: number) => P + ((Math.max(-3, Math.min(3, (v - m) / s)) + 3) / 6) * (S - P - 8);
    return (
      <figure className="lvs-panel">
        <figcaption><b>{title}</b> · r = {f2(r)}</figcaption>
        <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label={`${title}: correlation ${f2(r)}`}>
          <rect x={P} y="8" width={S - P - 8} height={S - P - 8} className="f-plot" />
          {xs.map((x, i) => <circle key={i} cx={sc(x, mx, sx)} cy={S - sc(ys[i], my, sy)} r="2" className={cls} />)}
          <line x1={sc(mx - 3 * sx, mx, sx)} y1={S - sc(my - 3 * sy * r, my, sy)} x2={sc(mx + 3 * sx, mx, sx)} y2={S - sc(my + 3 * sy * r, my, sy)} className="lc-line" />
          <text x={(S + P) / 2} y={S - 4} className="f-lbl c sm">{xl}</text>
          <text x="10" y={S / 2} className="f-lbl c sm" transform={`rotate(-90 10 ${S / 2})`}>{yl}</text>
        </svg>
      </figure>
    );
  };
  return (
    <div className="fig">
      <label className="chk"><input type="checkbox" checked={boxes} onChange={ev => setBoxes(ev.target.checked)} /> answers in the six boxes</label>
      <div className="lvs-row">
        {panel(sim.etaT, sim.etaU, 'The factors', 'TRCO (latent)', 'UNIV (latent)', sim.rLat, 'lc-dot')}
        {panel(sim.sT, sim.sU, 'The sum scores', 'TRCO sum of 4 items', 'UNIV sum of 3 items', sim.rSum, 'lc-dot warm')}
      </div>
      <label className="ctl"><span>Error × </span><input type="range" min={0} max={2} step={0.05} value={k} onChange={ev => setK(+ev.target.value)} /><output>{k.toFixed(2)}</output></label>
      <p>The same {N} people in both panels. On the left their latent values: the clouds of the two values correlate at {f2(sim.rLat)} (the model: {f2(factorCor(e))}). On the right their sum scores: every item adds its own measurement error, so the cloud widens and the correlation drops to {f2(sim.rSum)}.</p>
      <p className="hint"><b>Try it:</b> set the error to 0 — the sum scores now correlate almost like the factors. Double it — they drift further apart. The factor correlation does not move: the CFA separates the error from the construct. (A what-if: the estimates are at × 1.)</p>
      <p className="hint"><b>Simulated</b> from the estimates of the two-factor model: {N} people, η ~ N(0, Φ), each answer = item mean + λη + ε. No real respondent leaves R.</p>
    </div>
  );
}
