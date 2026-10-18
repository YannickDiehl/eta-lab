// Day 4 · the slide figures, made interactive (part 1): the observed item means per country,
// the invariance levels (worksheet Day 4), the baseline models per country and the item
// response lines — the "two rulers" — under the metric, scalar and partial models.
import { useState } from 'react';
import { f2, f3 } from '../day1/data.ts';
import { COUNTRY, GROUP_COLOR, type Day4 } from './data.ts';

const SHAPE = ['circle', 'square', 'diamond'] as const;
export function Marker({ x, y, g, r = 6 }: { x: number; y: number; g: number; r?: number }) {
  const s = SHAPE[g], c = GROUP_COLOR[g];
  if (s === 'circle') return <circle cx={x} cy={y} r={r} fill={c} stroke="var(--card)" strokeWidth="2" />;
  if (s === 'square') return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} rx="1.5" fill={c} stroke="var(--card)" strokeWidth="2" />;
  return <path d={`M${x} ${y - r - 1.5}L${x + r + 1.5} ${y}L${x} ${y + r + 1.5}L${x - r - 1.5} ${y}Z`} fill={c} stroke="var(--card)" strokeWidth="2" />;
}
export function GroupLegend({ groups }: { groups: string[] }) {
  return (
    <div className="g-legend">{groups.map((g, i) => (
      <span key={g}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><Marker x={8} y={8} g={i} r={5} /></svg>{COUNTRY[g]}</span>
    ))}</div>
  );
}

// ---------------------------------------------------------------- start: the observed means
export function ItemMeansByCountry({ d, labels }: { d: Day4; labels: Record<string, string> }) {
  const [hover, setHover] = useState<{ i: number; g: number } | null>({ i: 0, g: 2 });
  const W = 480, rowH = 46, X = (v: number) => 120 + ((v - 3.4) / 1.6) * (W - 150);
  return (
    <div className="fig">
      <GroupLegend groups={d.groups} />
      <svg viewBox={`0 0 ${W} ${d.items.length * rowH + 34}`} className="fig-svg" role="img" aria-label="Observed item means by country">
        {[3.5, 4, 4.5, 5].map(t => <g key={t}><line x1={X(t)} x2={X(t)} y1="6" y2={d.items.length * rowH + 6} className="h-grid" /><text x={X(t)} y={d.items.length * rowH + 24} className="f-lbl c sm">{t.toFixed(1)}</text></g>)}
        {d.items.map((it, i) => {
          const y = 26 + i * rowH, ms = d.desc.map(g => g.items[i].mean);
          return (
            <g key={it}>
              <text x="4" y={y + 4} className="f-lbl b">{it}</text>
              <line x1={X(Math.min(...ms))} x2={X(Math.max(...ms))} y1={y} y2={y} stroke="var(--grid)" strokeWidth="6" strokeLinecap="round" />
              {ms.map((m, g) => <g key={g} onMouseEnter={() => setHover({ i, g })} onClick={() => setHover({ i, g })} style={{ cursor: 'pointer' }}><circle cx={X(m)} cy={y} r="12" fill="transparent" /><Marker x={X(m)} y={y} g={g} /></g>)}
            </g>
          );
        })}
      </svg>
      {hover && (() => { const g = d.desc[hover.g], it = g.items[hover.i]; return (
        <p className="hint"><b>{COUNTRY[g.group]}</b>, <code>{it.item}</code> (“{labels[it.item]}”): mean {f2(it.mean)}, SD {f2(it.sd)}, {g.n.toLocaleString('en')} respondents.</p>
      ); })()}
      <p className="hint">1 = not like me at all … 6 = very much like me. The Dutch are lowest on <code>ipmodst</code> and <code>ipbhprp</code> but highest on <code>ipfrule</code>: do they value tradition and conformity less — or more? The raw means cannot say. They mix the people with the items.</p>
    </div>
  );
}

// ---------------------------------------------------------------- the levels (worksheet Day 4)
type Lvl = 'configural' | 'metric' | 'scalar' | 'strict';
const LEVELS: { id: Lvl; implies: string; compare: string; assess: string }[] = [
  { id: 'configural', implies: 'The same items measure the same constructs across groups.', compare: 'None.', assess: 'An MGCFA with an acceptable fit to the data.' },
  { id: 'metric', implies: 'The same items have the same unstandardized factor loadings across groups (at least two equal loadings for partial metric invariance).', compare: 'Unstandardized associations: covariances, unstandardized regression coefficients with other variables or constructs.', assess: 'The fit does not deteriorate considerably compared with the configural model.' },
  { id: 'scalar', implies: 'The same items have the same unstandardized loadings and intercepts across groups (at least two items with equal loadings and intercepts for partial scalar invariance).', compare: 'Latent means — and the means of observed sum or mean scores, but only if every item in the score is invariant (full, not partial).', assess: 'The fit does not deteriorate considerably compared with the (full or partial) metric model.' },
  { id: 'strict', implies: 'In addition, the same residual (error) variances.', compare: 'Variances, correlations, reliabilities and standardized differences of observed sum scores.', assess: 'Rarely tested — and rarely needed when latent variables are compared.' },
];
const PARAMS: { key: string; sym: string; what: string; from: Lvl | null }[] = [
  { key: 'pattern', sym: 'pattern', what: 'which item loads on which factor', from: 'configural' },
  { key: 'lambda', sym: 'λ', what: 'factor loadings', from: 'metric' },
  { key: 'tau', sym: 'τ', what: 'item intercepts', from: 'scalar' },
  { key: 'theta', sym: 'θ', what: 'residual variances', from: 'strict' },
  { key: 'psi', sym: 'ψ', what: 'factor variances', from: null },
  { key: 'kappa', sym: 'κ', what: 'latent means', from: null },
];
const ORDER: Lvl[] = ['configural', 'metric', 'scalar', 'strict'];

export function LevelsGrid() {
  const [lvl, setLvl] = useState<Lvl>('metric');
  const L = LEVELS.find(l => l.id === lvl)!;
  const equal = (p: typeof PARAMS[number]) => p.from !== null && ORDER.indexOf(p.from) <= ORDER.indexOf(lvl);
  return (
    <div className="fig">
      <div className="seg wrap" role="group" aria-label="Invariance level">
        {ORDER.map(l => <button key={l} aria-pressed={lvl === l} onClick={() => setLvl(l)}>{l}</button>)}
      </div>
      <div className="fig-row">
        <table className="rp-table lvl-grid">
          <thead><tr><th>parameter</th><th>Belgium</th><th>Luxembourg</th><th>Netherlands</th></tr></thead>
          <tbody>{PARAMS.map(p => (
            <tr key={p.key}>
              <td><b>{p.sym}</b> <small>{p.what}</small></td>
              {equal(p) ? <td colSpan={3} className="lvl-eq">equal in all groups</td>
                : p.key === 'kappa' && ORDER.indexOf(lvl) < 2 ? <td colSpan={3} className="lvl-free">fixed to 0 in all groups — not comparable</td>
                : [0, 1, 2].map(g => <td key={g} className="lvl-free">{p.key === 'kappa' && g === 0 ? 'κᴮ = 0 (reference)' : `${p.sym}${'ᴮᴸᴺ'[g]} free`}</td>)}
            </tr>
          ))}</tbody>
        </table>
        <div className="fig-text">
          <p><b>What it implies:</b> {L.implies}</p>
          <p><b>Comparison allowed:</b> {L.compare}</p>
          <p className="hint"><b>How it is assessed:</b> {L.assess}</p>
        </div>
      </div>
      <p className="hint">Factor variances, covariances and latent means are not part of the measurement model: their equality is a substantive question (invariance of the structural model) — and the latent means are what we want to compare.</p>
    </div>
  );
}

// ---------------------------------------------------------------- step 1: the baseline models
export function BaselineLoadings({ d }: { d: Day4 }) {
  const [std, setStd] = useState(false);
  const items = d.items.slice(1);
  const W = 460, rowH = 54, max = std ? 1 : 1.8, X = (v: number) => 110 + (v / max) * (W - 140);
  return (
    <div className="fig">
      <div className="fig-row">
        <div>
          <div className="seg" role="group" aria-label="Loadings">
            <button aria-pressed={!std} onClick={() => setStd(false)}>unstandardized ± 1.96 SE</button>
            <button aria-pressed={std} onClick={() => setStd(true)}>standardized</button>
          </div>
          <GroupLegend groups={d.groups} />
          <svg viewBox={`0 0 ${W} ${items.length * rowH + 30}`} className="fig-svg" role="img" aria-label="Factor loadings in each country">
            {(std ? [0, 0.5, 1] : [0, 0.5, 1, 1.5]).map(t => <g key={t}><line x1={X(t)} x2={X(t)} y1="4" y2={items.length * rowH} className="h-grid" /><text x={X(t)} y={items.length * rowH + 18} className="f-lbl c sm">{t}</text></g>)}
            {items.map((it, i) => (
              <g key={it}>
                <text x="4" y={20 + i * rowH + 14} className="f-lbl b">{it}</text>
                {d.baseline.map((b, g) => {
                  const l = b.estimates.find(e => e.op === '=~' && e.rhs === it)!, y = 14 + i * rowH + g * 14;
                  const v = std ? l.std : l.est;
                  return <g key={b.group}>{!std && <line x1={X(l.est - 1.96 * l.se)} x2={X(l.est + 1.96 * l.se)} y1={y} y2={y} stroke={GROUP_COLOR[g]} strokeWidth="2.5" strokeLinecap="round" />}<Marker x={X(v)} y={y} g={g} r={5} /></g>;
                })}
              </g>
            ))}
          </svg>
        </div>
        <table className="rp-table">
          <thead><tr><th></th><th>χ² (df)</th><th>CFI</th><th>RMSEA</th><th>SRMR</th></tr></thead>
          <tbody>{d.baseline.map(b => <tr key={b.group}><td>{COUNTRY[b.group]}<br /><small>n = {b.n.toLocaleString('en')}</small></td><td>{b.fit['chisq.scaled'].toFixed(2)} ({b.fit.df})</td><td>{f3(b.fit['cfi.robust'])}</td><td>{f3(b.fit['rmsea.robust'])}</td><td>{f3(b.fit.srmr)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="hint">The loading of <code>ipmodst</code> is fixed to 1 in every country (reference indicator). Overlapping intervals are a first impression of metric invariance — no test yet: the baseline models have no between-group constraints. Compare the <b>unstandardized</b> loadings: standardized loadings differ between countries even when only the factor or error variances differ.</p>
    </div>
  );
}
