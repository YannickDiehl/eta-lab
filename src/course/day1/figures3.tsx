// Day 1 · the factor model in people (part 3): respondents simulated from the estimated
// one-factor model — their latent value η against their answer to one item. The slope of the
// line is the loading λ, the spread around it the error variance θ; together they give the
// standardized loading. No real answers leave R: the people are drawn from the estimates.
import { useMemo, useState } from 'react';
import { normals, rng } from '../../math/stats.ts';
import { useTween } from '../../components/useTween.ts';
import { f2, factorVar, loading, residualVar, type ItemSet } from './data.ts';

const N = 300;

export function LoadingCloud({ s, labels }: { s: ItemSet; labels: Record<string, string> }) {
  const [item, setItem] = useState(s.items[1]);
  const [k, setK] = useState(1);
  const [boxes, setBoxes] = useState(false);
  const draws = useMemo(() => { const u = rng(2024); return { z: normals(u, N), e: normals(u, N), j: Array.from({ length: N }, () => u() - 0.5) }; }, []);
  const lamE = loading(s).find(l => l.rhs === item)!, psi = factorVar(s)!.est, theta = residualVar(s, item)!.est;
  const tau = s.means.find(m => m.lhs === item)?.est ?? 4;
  const [lam, th] = useTween([lamE.est, theta * k]);
  const sdE = Math.sqrt(psi), sdErr = Math.sqrt(Math.max(th, 0.001));
  const std = (lam * sdE) / Math.sqrt(lam * lam * psi + th);
  const W = 470, H = 320, E0 = 1.8, X = (eta: number) => 50 + ((Math.max(-E0, Math.min(E0, eta)) + E0) / (2 * E0)) * (W - 70), Y = (y: number) => H - 34 - ((Math.max(0.4, Math.min(6.6, y)) - 0.4) / 6.2) * (H - 56);
  const band = (sign: number) => `${X(-E0)},${Y(tau - lam * E0 + sign * sdErr)} ${X(E0)},${Y(tau + lam * E0 + sign * sdErr)}`;
  return (
    <div className="fig">
      <div className="seg wrap" role="group" aria-label="Item">{s.items.map(it => <button key={it} aria-pressed={item === it} onClick={() => setItem(it)}>{it}</button>)}</div>
      <label className="chk" style={{ marginLeft: 8 }}><input type="checkbox" checked={boxes} onChange={e => setBoxes(e.target.checked)} /> answers in the six boxes</label>
      <div className="fig-row">
        <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label={`Simulated respondents: latent value against the answer to ${item}; loading ${f2(lam)}, standardized ${f2(std)}`}>
          <rect x="50" y="18" width={W - 70} height={H - 52} className="f-plot" />
          {[1, 2, 3, 4, 5, 6].map(t => <g key={t}><line x1="50" x2={W - 20} y1={Y(t)} y2={Y(t)} className="h-grid" /><text x="44" y={Y(t) + 4} className="f-lbl sm" textAnchor="end">{t}</text></g>)}
          <polygon points={`${band(1)} ${band(-1).split(' ').reverse().join(' ')}`} className="lc-band" />
          {draws.z.map((z, i) => {
            const eta = sdE * z;
            let y = tau + lam * eta + sdErr * draws.e[i];
            if (boxes) y = Math.min(6, Math.max(1, Math.round(y))) + draws.j[i] * 0.5;
            return <circle key={i} cx={X(eta)} cy={Y(y)} r="2.2" className="lc-dot" />;
          })}
          <line x1={X(-E0)} x2={X(E0)} y1={Y(tau - lam * E0)} y2={Y(tau + lam * E0)} className="lc-line" />
          {/* the slope triangle: one unit more of η → λ more on the item */}
          <polyline points={`${X(0.3)},${Y(tau + lam * 0.3)} ${X(1.3)},${Y(tau + lam * 0.3)} ${X(1.3)},${Y(tau + lam * 1.3)}`} className="lc-tri" />
          <text x={X(0.8)} y={Y(tau + lam * 0.3) + 16} className="f-lbl c sm b">1 unit of η</text>
          <text x={X(1.3) + 6} y={Y(tau + lam * 0.8) + 4} className="f-lbl sm b">λ = {f2(lam)}</text>
          <text x={W / 2 + 10} y={H - 8} className="f-lbl c sm">latent value η (units of ipmodst)</text>
        </svg>
        <div className="fig-text">
          <p><b>{item}</b> — “{labels[item]}”</p>
          <p>Each dot is a person: their latent value η on the x-axis, their answer on the y-axis.</p>
          <ul>
            <li>The <b>slope</b> of the line is the loading: one unit more of η, {f2(lam)} points more on the item.</li>
            <li>The <b>spread</b> around the line — the shaded band, ± one SD — is the measurement error: θ = {f2(th)}.</li>
            <li>Together: the <b>standardized loading</b> = {f2(std)} — how closely the answers follow the factor.</li>
          </ul>
          <label className="ctl"><span>Error × </span><input type="range" min={0.2} max={2} step={0.05} value={k} onChange={e => setK(+e.target.value)} /><output>{k.toFixed(2)}</output></label>
          <p className="hint"><b>Try it:</b> make the error smaller, then larger. The slope stays; the cloud tightens or widens, and the standardized loading rises or falls. (A what-if: the estimate is θ = {f2(theta)}.)</p>
        </div>
      </div>
      <p className="hint"><b>Simulated</b> from the estimates of step 5: {N} people drawn from the fitted model (η ~ N(0, ψ), answer = τ + λη + ε). No real respondent leaves R.</p>
    </div>
  );
}
