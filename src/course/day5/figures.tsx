// Day 5 · the interactive figures: the mean equation (draw intercepts and slopes), the countries'
// means under four strategies, the modification cascade and its replication, the second-order
// factor, the bifactor loadings, and the MTMM correlation matrix.
import { useState } from 'react';
import { Tex } from '../../components/ui.tsx';
import { COUNTRY, f2, f3, sgn, type Day5, type Step } from './data.ts';

// ---------------------------------------------------------------- the mean equation
/** Two groups, one item: E(y) = τ + λ·κ. Draw equal or unequal intercepts and slopes and see what the item mean says. */
export function MeanEquation() {
  const [dk, setDk] = useState(0.4);    // latent mean of group 2 (group 1: 0)
  const [dt, setDt] = useState(0);      // intercept difference
  const [dl, setDl] = useState(0);      // loading difference
  const t1 = 3.5, l1 = 1, t2 = t1 + dt, l2 = l1 + dl;
  const m1 = t1, m2 = t2 + l2 * dk, obs = m2 - m1, lat = dk * l1;
  const W = 420, H = 230, X = (e: number) => 40 + ((e + 1.5) / 3) * (W - 60), Y = (y: number) => H - 26 - ((y - 1.5) / 4) * (H - 40);
  const line = (t: number, l: number) => `${X(-1.5)},${Y(t - 1.5 * l)} ${X(1.5)},${Y(t + 1.5 * l)}`;
  const level = dl !== 0 ? 'configural' : dt !== 0 ? 'metric' : 'scalar';
  return (
    <div className="fig">
      <div className="fig-row">
        <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label="Item mean as a function of the latent variable in two groups">
          <line x1="40" x2={W - 20} y1={H - 26} y2={H - 26} className="ax" /><line x1="40" x2="40" y1="10" y2={H - 26} className="ax" />
          <text x={W - 20} y={H - 8} className="f-lbl r">latent variable η</text><text x="44" y="18" className="f-lbl">item y</text>
          <polyline points={line(t1, l1)} className="me-l g1" fill="none" /><polyline points={line(t2, l2)} className="me-l g2" fill="none" />
          <line x1={X(0)} x2={X(0)} y1={Y(m1)} y2={H - 26} className="me-k g1" /><circle cx={X(0)} cy={Y(m1)} r="5" className="me-d g1" />
          <line x1={X(dk)} x2={X(dk)} y1={Y(m2)} y2={H - 26} className="me-k g2" /><circle cx={X(dk)} cy={Y(m2)} r="5" className="me-d g2" />
          <text x={X(0)} y={H - 12} className="f-lbl c">κ₁ = 0</text><text x={X(dk)} y={H - 30} className="f-lbl c">κ₂</text>
        </svg>
        <div className="fig-text">
          <label className="ctl"><span>latent mean of group 2, κ₂</span><input type="range" min={-1} max={1} step={0.05} value={dk} onChange={e => setDk(+e.target.value)} /><output>{f2(dk)}</output></label>
          <label className="ctl"><span>intercept difference τ₂ − τ₁</span><input type="range" min={-0.8} max={0.8} step={0.05} value={dt} onChange={e => setDt(+e.target.value)} /><output>{f2(dt)}</output></label>
          <label className="ctl"><span>loading difference λ₂ − λ₁</span><input type="range" min={-0.6} max={0.6} step={0.05} value={dl} onChange={e => setDl(+e.target.value)} /><output>{f2(dl)}</output></label>
          <div className="sc-formula"><Tex block>{`\\bar y_2 - \\bar y_1 = (\\tau_2 - \\tau_1) + \\lambda_2\\kappa_2 - \\lambda_1\\kappa_1 = ${f2(dt)} + ${f2(l2)}\\cdot${f2(dk)} = ${f2(obs)}`}</Tex></div>
          <p className={`est-goal ${Math.abs(obs - lat) < 0.005 ? 'ok' : ''}`}>{Math.abs(obs - lat) < 0.005
            ? <>The item mean differs by {f2(obs)} — exactly the latent difference times the loading. With equal intercepts and slopes (scalar invariance), the observed difference speaks for the construct.</>
            : <>The item mean differs by {f2(obs)}, the construct by {f2(lat)} (in the item’s unit). The rest — {f2(obs - lat)} — is the item, not the people. Here the model is at most <b>{level}</b>.</>}</p>
          <p className="hint">The exercise of the course slides: draw equal intercepts and slopes; then unequal intercepts with equal slopes; then both unequal. In which case does a difference in item means tell you something about the latent means?</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the countries' means, four ways
export function MeansCompare({ d }: { d: Day5 }) {
  const s = d.means.score, be = s[0];
  const dOf = (c: string) => { const x = s.find(r => r.cntry === c)!; return (x.mean - be.mean) / Math.sqrt((x.sd ** 2 + be.sd ** 2) / 2); };
  const lat = (k: 'scalar' | 'partial', c: string) => d.means.latent[k].means.find(m => m.group === c)!.std;
  const al = (c: string) => d.alignment.means[d.groups.indexOf(c)];
  const rows: { label: string; note: string; v: (c: string) => number }[] = [
    { label: 'mean score (Cohen’s d)', note: 'unweighted mean of the four items; error and item bias included', v: dOf },
    { label: 'latent mean, full scalar invariance', note: `all intercepts equal — although the model fails (CFI ${f3(d.means.latent.scalar.fit['cfi.robust'])}, Day 4)`, v: c => lat('scalar', c) },
    { label: 'latent mean, partial scalar invariance', note: '“rules” and “modest” released — not supported by Chen’s criterion (Day 4)', v: c => lat('partial', c) },
    { label: 'latent mean, alignment', note: 'no equality imposed; non-invariance minimized (section 3)', v: al },
  ];
  const X = (v: number) => `${50 + v * 80}%`;
  return (
    <div className="fig">
      <p className="hint" style={{ marginTop: 0 }}>Tradition/conformity in Luxembourg and the Netherlands, compared with Belgium (0), in standard deviations of Belgium.</p>
      <div className="mc-rows">
        {rows.map(r => (
          <div key={r.label} className="mc-row">
            <span><b>{r.label}</b><small>{r.note}</small></span>
            <div className="mc-track">
              <i className="mc-zero" />
              {['LU', 'NL'].map((c, k) => <b key={c} className={`mc-pt g${k + 2}`} style={{ left: X(r.v(c)) }} title={`${COUNTRY[c]}: ${sgn(r.v(c))}`}><em>{c} {sgn(r.v(c))}</em></b>)}
            </div>
          </div>
        ))}
      </div>
      <p>Every ruler puts the Netherlands below Belgium — by {f2(Math.min(...rows.map(r => -r.v('NL'))))} to {f2(Math.max(...rows.map(r => -r.v('NL'))))} standard deviations. Whether Luxembourg differs at all depends on the ruler. Since Day 4 found no ruler that is clearly straight (partial scalar invariance was not supported), these are a <b>sensitivity analysis</b>, not a finding: a result that depends on the ruler is reported with every ruler.</p>
    </div>
  );
}

// ---------------------------------------------------------------- the cascade
export function CascadeView({ d }: { d: Day5 }) {
  const [k, setK] = useState(0);
  const [view, setView] = useState<'full' | 'halves'>('full');
  const full = d.cascade.full, a = d.cascade.half_a, b = d.cascade.half_b;
  const rows: Step[] = view === 'full' ? full : a;
  const top = Math.max(...rows.map(r => r.fit['chisq.scaled']), ...(view === 'halves' ? b.map(r => r.fit['chisq.scaled']) : []));
  const W = (v: number) => `${(v / top) * 100}%`;
  return (
    <div className="fig">
      <div className="seg" role="group" aria-label="Sample">
        <button aria-pressed={view === 'full'} onClick={() => setView('full')}>all respondents</button>
        <button aria-pressed={view === 'halves'} onClick={() => setView('halves')}>found in half A, tested in half B</button>
      </div>
      <label className="ctl"><span>steps taken</span><input type="range" min={0} max={rows.length - 1} step={1} value={k} onChange={e => setK(+e.target.value)} /><output>{k}</output></label>
      <ol className="cascade">
        {rows.map((r, i) => (
          <li key={i} className={i > k ? 'later' : ''}>
            <span className="cs-what">{i === 0 ? r.what : <><b>{i}.</b> {r.what}{r.index ? <small> — index {r.index.toFixed(1)}</small> : null}</>}</span>
            <span className="cs-bar"><i className="a" style={{ width: W(r.fit['chisq.scaled']) }} />{view === 'halves' && <i className="b" style={{ width: W(b[i].fit['chisq.scaled']) }} />}</span>
            <span className="cs-num">χ²({r.fit.df}) {r.fit['chisq.scaled'].toFixed(0)} · CFI {f3(r.fit['cfi.robust'])}{view === 'halves' && <> | B: {b[i].fit['chisq.scaled'].toFixed(0)} · {f3(b[i].fit['cfi.robust'])}</>}</span>
          </li>
        ))}
      </ol>
      {view === 'full'
        ? <p>Six steps, each the largest index at the time: χ² falls from {full[0].fit['chisq.scaled'].toFixed(0)} to {full[full.length - 1].fit['chisq.scaled'].toFixed(0)}, CFI rises from {f3(full[0].fit['cfi.robust'])} to {f3(full[full.length - 1].fit['cfi.robust'])}. A good-looking model — but every step was chosen by the data it is then tested on.</p>
        : <p>In half A the first three steps are the same as in the full sample; from step 4 on the cascade takes other turns — a cross-loading, error covariances the full sample never asked for. In half B those later steps buy little: χ² {b[3].fit['chisq.scaled'].toFixed(0)} → {b[b.length - 1].fit['chisq.scaled'].toFixed(0)}, against {a[3].fit['chisq.scaled'].toFixed(0)} → {a[a.length - 1].fit['chisq.scaled'].toFixed(0)} in half A. The early steps describe the countries; the late ones describe the sample.</p>}
      <div className="srch-legend"><span><i className="js" />χ² in {view === 'full' ? 'all respondents' : 'half A, where the steps were found'}</span>{view === 'halves' && <span><i className="lav" />the same steps in half B</span>}</div>
    </div>
  );
}

// ---------------------------------------------------------------- second order
export function HigherOrder({ d }: { d: Day5 }) {
  const [second, setSecond] = useState(true);
  const h = d.higher, fs = ['Tradition', 'Conformity', 'Security'];
  const load = (f: string) => h.second.est.find(e => e.op === '=~' && e.lhs === 'Conservation' && e.rhs === f)!.std;
  const c = h.first.cor;
  const fy = [60, 150, 240];
  return (
    <div className="fig">
      <div className="seg" role="group" aria-label="Model"><button aria-pressed={!second} onClick={() => setSecond(false)}>three correlated factors</button><button aria-pressed={second} onClick={() => setSecond(true)}>one factor above them</button></div>
      <div className="fig-row">
        <svg viewBox="0 0 420 300" className="fig-svg" role="img" aria-label="Conservation as three correlated first-order factors or as one second-order factor" style={{ color: 'var(--ink)' }}>
          <defs><marker id="ho-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor" /></marker></defs>
          {fs.map((f, i) => (
            <g key={f}>
              {[0, 1].map(j => <g key={j}><line x1="268" y1={fy[i]} x2="322" y2={fy[i] - 18 + j * 36} className="sc-load" markerEnd="url(#ho-a)" /><rect x="324" y={fy[i] - 29 + j * 36} width="80" height="22" rx="3" className="f-obs" /><text x="364" y={fy[i] - 14 + j * 36} className="f-lbl c sm">{[['imptrad', 'ipmodst'], ['ipfrule', 'ipbhprp'], ['impsafe', 'ipstrgv']][i][j]}</text></g>)}
              <ellipse cx="226" cy={fy[i]} rx="42" ry="20" className="f-lat" /><text x="226" y={fy[i] + 4} className="f-lbl c b sm">{f}</text>
            </g>
          ))}
          {second
            ? <>{fs.map((f, i) => <g key={f}><line x1="104" y1="150" x2="182" y2={fy[i]} className="sc-load" markerEnd="url(#ho-a)" /><text x="148" y={(150 + fy[i]) / 2 - 4} className="f-lbl c b">{f2(load(f))}</text></g>)}
              <ellipse cx="66" cy="150" rx="44" ry="24" className="f-lat" /><text x="66" y="154" className="f-lbl c b sm">Conservation</text></>
            : <>{[[0, 1, -40], [1, 2, -40], [0, 2, -95]].map(([a, b, cv]) => <g key={`${a}${b}`}><path d={`M184 ${fy[a] + 8} Q ${184 + cv} ${(fy[a] + fy[b]) / 2} 184 ${fy[b] - 8}`} fill="none" className="sc-cor" markerStart="url(#ho-a)" markerEnd="url(#ho-a)" /><text x={184 + cv / 2 - 6} y={(fy[a] + fy[b]) / 2 + 4} className="f-lbl c b">{f2(c[b][a])}</text></g>)}</>}
        </svg>
        <div className="fig-text">
          <p>{second
            ? <>One higher value, <b>conservation</b>, explains why the three correlate: tradition and conformity load {f2(load('Tradition'))} and {f2(load('Conformity'))}, security {f2(load('Security'))}. It explains {Math.round(h.second.r2[0] * 100)} %, {Math.round(h.second.r2[1] * 100)} % and {Math.round(h.second.r2[2] * 100)} % of their variance.</>
            : <>Three first-order factors, three correlations: {f2(c[1][0])}, {f2(c[2][0])}, {f2(c[2][1])}. High — something they share.</>}</p>
          <p>Fit: χ²<sub>scaled</sub>({h.first.fit.df}) = {h.first.fit['chisq.scaled'].toFixed(2)} for <i>both</i> models, CFI {f3(h.first.fit['cfi.robust'])}. With three first-order factors the second-order part is just identified: three correlations, three second-order parameters (two loadings, one variance — one loading is the marker). The two models are equivalent; the second one adds an interpretation, not a test. With four or more first-order factors it becomes testable.</p>
          <p className="hint">Watch the disturbances: conformity keeps a residual variance of {h.second.disturbance.find(x => x.factor === 'Conformity')!.est.toFixed(3)} (p = {f2(h.second.disturbance.find(x => x.factor === 'Conformity')!.p)}) — a standardized second-order loading of {f2(load('Conformity'))} means conservation and conformity are almost the same factor here.</p>
          <p className="hint">Belgium, ESS 2004. In the Netherlands the same model breaks: tradition and conformity correlate {f2(h.nl.cor[1][0])} — above 1 — and lavaan warns that the covariance matrix of the latent variables is not positive definite. Two items each cannot tell the two values apart there; that is why the course measures them as one factor, TRCO.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- bifactor
export function BifactorView({ d }: { d: Day5 }) {
  const b = d.bifactor;
  const facet: Record<string, string> = { UNIV: 'universalism', ALLOW: 'allow immigrants', EFFECTS: 'immigration is good' };
  return (
    <div className="fig">
      <table className="rp-table bf-tab">
        <thead><tr><th>item</th><th>facet</th><th>general factor</th><th>its facet</th></tr></thead>
        <tbody>{b.general.map(g => {
          const s = b.specific.find(x => x.item === g.item)!;
          return <tr key={g.item}><td><code>{g.item}</code></td><td>{facet[s.factor]}</td>
            <td><span className="bf-bar"><i style={{ width: `${Math.max(0, g.std) * 100}%` }} className="g" /></span>{f2(g.std)}</td>
            <td><span className="bf-bar"><i style={{ width: `${Math.max(0, s.std) * 100}%` }} className="s" /></span>{f2(s.std)}</td></tr>;
        })}</tbody>
      </table>
      <p>The general factor runs through the attitude items — allow immigrants and “immigration is good” — but hardly through universalism ({b.general.slice(0, 3).map(g => f2(g.std)).join(', ')}). The general factor is an attitude toward immigration, not a pro-diversity disposition that includes the values. Omega hierarchical, the share of the total score that is the general factor: ω<sub>H</sub> = {f2(b.omega_h)} of ω = {f2(b.omega_total)}.</p>
      <p>Fit: bifactor χ²<sub>scaled</sub>({b.fit.df}) = {b.fit['chisq.scaled'].toFixed(1)}, CFI {f3(b.fit['cfi.robust'])}; three correlated factors χ²<sub>scaled</sub>({b.correlated.df}) = {b.correlated['chisq.scaled'].toFixed(1)}, CFI {f3(b.correlated['cfi.robust'])}. The bifactor model fits better — as it usually does: it has more parameters and absorbs odd response patterns too (Reise et al., 2017). Better fit alone is no argument for a general factor.</p>
    </div>
  );
}

// ---------------------------------------------------------------- MTMM
const TR: Record<string, string> = { parl: 'parliament', legal: 'legal system', police: 'police' };
const MT: Record<string, string> = { a: '0–10', b: 'agree 4', c: '5-point' };
type Cell = 'mono' | 'hetero-mono' | 'hetero-hetero';
export function MtmmMatrix({ d }: { d: Day5 }) {
  const [hl, setHl] = useState<Cell | null>('mono');
  const m = d.mtmm;
  const order = m.names.map((x, i) => ({ x, i })).sort((a, b) => a.x.split('_')[1].localeCompare(b.x.split('_')[1]) || ['parl', 'legal', 'police'].indexOf(a.x.split('_')[0]) - ['parl', 'legal', 'police'].indexOf(b.x.split('_')[0])).map(o => o.i);
  const n = order.map(i => m.names[i]), R = order.map(i => order.map(j => m.r[i][j]));
  const kind = (i: number, j: number): Cell => {
    const [ti, mi] = n[i].split('_'), [tj, mj] = n[j].split('_');
    return ti === tj ? 'mono' : mi === mj ? 'hetero-mono' : 'hetero-hetero';
  };
  const avg = (k: Cell) => { const v: number[] = []; n.forEach((_, i) => n.forEach((__, j) => { if (j < i && kind(i, j) === k) v.push(R[i][j]); })); return v.reduce((a, b) => a + b, 0) / v.length; };
  const tc = m.trait_cor;
  return (
    <div className="fig">
      <div className="seg wrap" role="group" aria-label="Highlight">
        <button aria-pressed={hl === 'mono'} onClick={() => setHl('mono')}>same trait, other method</button>
        <button aria-pressed={hl === 'hetero-mono'} onClick={() => setHl('hetero-mono')}>other trait, same method</button>
        <button aria-pressed={hl === 'hetero-hetero'} onClick={() => setHl('hetero-hetero')}>other trait, other method</button>
      </div>
      <div className="fig-row">
        <div className="mtmm-grid" style={{ gridTemplateColumns: `90px repeat(${n.length}, 1fr)` }}>
          <span />{n.map(c => <span key={c} className="h">{({ parl: 'parl.', legal: 'legal', police: 'police' } as Record<string, string>)[c.split('_')[0]]}<br />{MT[c.split('_')[1]]}</span>)}
          {n.map((r, i) => [<span key={r} className="h left">{TR[r.split('_')[0]]} · {MT[r.split('_')[1]]}</span>, ...n.map((_, j) => j > i ? <span key={j} /> : j === i ? <span key={j} className="diag">1</span> : <span key={j} className={`c ${hl && kind(i, j) === hl ? 'on' : ''}`} style={{ background: `rgba(85,70,196,${R[i][j] * 0.7})` }}>{f2(R[i][j])}</span>)])}
        </div>
        <div className="fig-text">
          <p>Campbell and Fiske’s matrix: three traits (trust in parliament, the legal system, the police), each measured with three methods (a 0–10 scale, a 4-point agree scale, a 5-point scale). Averages: same trait by other methods {f2(avg('mono'))}; other traits by the same method {f2(avg('hetero-mono'))}; other traits and other methods {f2(avg('hetero-hetero'))}.</p>
          <p><b>Convergent validity</b>: the same trait measured differently should correlate highly — the highlighted “validity diagonal”. <b>Discriminant validity</b>: it should correlate more than different traits that merely share a method. Shared methods inflate correlations: that is method variance.</p>
          <table className="rp-table">
            <thead><tr><th>trait correlations</th><th>parl–legal</th><th>parl–police</th><th>legal–police</th></tr></thead>
            <tbody>
              <tr><td>traits only (method ignored)</td>{tc.traits.map((v, k) => <td key={k}>{f2(v)}</td>)}</tr>
              <tr><td>with uncorrelated method factors (CT-UM)</td>{tc.ctcm.map((v, k) => <td key={k}>{f2(v)}</td>)}</tr>
              <tr><td>true values of the simulation</td>{m.true_cor.map((v, k) => <td key={k}>{f2(v)}</td>)}</tr>
            </tbody>
          </table>
          <p className="hint">Ignoring the methods, the model fits poorly (CFI {f3(m.fits.traits.cfi)}) and overstates the trait correlations; with method factors it fits (CFI {f3(m.fits.ctcm.cfi)}) and recovers them. The data are simulated (continuous, with lavaan 0.6-21), so the truth is known. The method blocks lie along the diagonal; the validity diagonals run parallel to it in the off-diagonal blocks.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the probe: per-country fits
export function ProbeTable({ d }: { d: Day5 }) {
  const p = d.probe;
  const pTxt = (x: number) => (x < 0.001 ? '< .001' : f3(x));
  const rows: [string, Record<string, number>, string][] = [
    ['configural', p.fits.config, '—'], ['metric', p.fits.metric, `${p.lrt.metric.dchisq.toFixed(1)} (${p.lrt.metric.ddf}), ${pTxt(p.lrt.metric.p)}`],
    ['scalar', p.fits.scalar, `${p.lrt.scalar.dchisq.toFixed(1)} (${p.lrt.scalar.ddf}), ${pTxt(p.lrt.scalar.p)}`],
    [`partial scalar (${p.released.map(x => x.replace('~1', '')).join(', ')})`, p.fits.partial, `${p.lrt.partial.dchisq.toFixed(1)} (${p.lrt.partial.ddf}), ${pTxt(p.lrt.partial.p)}`],
  ];
  return (
    <>
      <table className="rp-table">
        <thead><tr><th>country</th><th>χ² scaled (df)</th><th>CFI</th><th>RMSEA</th><th>SRMR</th><th>ω ALLOW</th><th>ω EFFECTS</th></tr></thead>
        <tbody>{d.groups.map(g => { const f = p.base[g]; return <tr key={g}><td>{COUNTRY[g]}</td><td>{f['chisq.scaled'].toFixed(2)} ({f.df})</td><td>{f3(f['cfi.robust'])}</td><td>{f3(f['rmsea.robust'])}</td><td>{f3(f.srmr)}</td><td>{f2(p.omega[g][0])}</td><td>{f2(p.omega[g][1])}</td></tr>; })}</tbody>
      </table>
      <table className="rp-table">
        <thead><tr><th>model</th><th>χ² scaled (df)</th><th>CFI</th><th>RMSEA</th><th>Δχ²<sub>SB</sub> against the rung below (metric for partial)</th><th>ΔCFI</th></tr></thead>
        <tbody>{rows.map(([nm, f, l], i) => {
          const below = i === 0 ? null : i === 3 ? p.fits.metric : rows[i - 1][1];
          const dc = below ? f['cfi.robust'] - below['cfi.robust'] : null;
          return <tr key={nm}><td><b>{nm}</b></td><td>{f['chisq.scaled'].toFixed(1)} ({f.df})</td><td>{f3(f['cfi.robust'])}</td><td>{f3(f['rmsea.robust'])}</td><td>{l}</td><td className={dc === null ? '' : dc >= -0.01 ? 'good' : 'poor'}>{dc === null ? '—' : sgn(dc, 3)}</td></tr>;
        })}</tbody>
      </table>
    </>
  );
}
