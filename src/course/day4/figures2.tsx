// Day 4 · the slide figures, made interactive (part 2): comparing the rungs (Satorra–Bentler
// and Chen, 2007), the score test behind partial invariance, the release lab with its latent
// means, the decision tree for non-invariance, and the homework solution.
import { useState } from 'react';
import { Tex } from '../../components/ui.tsx';
import { f2, f3 } from '../day1/data.ts';
import { COUNTRY, GROUP_COLOR, partialKey, sgn, type Day4, type Fit, type Mean, type Score } from './data.ts';
import { GroupLegend, Marker } from './figures1.tsx';

// Chen (2007), n > 300 — the worksheet's table
export const CHEN = { cfi: -0.01, rmsea: 0.015, srmr: { metric: 0.03, scalar: 0.01 } };
const pTxt = (p: number) => (p < 0.001 ? '< .001' : f3(p));

function deltas(a: Fit, b: Fit) {   // b is the more restricted model
  return { cfi: b['cfi.robust'] - a['cfi.robust'], rmsea: b['rmsea.robust'] - a['rmsea.robust'], srmr: b.srmr - a.srmr };
}
/** Chen (2007): non-invariance when CFI drops by more than .010 and RMSEA or SRMR rises beyond its limit. */
export function chenHolds(a: Fit, b: Fit, level: 'metric' | 'scalar') {
  const x = deltas(a, b);
  return !(x.cfi < CHEN.cfi && (x.rmsea > CHEN.rmsea || x.srmr > CHEN.srmr[level]));
}
function ChenCells({ a, b, level }: { a: Fit; b: Fit; level: 'metric' | 'scalar' }) {
  const x = deltas(a, b);
  const ok = { cfi: x.cfi >= CHEN.cfi, rmsea: x.rmsea <= CHEN.rmsea, srmr: x.srmr <= CHEN.srmr[level] };
  return <>
    <td className={ok.cfi ? 'good' : 'poor'}>{sgn(x.cfi)}</td>
    <td className={ok.rmsea ? 'good' : 'poor'}>{sgn(x.rmsea)}</td>
    <td className={ok.srmr ? 'good' : 'poor'}>{sgn(x.srmr)}</td>
  </>;
}

// ---------------------------------------------------------------- comparing the rungs
export function RungTable({ d }: { d: Day4 }) {
  const f = d.fits;
  const rows = [
    { name: 'configural', fit: f.config, lrt: null, cmp: null as null | { a: Fit; level: 'metric' | 'scalar' } },
    { name: 'metric', fit: f.metric, lrt: d.lrt.metric, cmp: { a: f.config, level: 'metric' as const } },
    { name: 'scalar', fit: f.scalar, lrt: d.lrt.scalar, cmp: { a: f.metric, level: 'scalar' as const } },
  ];
  return (
    <div className="fig">
      <table className="rp-table rung-tab">
        <thead>
          <tr><th>model</th><th>χ² scaled (df)</th><th>CFI</th><th>RMSEA</th><th>SRMR</th><th>Δχ²<sub>SB</sub> (Δdf), p</th><th>ΔCFI<br /><small>≥ −.010</small></th><th>ΔRMSEA<br /><small>≤ .015</small></th><th>ΔSRMR<br /><small>≤ .030 / .010</small></th></tr>
        </thead>
        <tbody>{rows.map(r => (
          <tr key={r.name}>
            <td><b>{r.name}</b></td>
            <td>{r.fit['chisq.scaled'].toFixed(2)} ({r.fit.df})</td><td>{f3(r.fit['cfi.robust'])}</td><td>{f3(r.fit['rmsea.robust'])}</td><td>{f3(r.fit.srmr)}</td>
            <td>{r.lrt ? <>{r.lrt.dchisq.toFixed(1)} ({r.lrt.ddf}), {pTxt(r.lrt.p)}</> : '—'}</td>
            {r.cmp ? <ChenCells a={r.cmp.a} b={r.fit} level={r.cmp.level} /> : <><td>—</td><td>—</td><td>—</td></>}
          </tr>
        ))}</tbody>
      </table>
      <p className="hint">Each rung is compared with the one below it (robust indices). Green: within Chen’s (2007) limits for samples above 300 — the metric model is as good as the configural one; the scalar model is far outside every limit.</p>
    </div>
  );
}

// ---------------------------------------------------------------- the score test
export function ScoreTable({ d, labels, rows: given }: { d: Day4; labels: Record<string, string>; rows?: Score[] }) {
  const rows = (given ?? d.score_scalar).slice(0, 8);
  const [k, setK] = useState(0);
  const s: Score = rows[k];
  const gi = (g: string) => d.groups.indexOf(g) + 1;
  return (
    <div className="fig">
      <div className="fig-row">
        <table className="rp-table mi-pick">
          <thead><tr><th>lhs</th><th>op</th><th>rhs</th><th>X2</th><th>p.value</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className={i === k ? 'on' : ''} onClick={() => setK(i)} style={{ cursor: 'pointer' }}><td>{r.lhs}</td><td>==</td><td>{r.rhs}</td><td>{r.X2.toFixed(3)}</td><td>{r.p < 0.001 ? '0.000' : r.p.toFixed(3)}</td></tr>)}</tbody>
        </table>
        <div className="fig-text">
          <p className="idrow"><code>{s.lhs} == {s.rhs}</code></p>
          <p><b>parTable()</b> decodes the labels: <code>{s.lhs}</code> is the {s.kind} of <code>{s.item}</code> in group {gi(s.g1)} ({COUNTRY[s.g1]}), <code>{s.rhs}</code> the same {s.kind} in group {gi(s.g2)} ({COUNTRY[s.g2]}).</p>
          <p>Releasing this one equality would lower χ² by about <b>{s.X2.toFixed(1)}</b>. The item: “{labels[s.item]}”.</p>
          <p className="hint">Groups are numbered in the order they appear in the data: 1 = BE, 2 = LU, 3 = NL. lavaan tests each equality against the first group.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the release lab
const MAXS = 0.7;
function MeansChart({ means }: { means: Mean[] }) {
  const W = 360, H = 120, X = (v: number) => 30 + ((v + MAXS) / (MAXS + 0.3)) * (W - 50);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg means-svg" role="img" aria-label={`Latent means in SD of Belgium: ${means.map(m => `${m.group} ${m.std.toFixed(2)}`).join(', ')}`}>
      {[-0.6, -0.4, -0.2, 0].map(t => <g key={t}><line x1={X(t)} x2={X(t)} y1="8" y2={H - 24} className={t === 0 ? 'f-arr' : 'h-grid'} /><text x={X(t)} y={H - 8} className="f-lbl c sm">{t === 0 ? '0' : f2(t)}</text></g>)}
      {means.map((m, g) => {
        const y = 22 + g * 30;
        return (
          <g key={m.group}>
            <text x="4" y={y + 4} className="f-lbl b">{m.group}</text>
            {g > 0 && <line x1={X(m.std - 1.96 * m.std_se)} x2={X(m.std + 1.96 * m.std_se)} y1={y} y2={y} stroke={GROUP_COLOR[g]} strokeWidth="2.5" strokeLinecap="round" style={{ transition: 'all .4s' }} />}
            <g style={{ transform: `translateX(${X(m.std)}px)`, transition: 'transform .4s' }}><Marker x={0} y={y} g={g} r={6.5} /></g>
            <text x={X(m.std) + (m.std < -0.1 ? -12 : 12)} y={y - 9} className="f-lbl sm" textAnchor={m.std < -0.1 ? 'end' : 'start'}>{g ? sgn(m.std, 2) : 'reference'}</text>
          </g>
        );
      })}
      <text x={W - 6} y={H - 8} className="f-lbl sm" textAnchor="end">in SD of BE</text>
    </svg>
  );
}

export function ReleaseLab({ d, labels }: { d: Day4; labels: Record<string, string> }) {
  const [rules, setRules] = useState(false);
  const [modest, setModest] = useState(false);
  const key = partialKey(rules, modest);
  const fit = d.fits[key], metric = d.fits.metric;
  const lrt = key === 'scalar' ? d.lrt.scalar : d.lrt[key];
  const dx = deltas(metric, fit), chenOk = chenHolds(metric, fit, 'scalar');
  const freed = [rules && 'ipfrule~1', modest && 'ipmodst~1'].filter(Boolean) as string[];
  const anchors = d.items.filter(it => !(it === 'ipfrule' && rules) && !(it === 'ipmodst' && modest));
  const all = (['scalar', 'partial', 'partial2', 'partial3'] as const).map(k => ({ k, nl: d.means[k][2].std }));
  return (
    <div className="fig">
      <div className="rl-toggles">
        <label className="chk"><input type="checkbox" checked={rules} onChange={e => setRules(e.target.checked)} /> release the intercept of <code>ipfrule</code> <small>(“{labels.ipfrule}”)</small></label>
        <label className="chk"><input type="checkbox" checked={modest} onChange={e => setModest(e.target.checked)} /> release the intercept of <code>ipmodst</code> <small>(“{labels.ipmodst}”)</small></label>
      </div>
      <pre className="syntax rl-code"><code>{`group.equal = c("loadings", "intercepts")${freed.length ? `,\ngroup.partial = c(${freed.map(x => `"${x}"`).join(', ')})` : ''}`}</code></pre>
      <div className="fig-row">
        <div>
          <table className="rp-table">
            <thead><tr><th></th><th>χ² (df)</th><th>CFI</th><th>RMSEA</th><th>SRMR</th></tr></thead>
            <tbody>
              <tr><td>metric</td><td>{metric['chisq.scaled'].toFixed(1)} ({metric.df})</td><td>{f3(metric['cfi.robust'])}</td><td>{f3(metric['rmsea.robust'])}</td><td>{f3(metric.srmr)}</td></tr>
              <tr className="on"><td>{key === 'scalar' ? 'scalar' : 'partial scalar'}</td><td>{fit['chisq.scaled'].toFixed(1)} ({fit.df})</td><td>{f3(fit['cfi.robust'])}</td><td>{f3(fit['rmsea.robust'])}</td><td>{f3(fit.srmr)}</td></tr>
            </tbody>
          </table>
          <p className={`idrow ${chenOk ? 'good' : 'poor'}`}><b>ΔCFI {sgn(dx.cfi)} · ΔRMSEA {sgn(dx.rmsea)} · ΔSRMR {sgn(dx.srmr)}</b> — {chenOk ? 'within Chen’s limits' : 'outside Chen’s limits'}</p>
          <p className="hint">Δχ²<sub>SB</sub>({lrt.ddf}) = {lrt.dchisq.toFixed(1)}, p {pTxt(lrt.p)} against the metric model. Anchors: {anchors.join(', ')} ({anchors.length} equal intercepts{anchors.length === 2 ? ' — the minimum for partial invariance' : ''}).{modest && ' ipmodst is the reference indicator: its loading stays fixed to 1, only its intercept is free — allowed, but the unit of the factor now rests on an item whose intercept differs.'}</p>
        </div>
        <div>
          <GroupLegend groups={d.groups} />
          <MeansChart means={d.means[key]} />
          <div className="nl-strip" aria-label="The Dutch latent mean under each choice of anchors">
            {all.map(a => <span key={a.k} className={a.k === key ? 'on' : ''}>{a.k === 'scalar' ? 'none' : a.k === 'partial' ? 'rules' : a.k === 'partial2' ? 'modest' : 'both'} freed: NL {sgn(a.nl, 2)}</span>)}
          </div>
        </div>
      </div>
      <p className="hint">The latent means in standard deviations of Belgium (fixed-factor scaling, Belgium: mean 0, variance 1), ± 1.96 SE. The same data, four sets of anchors, four answers to “are the Dutch less traditional?”.</p>
    </div>
  );
}

// ---------------------------------------------------------------- when invariance fails
type Node = { id: string; text: string; bnl?: string; next?: { label: string; to: string }[]; end?: boolean };
const TREE: Node[] = [
  { id: 'full', text: 'Test for full exact measurement invariance', bnl: 'Benelux: metric holds, scalar fails (ΔCFI −.258).', next: [{ label: 'yes', to: 'go' }, { label: 'no', to: 'partial' }, { label: 'no — look at the instrument first', to: 'inspect' }] },
  { id: 'partial', text: 'Test for partial exact, full approximate or partial approximate invariance', bnl: 'Benelux: with rules and modest free, CFI .973 — but ΔCFI −.024. Holds by the absolute CFI, fails by Chen.', next: [{ label: 'yes', to: 'go' }, { label: 'yes — and with many groups', to: 'align' }, { label: 'no', to: 'inspect' }] },
  { id: 'inspect', text: 'Inspect your measurement instrument and theoretical model', bnl: 'Benelux: what does “being humble and modest” or “following rules” mean in each country — and in each language version?', next: [{ label: 'instrument or model not OK', to: 'improve' }, { label: 'instrument and model OK', to: 'subst' }, { label: 'trustworthy means needed anyway', to: 'align' }] },
  { id: 'improve', text: 'Improve your model and/or instrument — and test again', end: true },
  { id: 'subst', text: 'Use the results on non-invariance as substantive information on differences', end: true },
  { id: 'align', text: 'Use alignment to get means as trustworthy as possible (Day 5)', next: [{ label: 'then', to: 'go' }] },
  { id: 'go', text: 'Continue the substantive analysis', end: true },
];
export function DecisionTree() {
  const [path, setPath] = useState<string[]>(['full']);
  const node = (id: string) => TREE.find(n => n.id === id)!;
  const cur = node(path[path.length - 1]);
  return (
    <div className="fig tree">
      <ol className="tree-path">
        {path.map((id, i) => {
          const n = node(id);
          return (
            <li key={i} className={i === path.length - 1 ? 'cur' : ''}>
              <b>{n.text}</b>
              {n.bnl && <small>{n.bnl}</small>}
              {i < path.length - 1 && <span className="tree-took">→ {node(id).next!.find(x => x.to === path[i + 1])?.label}</span>}
            </li>
          );
        })}
      </ol>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {cur.next?.map(x => <button key={x.label} className="tool" onClick={() => setPath(p => [...p, x.to])}>{x.label}</button>)}
        {path.length > 1 && <button className="tool" onClick={() => setPath(['full'])}>start again</button>}
      </div>
      <p className="hint">After the decision tree in the slides of the Essex SEM course (2024), redrawn. Walk it for the Benelux case: two defensible readings — absolute fit or the change in fit — lead to different branches at the second box.</p>
    </div>
  );
}

// ---------------------------------------------------------------- homework solution
export function UnbeSolution({ d }: { d: Day4 }) {
  const u = d.unbe, f = u.fits;
  const rows: { name: string; fit: Fit; a?: Fit; level?: 'metric' | 'scalar' }[] = [
    { name: 'configural', fit: f.config }, { name: 'metric', fit: f.metric, a: f.config, level: 'metric' },
    { name: 'scalar', fit: f.scalar, a: f.metric, level: 'scalar' },
    { name: `partial: ${u.freed[0]} free`, fit: f.partial, a: f.metric, level: 'scalar' },
    { name: `partial: ${u.freed.join(' + ')} free`, fit: f.partial2, a: f.metric, level: 'scalar' },
  ];
  return (
    <div>
      <table className="rp-table">
        <thead><tr><th>model</th><th>χ² (df)</th><th>CFI</th><th>RMSEA</th><th>ΔCFI</th><th>ΔRMSEA</th><th>ΔSRMR</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.name}><td>{r.name}</td><td>{r.fit['chisq.scaled'].toFixed(1)} ({r.fit.df})</td><td>{f3(r.fit['cfi.robust'])}</td><td>{f3(r.fit['rmsea.robust'])}</td>{r.a ? <ChenCells a={r.a} b={r.fit} level={r.level!} /> : <><td>—</td><td>—</td><td>—</td></>}</tr>)}</tbody>
      </table>
      <p>The score test points to the intercept of <code>{u.score[0].item}</code> ({u.score[0].g1} = {u.score[0].g2}, X2 = {u.score[0].X2.toFixed(1)}). With it released, the drop from the metric model already stays within Chen’s limits on the robust indices (ΔCFI {sgn(f.partial['cfi.robust'] - f.metric['cfi.robust'])}): <b>partial scalar invariance</b> for universalism and benevolence — unlike tradition and conformity. Judged by the scaled CFI instead (ΔCFI −.011, just outside the limit), you would release <code>{u.freed[1]}</code> as well. Same data, same decision rule, a different index — and a different number of anchors. With MLR, report the robust indices (section 6), and say which ones you used.</p>
      <p className="hint">Latent means in SD of Belgium with <code>{u.freed[0]}</code> free: {u.means.partial.map(m => `${m.group} ${m.std === 0 ? '0' : sgn(m.std, 2)}`).join(' · ')}. With both intercepts free: {u.means.partial2.map(m => `${m.group} ${m.std === 0 ? '0' : sgn(m.std, 2)}`).join(' · ')}; full scalar model: {u.means.scalar.map(m => `${m.group} ${m.std === 0 ? '0' : sgn(m.std, 2)}`).join(' · ')}. Again the anchors move the Dutch mean.</p>
      <div className="sc-formula"><Tex block>{'\\Delta CFI = CFI_{partial} - CFI_{metric} \\geq -.010'}</Tex></div>
    </div>
  );
}
