// Day 4 · what invariance does, to look at and to touch (part 3):
//  · InvarianceExplorer — the slide figure (Y over η, one line per group, τ, λ, κ, E) as a
//    schematic with sliders; the levels lock λ and τ and the lines move into line;
//  · ItemLines — the same picture with the Benelux estimates, animated, with each country's
//    latent distribution on the η axis and the gap between expected and observed item means;
//  · PointCloud — people instead of lines: respondents simulated from the estimated model
//    (no real answers leave R), so one can see the clouds shift when the intercepts are set equal.
import { useMemo, useState } from 'react';
import { useTween } from '../../components/useTween.ts';
import { normals, rng } from '../../math/stats.ts';
import { f2 } from '../day1/data.ts';
import { GROUP_COLOR, interceptOf, loadingOf, meanOf, pe, type Day4, type ModelKey } from './data.ts';
import { GroupLegend, Marker } from './figures1.tsx';

// ---------------------------------------------------------------- 1a · the slide figure, schematic
type Lvl = 'configural' | 'metric' | 'scalar';
const G1 = { lam: 1.0, tau: 1.2, kap: 1.1 };
const ALLOW: Record<Lvl, string> = {
  configural: 'Nothing can be compared yet: each group has its own slope and its own starting point — two different rulers.',
  metric: 'The slopes are equal: one unit of η means the same change in the answer in both groups. Relations — covariances, regression slopes — can be compared. The lines are parallel, but a gap between them remains: the means cannot be compared yet.',
  scalar: 'Slopes and intercepts are equal: one line for both groups. Now a difference in the expected answer E can only come from a difference in the latent mean κ — the latent means can be compared.',
};

export function InvarianceExplorer() {
  const [lvl, setLvl] = useState<Lvl>('configural');
  const [g2, setG2] = useState({ lam: 1.45, tau: 1.9, kap: 1.75 });
  const metricOn = lvl !== 'configural', scalarOn = lvl === 'scalar';
  const lam2 = metricOn ? G1.lam : g2.lam, tau2 = scalarOn ? G1.tau : g2.tau;
  const [l1, t1, k1, l2, t2, k2] = useTween([G1.lam, G1.tau, G1.kap, lam2, tau2, g2.kap]);
  const W = 470, H = 330, X = (eta: number) => 60 + (eta / 3) * (W - 120), Y = (y: number) => H - 40 - (y / 6.4) * (H - 70);
  const groups = [{ l: l1, t: t1, k: k1, c: GROUP_COLOR[0], n: 'g1' }, { l: l2, t: t2, k: k2, c: GROUP_COLOR[2], n: 'g2' }];
  const slider = (key: 'lam' | 'tau' | 'kap', label: string, min: number, max: number, locked: boolean, lockedTo: number) => (
    <label className={`ctl ${locked ? 'locked' : ''}`}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={0.05} value={locked ? lockedTo : g2[key]} disabled={locked} onChange={e => setG2(v => ({ ...v, [key]: +e.target.value }))} />
      <output>{(locked ? lockedTo : g2[key]).toFixed(2)}{locked ? ' 🔒' : ''}</output>
    </label>
  );
  return (
    <div className="fig inv-explorer">
      <div className="seg" role="group" aria-label="Level of invariance">
        {(['configural', 'metric', 'scalar'] as const).map(l => <button key={l} aria-pressed={lvl === l} onClick={() => setLvl(l)}>{l}</button>)}
      </div>
      <InvariancePaths lvl={lvl} />
      <div className="fig-row">
        <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label={`Expected answer Y over the latent variable η for two groups, ${lvl} invariance`}>
          <defs><marker id="ie-ax" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--ink)" /></marker></defs>
          <line x1={X(0)} y1={Y(0)} x2={X(3) + 14} y2={Y(0)} className="f-arr" markerEnd="url(#ie-ax)" />
          <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(6.4)} className="f-arr" markerEnd="url(#ie-ax)" />
          <text x={X(3) + 8} y={Y(0) + 26} className="f-sym sm">η</text>
          <text x={X(0) - 8} y={Y(6.4) + 4} className="f-sym sm" textAnchor="end">Y</text>
          {groups.map((g, i) => {
            const E = g.t + g.l * g.k;
            return (
              <g key={i}>
                <line x1={X(0)} y1={Y(g.t)} x2={X(3)} y2={Y(g.t + g.l * 3)} stroke={g.c} strokeWidth={scalarOn ? 5 - 2 * i : 2.6} strokeOpacity={scalarOn ? 0.8 : 1} />
                <text x={X(3) + 4} y={Y(g.t + g.l * 3) + 4 + (scalarOn ? (i ? 10 : -6) : 0)} className="f-lbl b" style={{ fill: g.c }}>λ<tspan baselineShift="sub" fontSize="9">{g.n}</tspan></text>
                <line x1={X(g.k)} y1={Y(0)} x2={X(g.k)} y2={Y(E)} stroke={g.c} strokeDasharray="4 4" />
                <line x1={X(0)} y1={Y(E)} x2={X(g.k)} y2={Y(E)} stroke={g.c} strokeDasharray="4 4" />
                <Marker x={X(g.k)} y={Y(E)} g={i === 0 ? 0 : 2} />
                <text x={X(g.k)} y={Y(0) + 16 + i * 13} className="f-lbl c b" style={{ fill: g.c }}>κ<tspan baselineShift="sub" fontSize="9">{g.n}</tspan></text>
                <text x={X(0) - 6} y={Y(E) + 4} className="f-lbl b" textAnchor="end" style={{ fill: g.c }}>E<tspan baselineShift="sub" fontSize="9">{g.n}</tspan></text>
                <text x={X(0) - 6} y={Y(g.t) + 4 + (scalarOn ? (i ? 8 : -4) : 0)} className="f-lbl" textAnchor="end" style={{ fill: g.c }}>τ<tspan baselineShift="sub" fontSize="9">{g.n}</tspan></text>
              </g>
            );
          })}
          {metricOn && <text x={W - 16} y={36} className="inv-eq lam" textAnchor="end">λ<tspan baselineShift="sub" fontSize="10">g1</tspan> = λ<tspan baselineShift="sub" fontSize="10">g2</tspan></text>}
          {scalarOn && <text x={W - 16} y={58} className="inv-eq tau" textAnchor="end">τ<tspan baselineShift="sub" fontSize="10">g1</tspan> = τ<tspan baselineShift="sub" fontSize="10">g2</tspan></text>}
        </svg>
        <div className="fig-text">
          <p className="hint" style={{ marginTop: 0 }}><b>Group 1</b> is fixed. Move the sliders of <b>group 2</b>, then switch the level: what the level sets equal locks 🔒 and moves into line.</p>
          {slider('lam', 'slope λ', 0.4, 2, metricOn, G1.lam)}
          {slider('tau', 'intercept τ', 0.2, 3, scalarOn, G1.tau)}
          {slider('kap', 'latent mean κ', 0.2, 2.8, false, 0)}
          <p className="inv-allow">{ALLOW[lvl]}</p>
          <p className="hint">E = τ + λ·κ: the expected answer of the group’s average person — the dashed lines, as in the original slide figure. Group 2’s E is {f2(t2 + l2 * k2)}, group 1’s {f2(t1 + l1 * k1)}.</p>
        </div>
      </div>
    </div>
  );
}

/** The two path diagrams of the slide figure; the boxes light up as the level sets them equal. */
function InvariancePaths({ lvl }: { lvl: Lvl }) {
  const lam = lvl !== 'configural', tau = lvl === 'scalar';
  const one = (x0: number, g: string) => (
    <g transform={`translate(${x0} 0)`}>
      <text x="80" y="14" className="f-lbl c b">Group {g}</text>
      <ellipse cx="34" cy="62" rx="26" ry="16" className="f-lat" />
      <text x="34" y="67" className="f-sym sm">η</text>
      {[30, 62, 94].map((y, i) => (
        <g key={y}>
          <line x1="60" y1="62" x2="104" y2={y} className="f-arr" />
          <rect x="106" y={y - 11} width="30" height="22" rx="3" className="f-obs" />
          <text x="121" y={y + 4} className="f-lbl c sm">y{'₁₂₃'[i]}</text>
        </g>
      ))}
      <rect x="64" y="22" width="36" height="80" rx="4" className={`inv-box lam ${lam ? 'on' : ''}`} />
      <rect x="138" y="20" width="16" height="84" rx="4" className={`inv-box tau ${tau ? 'on' : ''}`} />
      <text x="82" y="116" className="f-lbl c sm">λ</text>
      <text x="146" y="116" className="f-lbl c sm">τ</text>
    </g>
  );
  return (
    <svg viewBox="0 0 400 124" className="inv-paths" role="img" aria-label={`Two groups: loadings ${lam ? 'set equal' : 'free'}, intercepts ${tau ? 'set equal' : 'free'}`}>
      {one(10, '1')}
      {one(220, '2')}
      <text x="200" y="58" className={`inv-eq lam ${lam ? '' : 'off'}`} textAnchor="middle">=</text>
      <text x="200" y="84" className={`inv-eq tau ${tau ? '' : 'off'}`} textAnchor="middle">=</text>
    </svg>
  );
}

// ---------------------------------------------------------------- 1b · the Benelux item lines, animated
const LINE_MODELS: { id: ModelKey; label: string }[] = [
  { id: 'config', label: 'configural' }, { id: 'metric', label: 'metric' }, { id: 'scalar', label: 'scalar' },
  { id: 'partial', label: 'rules free' }, { id: 'partial3', label: 'rules + modest free' },
];
const phi = (z: number) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
const factorVar = (d: Day4, m: ModelKey, g: number) => pe(d.estimates[m], '~~', 'TRCO', 'TRCO', g)?.est ?? 0.3;
const errorVar = (d: Day4, m: ModelKey, item: string, g: number) => pe(d.estimates[m], '~~', item, item, g)?.est ?? 0.8;

export function ItemLines({ d, labels, initial = 'metric', item0 = 'ipfrule', models = ['config', 'metric', 'scalar'] }: {
  d: Day4; labels: Record<string, string>; initial?: ModelKey; item0?: string; models?: ModelKey[];
}) {
  const [m, setM] = useState<ModelKey>(initial);
  const [item, setItem] = useState(item0);
  const e = d.estimates[m];
  const target = d.groups.flatMap((_, g) => [interceptOf(e, item, g + 1).est, loadingOf(e, item, g + 1).est, meanOf(e, g + 1), factorVar(d, m, g + 1)]);
  const v = useTween(target);
  const lines = d.groups.map((_, g) => ({ tau: v[g * 4], lam: v[g * 4 + 1], kappa: v[g * 4 + 2], psi: v[g * 4 + 3] }));
  const obs = d.desc.map(g => g.items.find(x => x.item === item)!.mean);
  const W = 470, H = 290, E0 = 1.2, X = (eta: number) => 56 + ((eta + E0) / (2 * E0)) * (W - 90), Y = (y: number) => H - 70 - ((y - 2.4) / 3.4) * (H - 100);
  const base = H - 40;
  const freedHere = (m === 'partial' && item === 'ipfrule') || (m === 'partial3' && (item === 'ipfrule' || item === 'ipmodst'));
  const note = m === 'config'
    ? 'Configural: each country has its own slope and intercept, and its own scale — the latent means are all 0 and say nothing.'
    : m === 'metric'
      ? 'Metric: equal loadings, parallel lines. The latent means are still fixed to 0, so every difference in the item means sits in the intercepts — the item, not the people.'
      : m === 'scalar'
        ? 'Scalar: equal loadings and intercepts, one line for all. Now the differences must come from the people: the bells move along η. One κ per country has to serve all four items at once.'
        : freedHere ? 'This item’s intercept is released: its line jumps back to the country’s own height. It no longer links the countries.' : 'This item is an anchor: its line is shared, and it carries the comparison of the latent means.';
  return (
    <div className="fig">
      <div className="seg wrap" role="group" aria-label="Model">{LINE_MODELS.filter(x => models.includes(x.id)).map(x => <button key={x.id} aria-pressed={m === x.id} onClick={() => setM(x.id)}>{x.label}</button>)}</div>
      <div className="seg wrap" role="group" aria-label="Item" style={{ marginLeft: 8 }}>{d.items.map(it => <button key={it} aria-pressed={item === it} onClick={() => setItem(it)}>{it}</button>)}</div>
      <GroupLegend groups={d.groups} />
      <div className="fig-row">
        <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label={`Expected answer to ${item} by tradition/conformity, per country, ${m} model`}>
          <rect x="56" y="22" width={W - 90} height={H - 92} className="f-plot" />
          {[3, 4, 5].map(t => <g key={t}><line x1="56" x2={W - 34} y1={Y(t)} y2={Y(t)} className="h-grid" /><text x="50" y={Y(t) + 4} className="f-lbl sm" textAnchor="end">{t}</text></g>)}
          <line x1={X(0)} x2={X(0)} y1="22" y2={base} className="h-grid" />
          {lines.map((l, g) => {
            const sd = Math.sqrt(Math.max(l.psi, 0.01));
            const bell = Array.from({ length: 41 }, (_, i) => { const z = -2.5 + i * 0.125, x = l.kappa + z * sd; return `${i ? 'L' : 'M'}${X(Math.max(-E0, Math.min(E0, x))).toFixed(1)} ${(base - phi(z) * 46).toFixed(1)}`; }).join(' ');
            const Ey = l.tau + l.lam * l.kappa;
            const gap = obs[g] - Ey;
            return (
              <g key={g}>
                <path d={`${bell} L${X(Math.min(E0, l.kappa + 2.5 * sd)).toFixed(1)} ${base} L${X(Math.max(-E0, l.kappa - 2.5 * sd)).toFixed(1)} ${base} Z`} fill={GROUP_COLOR[g]} fillOpacity={0.12} stroke={GROUP_COLOR[g]} strokeWidth="1.4" />
                <line x1={X(-E0)} x2={X(E0)} y1={Y(l.tau - l.lam * E0)} y2={Y(l.tau + l.lam * E0)} stroke={GROUP_COLOR[g]} strokeWidth={m === 'scalar' ? 6 - 2 * g : 2.6} strokeOpacity={m === 'scalar' ? 0.75 : 1} />
                <line x1={X(l.kappa)} x2={X(l.kappa)} y1={base} y2={Y(Ey)} stroke={GROUP_COLOR[g]} strokeDasharray="3 3" />
                <line x1="56" x2={X(l.kappa)} y1={Y(Ey)} y2={Y(Ey)} stroke={GROUP_COLOR[g]} strokeDasharray="3 3" strokeOpacity="0.6" />
                {Math.abs(gap) > 0.06 && <line x1={X(l.kappa) + (g - 1) * 3} x2={X(l.kappa) + (g - 1) * 3} y1={Y(Ey)} y2={Y(obs[g])} stroke="var(--neg)" strokeWidth="2.4" />}
                <circle cx={X(l.kappa) + (g - 1) * 3} cy={Y(obs[g])} r="7" fill="none" stroke={GROUP_COLOR[g]} strokeWidth="2.2" />
                <Marker x={X(l.kappa)} y={Y(Ey)} g={g} />
                <text x={W - 30} y={Y(l.tau + l.lam * E0) + 4 + (m === 'scalar' ? (g - 1) * 12 : 0)} className="f-lbl sm b" style={{ fill: GROUP_COLOR[g] }}>{d.groups[g]}</text>
              </g>
            );
          })}
          <text x={W / 2} y={H - 8} className="f-lbl c sm">TRCO (η) in units of ipmodst · bells: each country’s people</text>
        </svg>
        <div className="fig-text">
          <p><b>{item}</b> — “{labels[item]}”</p>
          <table className="rp-table il-tab">
            <thead><tr><th>country</th><th>τ</th><th>λ</th><th>κ</th><th>expected</th><th>observed</th></tr></thead>
            <tbody>{d.groups.map((c, g) => {
              const t = target[g * 4], l = target[g * 4 + 1], k = target[g * 4 + 2];
              return <tr key={c}><td style={{ color: GROUP_COLOR[g], fontWeight: 800 }}>{c}</td><td>{t.toFixed(2)}</td><td>{l.toFixed(2)}</td><td>{k === 0 ? '0' : k.toFixed(2)}</td><td>{(t + l * k).toFixed(2)}</td><td>{obs[g].toFixed(2)}</td></tr>;
            })}</tbody>
          </table>
          <p className="hint">{note}</p>
        </div>
      </div>
      <p className="hint">Filled marker: the expected answer E = τ + λ·κ of a country’s average person. Ring: the observed item mean. A red bar marks the gap the model cannot close — the strain the χ² test sees.</p>
    </div>
  );
}

// ---------------------------------------------------------------- 2 · people instead of lines
const N_PER = 140;
const CLOUD_MODELS: { id: ModelKey; label: string }[] = [
  { id: 'config', label: 'configural' }, { id: 'metric', label: 'metric' }, { id: 'scalar', label: 'scalar' }, { id: 'partial3', label: 'rules + modest free' },
];
export function PointCloud({ d, labels }: { d: Day4; labels: Record<string, string> }) {
  const [m, setM] = useState<ModelKey>('metric');
  const [item, setItem] = useState('ipmodst');
  const [boxes, setBoxes] = useState(false);
  const draws = useMemo(() => d.groups.map((_, g) => { const u = rng(101 + g * 17); return { z: normals(u, N_PER), e: normals(u, N_PER), j: Array.from({ length: N_PER }, () => u() - 0.5) }; }), [d.groups]);
  const e = d.estimates[m];
  const target = d.groups.flatMap((_, g) => [interceptOf(e, item, g + 1).est, loadingOf(e, item, g + 1).est, meanOf(e, g + 1), factorVar(d, m, g + 1), errorVar(d, m, item, g + 1)]);
  const v = useTween(target, 650);
  const obs = d.desc.map(g => g.items.find(x => x.item === item)!.mean);
  const W = 470, H = 320, E0 = 1.6, X = (eta: number) => 50 + ((Math.max(-E0, Math.min(E0, eta)) + E0) / (2 * E0)) * (W - 70), Y = (y: number) => H - 34 - ((Math.max(0.4, Math.min(6.6, y)) - 0.4) / 6.2) * (H - 56);
  return (
    <div className="fig">
      <div className="seg wrap" role="group" aria-label="Model">{CLOUD_MODELS.map(x => <button key={x.id} aria-pressed={m === x.id} onClick={() => setM(x.id)}>{x.label}</button>)}</div>
      <div className="seg wrap" role="group" aria-label="Item" style={{ marginLeft: 8 }}>{d.items.map(it => <button key={it} aria-pressed={item === it} onClick={() => setItem(it)}>{it}</button>)}</div>
      <label className="chk" style={{ marginLeft: 8 }}><input type="checkbox" checked={boxes} onChange={ev => setBoxes(ev.target.checked)} /> answers in the six boxes</label>
      <GroupLegend groups={d.groups} />
      <div className="fig-row">
        <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label={`Simulated respondents: latent value against the answer to ${item}, per country, ${m} model`}>
          <rect x="50" y="18" width={W - 70} height={H - 52} className="f-plot" />
          {[1, 2, 3, 4, 5, 6].map(t => <g key={t}><line x1="50" x2={W - 20} y1={Y(t)} y2={Y(t)} className="h-grid" /><text x="44" y={Y(t) + 4} className="f-lbl sm" textAnchor="end">{t}</text></g>)}
          <line x1={X(0)} x2={X(0)} y1="18" y2={H - 34} className="h-grid" />
          {draws.map((dr, g) => {
            const [tau, lam, kap, psi, theta] = v.slice(g * 5, g * 5 + 5);
            const sd = Math.sqrt(Math.max(psi, 0.01)), se = Math.sqrt(Math.max(theta, 0.01));
            return (
              <g key={g}>
                {dr.z.map((z, i) => {
                  const eta = kap + sd * z;
                  let y = tau + lam * eta + se * dr.e[i];
                  if (boxes) y = Math.min(6, Math.max(1, Math.round(y))) + dr.j[i] * 0.5;
                  return <circle key={i} cx={X(eta)} cy={Y(y)} r="2" fill={GROUP_COLOR[g]} fillOpacity="0.28" />;
                })}
              </g>
            );
          })}
          {draws.map((_, g) => {
            const [tau, lam, kap, psi, theta] = v.slice(g * 5, g * 5 + 5);
            // the 1.5-SD ellipse of the country's cloud: cov(η, y) = λψ, var(y) = λ²ψ + θ
            const sdE = Math.sqrt(Math.max(psi, 0.01)), c21 = (lam * psi) / sdE, c22 = Math.sqrt(Math.max(lam * lam * psi + theta - c21 * c21, 0.001));
            const my = tau + lam * kap;
            const ell = Array.from({ length: 49 }, (_, i) => { const t = (i / 48) * 2 * Math.PI, a = Math.cos(t) * 1.5, b = Math.sin(t) * 1.5; return `${i ? 'L' : 'M'}${X(kap + sdE * a).toFixed(1)} ${Y(my + c21 * a + c22 * b).toFixed(1)}`; }).join(' ');
            const gap = obs[g] - my;
            return (
              <g key={`l${g}`}>
                <path d={ell} fill="none" stroke={GROUP_COLOR[g]} strokeWidth="2" strokeDasharray="6 3" />
                <line x1={X(-E0)} x2={X(E0)} y1={Y(tau - lam * E0)} y2={Y(tau + lam * E0)} stroke={GROUP_COLOR[g]} strokeWidth={m === 'scalar' ? 6 - 2 * g : 2.6} strokeOpacity={m === 'scalar' ? 0.8 : 1} />
                <line x1={X(kap)} x2={X(kap)} y1={H - 34} y2={Y(my)} stroke={GROUP_COLOR[g]} strokeDasharray="3 3" />
                {Math.abs(gap) > 0.06 && <line x1={X(kap) + (g - 1) * 4} x2={X(kap) + (g - 1) * 4} y1={Y(my)} y2={Y(obs[g])} stroke="var(--neg)" strokeWidth="2.6" />}
                <circle cx={X(kap) + (g - 1) * 4} cy={Y(obs[g])} r="7.5" fill="var(--card)" fillOpacity="0.6" stroke={GROUP_COLOR[g]} strokeWidth="2.4" />
                <Marker x={X(kap)} y={Y(my)} g={g} r={7} />
              </g>
            );
          })}
          <text x={W / 2 + 10} y={H - 8} className="f-lbl c sm">latent value η (units of ipmodst)</text>
        </svg>
        <div className="fig-text">
          <p><b>{item}</b> — “{labels[item]}”</p>
          <p>Each dot is a person: their latent value η on the x-axis, their answer on the y-axis. The dashed ellipse holds most of a country’s people; the line is τ + λη; the filled marker is the average person (κ, E). The ring is the <b>real</b> item mean of the country — a red bar shows what the model cannot reach.</p>
          <p className="hint">{m === 'config' || m === 'metric'
            ? 'The three clouds sit on top of each other at η = 0: before scalar invariance every country’s latent mean is fixed to 0. Any difference in the answers is put into the lines — the intercepts.'
            : m === 'scalar'
              ? 'One line for all — so the clouds have to move: along η, by the latent means. The Dutch ellipse slides to the left. But one shift has to serve all four items: for ipmodst the real Dutch answers lie below the line, for ipfrule above it — the red bars. That is the misfit of the scalar model.'
              : 'With rules and modest released, those two items get their own lines again; the other two anchor the shift of the clouds.'}</p>
          <p className="hint"><b>Simulated</b> from the estimates: {N_PER} people per country, drawn from the fitted model of each country (η ~ N(κ, ψ), answer = τ + λη + ε). No real respondent leaves R.</p>
        </div>
      </div>
    </div>
  );
}
