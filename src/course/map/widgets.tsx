// The map of SEM · the smaller pieces: why latent variables (attenuation), where SEM comes from
// (a timeline with two roots), what it can model (a gallery that is also the map of η Lab), the
// grammar of path diagrams, the matrices of the full model with lavaan's real output, and the
// strip that shows each day its place on the map.
import { useEffect, useState, type ReactNode } from 'react';
import { Predict, Tex } from '../../components/ui.tsx';
import type { EstData } from './estimation.tsx';
import { DAYS } from '../days.ts';

// ---------------------------------------------------------------- data from R
interface Mat { rows: string[]; cols: string[]; values: number[][] }
export interface MapData {
  cfa: { matrices: Record<string, Mat>; text: string };
  sem: { matrices: Record<string, Mat>; text: string; fit: Record<string, number>; std: { lhs: string; rhs: string; est: number; std: number }[]; chisq: number };
  est: EstData;
}
let cache: Promise<MapData> | null = null;
export function useMapData() {
  const [d, setD] = useState<MapData | null>(null);
  useEffect(() => {
    cache ??= fetch(`${import.meta.env.BASE_URL}data/map.json`).then(r => r.json() as Promise<MapData>);
    cache.then(setD).catch(() => setD(null));
  }, []);
  return d;
}

// ---------------------------------------------------------------- 1 · why: attenuation
export function WhyLatent() {
  const [rho, setRho] = useState(0.6);
  const [rel, setRel] = useState(0.6);
  const [open, setOpen] = useState(false);
  const obs = rho * rel;   // both measures with the same reliability: r = ρ·√(rel·rel)
  return (
    <div className="fig">
      <Predict question="Two constructs correlate .50. Each is measured by a sum score with reliability .70 — 70 % of its variance is the construct, 30 % is error. What correlation do the two sum scores show?"
        min={0} max={0.7} step={0.01} start={0.6} truth={0.35} format={v => v.toFixed(2)} onDone={() => setOpen(true)}
        explain={() => <>The error in each score dilutes the correlation: .50 · √(.70 · .70) = .50 · .70 = .35 — almost a third smaller. Now try other values below.</>} />
      {open && <div className="fig-row">
        <div>
          <label className="ctl"><span>true correlation</span><input type="range" min={0} max={0.9} step={0.05} value={rho} onChange={e => setRho(+e.target.value)} /><output>{rho.toFixed(2)}</output></label>
          <label className="ctl"><span>reliability of both measures</span><input type="range" min={0.2} max={1} step={0.05} value={rel} onChange={e => setRel(+e.target.value)} /><output>{rel.toFixed(2)}</output></label>
          <div className="why-bars">
            <div><span>between the constructs</span><i style={{ width: `${rho * 100}%` }} className="lat" /><b>{rho.toFixed(2)}</b></div>
            <div><span>between the measured scores</span><i style={{ width: `${obs * 100}%` }} className="obs" /><b>{obs.toFixed(2)}</b></div>
          </div>
        </div>
        <div className="fig-text">
          <p className="idrow"><Tex>{`r_{xy} = \\rho \\cdot \\sqrt{rel_x \\cdot rel_y} = ${rho.toFixed(2)} \\cdot \\sqrt{${rel.toFixed(2)} \\cdot ${rel.toFixed(2)}} = ${rho.toFixed(2)} \\cdot ${rel.toFixed(2)} = ${obs.toFixed(2)}`}</Tex></p>
          <p>With measurement error, every relationship between measured scores is smaller than the relationship between the constructs — and you cannot tell how much smaller from the scores alone. A model that measures the constructs with several items can separate the error from the construct, and estimate the relationship between the constructs themselves.</p>
          <p className="hint">Reliability is the share of an item’s or a score’s variance that is the construct (Day 1, the start). Spearman described this “attenuation” in 1904 — and how to correct for it.</p>
        </div>
      </div>}
      {open && <p className="why-real"><b>In the ESS data</b> (Day 2): tradition/conformity and universalism correlate <b>.58 as factors</b>, but only <b>.35 as sum scores</b>. A regression of sum scores would underestimate the relationship by 40 %.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- 2 · history
const HISTORY: { year: string; who: string; what: string; gain: string; root: 'psy' | 'path' | 'sem' }[] = [
  { year: '1904', who: 'Charles Spearman', what: 'A single “general intelligence” behind the correlations of school grades: the first factor model — and the correction of correlations for measurement error (section 1).', gain: 'An unobserved cause could be inferred from the pattern of correlations.', root: 'psy' },
  { year: '1921', who: 'Sewall Wright', what: '“Correlation and causation”: path analysis — diagrams of causes, and tracing rules that turn arrows into correlations.', gain: 'A causal theory could be drawn, and its implied correlations computed (section 5 uses his rule).', root: 'path' },
  { year: '1930s–40s', who: 'Louis L. Thurstone', what: 'Multiple factor analysis: several factors at once, and the idea of a simple structure.', gain: 'Several constructs at once, each with its own items.', root: 'psy' },
  { year: '1940', who: 'Derrick N. Lawley', what: 'Factor analysis by maximum likelihood — in theory; computers could not yet do it in practice.', gain: 'Estimates with standard errors and a χ² test of the model.', root: 'psy' },
  { year: '1940s', who: 'Trygve Haavelmo · Cowles Commission', what: 'Systems of simultaneous equations in economics: variables that cause each other, estimated jointly.', gain: 'Many equations, estimated as one system.', root: 'path' },
  { year: '1960s', who: 'Otis D. Duncan · Hubert Blalock', what: 'Path analysis enters sociology: status attainment, causal models from survey data.', gain: 'Causal models for survey data in the social sciences.', root: 'path' },
  { year: '1967–69', who: 'Karl G. Jöreskog', what: 'A fast, reliable way to compute the ML estimates (1967) — and confirmatory factor analysis (1969): the researcher specifies which loadings are zero, and tests it.', gain: 'Testing a measurement theory instead of exploring.', root: 'psy' },
  { year: '1972–73', who: 'Jöreskog · Keesling · Wiley', what: 'The two roots join: factor models for the measurement, simultaneous equations for the structure. LISREL — linear structural relations.', gain: 'Effects between constructs, corrected for measurement error.', root: 'sem' },
  { year: '1980s–1990', who: 'Peter Bentler · Bengt Muthén · Michael Browne', what: 'EQS (1985) and new fit indices (CFI, 1990); estimators for categorical (Muthén, 1984) and non-normal data (Browne, 1984; Satorra & Bentler, 1988).', gain: 'SEM for data that are not normal or not continuous (Day 2).', root: 'sem' },
  { year: '1996–2000', who: 'Arbuckle · Muthén · Yuan & Bentler', what: 'Full-information ML for missing data (1996), WLSMV for ordinal items (1997), robust ML (MLR, 2000).', gain: 'The estimators η Lab uses (Day 2).', root: 'sem' },
  { year: '1998', who: 'Linda & Bengt Muthén', what: 'Mplus: a generalized latent variable framework — categorical, multilevel, mixtures.', gain: 'One program for almost every latent variable model.', root: 'sem' },
  { year: '2012', who: 'Yves Rosseel', what: 'lavaan: SEM free and open in R — the software used in η Lab.', gain: 'SEM for everyone with R, and reproducible.', root: 'sem' },
  { year: '2024–25', who: 'Julian Karch', what: 'lavaangui: drawing lavaan models in the browser.', gain: 'From the diagram to the syntax by drawing.', root: 'sem' },
];
export function Timeline() {
  const [open, setOpen] = useState(6);
  return (
    <div className="fig">
      <div className="tl-legend"><span><i className="psy" />measurement: factor analysis (psychometrics)</span><span><i className="path" />structure: path analysis and simultaneous equations</span><span><i className="sem" />both together: SEM</span></div>
      <ol className="timeline">
        {HISTORY.map((h, i) => (
          <li key={h.year + h.who} className={`${h.root} ${open === i ? 'open' : ''}`}>
            <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}><b>{h.year}</b><span>{h.who}</span></button>
            {open === i && <p>{h.what} <span className="tl-gain">What became possible: {h.gain}</span></p>}
          </li>
        ))}
      </ol>
      <p className="hint">After the slides of the Essex SEM course (2024, Day 1) and Tarka (2018), “An overview of structural equation modeling: its beginnings, historical development, usefulness and controversies in the social sciences”.</p>
    </div>
  );
}

// ---------------------------------------------------------------- 3 · the gallery = the map of η Lab
type N = { id: string; t: 'l' | 'o'; x: number; y: number; label?: string };
type E = { a: string; b: string; t?: 'cov' | 'dash'; label?: string };
function Mini({ nodes, edges }: { nodes: N[]; edges: E[] }) {
  const at = (id: string) => nodes.find(n => n.id === id)!;
  return (
    <svg viewBox="0 0 200 110" className="mini" aria-hidden="true">
      <defs><marker id="mn-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink)" /></marker></defs>
      {edges.map((e, i) => {
        const a = at(e.a), b = at(e.b);
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const ra = a.t === 'l' ? 16 : 10, rb = b.t === 'l' ? 16 : 10;
        const x1 = a.x + (dx / len) * ra, y1 = a.y + (dy / len) * ra, x2 = b.x - (dx / len) * rb, y2 = b.y - (dy / len) * rb;
        if (e.t === 'cov') return <path key={i} d={`M${x1} ${y1} Q ${(x1 + x2) / 2 - 22} ${(y1 + y2) / 2} ${x2} ${y2}`} fill="none" className="mn-e" markerStart="url(#mn-a)" markerEnd="url(#mn-a)" />;
        return <g key={i}><line x1={x1} y1={y1} x2={x2} y2={y2} className={`mn-e ${e.t === 'dash' ? 'dash' : ''}`} markerEnd="url(#mn-a)" />{e.label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 3} className="mn-l">{e.label}</text>}</g>;
      })}
      {nodes.map(n => n.t === 'l'
        ? <g key={n.id}><ellipse cx={n.x} cy={n.y} rx="17" ry="12" className="f-lat" /><text x={n.x} y={n.y + 4} className="mn-t">{n.label ?? 'η'}</text></g>
        : <g key={n.id}><rect x={n.x - 9} y={n.y - 8} width="18" height="16" rx="2" className="f-obs" />{n.label && <text x={n.x} y={n.y + 4} className="mn-t sm">{n.label}</text>}</g>)}
    </svg>
  );
}
const ind = (pre: string, f: string, x: number, ys: number[]) => ({ nodes: ys.map((y, i) => ({ id: `${pre}${i}`, t: 'o' as const, x, y })), edges: ys.map((_, i) => ({ a: f, b: `${pre}${i}` })) });
function model(parts: { nodes: N[]; edges: E[] }[]) { return { nodes: parts.flatMap(p => p.nodes), edges: parts.flatMap(p => p.edges) }; }
const GALLERY: { title: string; q: string; days: number[]; m: { nodes: N[]; edges: E[] } }[] = [
  { title: 'One factor (CFA)', q: 'Do these items measure one construct — and how well?', days: [1], m: model([{ nodes: [{ id: 'f', t: 'l', x: 50, y: 55 }], edges: [] }, ind('a', 'f', 150, [20, 45, 70, 95])]) },
  { title: 'Several factors, estimation and fit', q: 'Are two constructs distinct? Does the model fit the data?', days: [2, 3], m: model([{ nodes: [{ id: 'f', t: 'l', x: 50, y: 30 }, { id: 'g', t: 'l', x: 50, y: 82 }], edges: [{ a: 'f', b: 'g', t: 'cov' }] }, ind('a', 'f', 150, [12, 34]), ind('b', 'g', 150, [70, 96])]) },
  { title: 'Restrictions', q: 'Are the items equally good measures (tau-equivalent, parallel)?', days: [3], m: model([{ nodes: [{ id: 'f', t: 'l', x: 50, y: 55 }], edges: [] }, { nodes: [20, 45, 70, 95].map((y, i) => ({ id: `a${i}`, t: 'o' as const, x: 150, y })), edges: [0, 1, 2, 3].map(i => ({ a: 'f', b: `a${i}`, label: 'λ' })) }]) },
  { title: 'Groups and invariance (MGCFA)', q: 'Does the instrument measure the same in every country?', days: [4], m: model([{ nodes: [{ id: 'f', t: 'l', x: 35, y: 55, label: 'BE' }, { id: 'g', t: 'l', x: 120, y: 55, label: 'NL' }], edges: [] }, ind('a', 'f', 80, [25, 55, 85]), ind('b', 'g', 165, [25, 55, 85])]) },
  { title: 'Means and beyond one factor', q: 'Do groups differ in their latent means? Is there a factor above the factors?', days: [5], m: model([{ nodes: [{ id: 'h', t: 'l', x: 35, y: 55, label: 'η₂' }, { id: 'f', t: 'l', x: 100, y: 28 }, { id: 'g', t: 'l', x: 100, y: 82 }], edges: [{ a: 'h', b: 'f' }, { a: 'h', b: 'g' }] }, ind('a', 'f', 170, [15, 40]), ind('b', 'g', 170, [70, 95])]) },
  { title: 'The full structural model', q: 'Do values explain attitudes toward immigration?', days: [6], m: model([{ nodes: [{ id: 'f', t: 'l', x: 45, y: 30 }, { id: 'g', t: 'l', x: 45, y: 82 }, { id: 'h', t: 'l', x: 140, y: 55 }], edges: [{ a: 'f', b: 'h' }, { a: 'g', b: 'h' }, { a: 'f', b: 'g', t: 'cov' }] }, ind('c', 'h', 188, [35, 55, 75])]) },
  { title: 'MIMIC and mediation', q: 'Through which road does an effect travel — directly or via a mediator?', days: [7], m: model([{ nodes: [{ id: 'x', t: 'o', x: 25, y: 85, label: 'x' }, { id: 'f', t: 'l', x: 100, y: 28 }, { id: 'h', t: 'l', x: 170, y: 85 }], edges: [{ a: 'x', b: 'f' }, { a: 'f', b: 'h' }, { a: 'x', b: 'h', t: 'dash' }] }]) },
  { title: 'Moderation', q: 'Is an effect different in different groups, or at different levels of another variable?', days: [8], m: model([{ nodes: [{ id: 'f', t: 'l', x: 40, y: 30 }, { id: 'g', t: 'l', x: 40, y: 85 }, { id: 'i', t: 'l', x: 100, y: 58, label: 'η×η' }, { id: 'h', t: 'l', x: 170, y: 58 }], edges: [{ a: 'f', b: 'h' }, { a: 'g', b: 'h' }, { a: 'i', b: 'h' }] }]) },
  { title: 'Categories and time', q: 'What changes over time — and what causes what across waves?', days: [9], m: model([{ nodes: [{ id: 'a1', t: 'l', x: 40, y: 28, label: 'x₁' }, { id: 'b1', t: 'l', x: 40, y: 85, label: 'y₁' }, { id: 'a2', t: 'l', x: 160, y: 28, label: 'x₂' }, { id: 'b2', t: 'l', x: 160, y: 85, label: 'y₂' }], edges: [{ a: 'a1', b: 'a2' }, { a: 'b1', b: 'b2' }, { a: 'a1', b: 'b2' }, { a: 'b1', b: 'a2' }] }]) },
];
export function ModelGallery() {
  return (
    <div className="gallery">
      {GALLERY.map(g => (
        <a key={g.title} className="card gal-card" href={`#/day/${g.days[0]}`}>
          <Mini {...g.m} />
          <b>{g.title}</b>
          <span>{g.q}</span>
          <small>Day {g.days.join(' and ')} · {DAYS.find(d => d.n === g.days[0])?.title}</small>
        </a>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 4 · grammar of diagrams
const RELATIONS: { id: string; label: string; means: string; code: string; draw: ReactNode }[] = [
  { id: 'cov', label: 'correlation', means: 'The two go together; the model says nothing about why.', code: 'Values ~~ Attitude', draw: <path d="M100 40 Q 170 10 240 40" className="gr-e" markerStart="url(#gr-a)" markerEnd="url(#gr-a)" fill="none" /> },
  { id: 'right', label: 'effect →', means: 'Values cause the attitude: a change in values changes the attitude, not the other way round.', code: 'Attitude ~ Values', draw: <line x1="100" y1="50" x2="236" y2="50" className="gr-e" markerEnd="url(#gr-a)" /> },
  { id: 'left', label: '← effect', means: 'The attitude causes the values.', code: 'Values ~ Attitude', draw: <line x1="240" y1="50" x2="104" y2="50" className="gr-e" markerEnd="url(#gr-a)" /> },
  { id: 'fb', label: 'feedback', means: 'Each causes the other (a non-recursive model: needs extra identifying assumptions).', code: 'Attitude ~ Values\nValues ~ Attitude', draw: <><line x1="100" y1="44" x2="236" y2="44" className="gr-e" markerEnd="url(#gr-a)" /><line x1="240" y1="58" x2="104" y2="58" className="gr-e" markerEnd="url(#gr-a)" /></> },
  { id: 'none', label: 'no arrow', means: 'No relation at all — the strongest claim of the four: the covariance is fixed to 0.', code: 'Values ~~ 0*Attitude', draw: null },
];
export function Grammar() {
  const [r, setR] = useState('right');
  const rel = RELATIONS.find(x => x.id === r)!;
  return (
    <div className="fig">
      <div className="fig-row">
        <div>
          <table className="rp-table left grammar">
            <tbody>
              <tr><td><svg width="44" height="26" aria-hidden="true"><ellipse cx="22" cy="13" rx="20" ry="11" className="f-lat" /></svg></td><td><b>latent variable</b> (factor, construct) — not observed</td></tr>
              <tr><td><svg width="44" height="26" aria-hidden="true"><rect x="8" y="3" width="28" height="20" rx="2" className="f-obs" /></svg></td><td><b>indicator</b> — an observed variable, an item</td></tr>
              <tr><td><svg width="44" height="26" aria-hidden="true"><circle cx="22" cy="13" r="10" fill="var(--card)" stroke="var(--ink)" strokeWidth="1.6" /><text x="22" y="17" textAnchor="middle" fontSize="11">ε</text></svg></td><td><b>error</b> — everything in an item that is not its factor</td></tr>
              <tr><td><svg width="44" height="26" aria-hidden="true"><path d="M8 18 L22 5 L36 18 Z" fill="var(--card)" stroke="var(--ink)" strokeWidth="1.6" /><text x="22" y="16" textAnchor="middle" fontSize="9">1</text></svg></td><td><b>constant</b> — for means and intercepts (Day 1, step 8)</td></tr>
              <tr><td><svg width="44" height="26" aria-hidden="true"><path d="M14 22 C 6 2 38 2 30 22" fill="none" stroke="var(--ink)" strokeWidth="1.6" markerEnd="url(#gr-a)" /></svg></td><td><b>variance</b> — a curved arrow from a variable back to itself (ψ for a factor)</td></tr>
              <tr><td><svg width="44" height="26" aria-hidden="true"><text x="6" y="17" fontSize="12" fontWeight="700">ζ</text><line x1="16" y1="13" x2="38" y2="13" stroke="var(--ink)" strokeWidth="1.6" markerEnd="url(#gr-a)" /></svg></td><td><b>disturbance</b> ζ — what the causes of a latent variable leave unexplained (Part 2)</td></tr>
              <tr><td><svg width="44" height="26" aria-hidden="true"><line x1="4" y1="13" x2="38" y2="13" stroke="var(--ink)" strokeWidth="1.6" markerEnd="url(#gr-a)" /><text x="20" y="9" textAnchor="middle" fontSize="10" fontWeight="700">1</text></svg></td><td><b>fixed value</b> — a number on an arrow is not estimated: the 1 gives a factor its unit</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <div className="seg wrap" role="group" aria-label="Relation">{RELATIONS.map(x => <button key={x.id} aria-pressed={r === x.id} onClick={() => setR(x.id)}>{x.label}</button>)}</div>
          <svg viewBox="0 0 340 100" className="fig-svg" role="img" aria-label={`Values and attitude: ${rel.label}`}>
            <defs><marker id="gr-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink)" /></marker></defs>
            <ellipse cx="55" cy="50" rx="48" ry="26" className="f-lat" /><text x="55" y="55" className="f-lbl c b">Values</text>
            <ellipse cx="285" cy="50" rx="48" ry="26" className="f-lat" /><text x="285" y="55" className="f-lbl c b">Attitude</text>
            {rel.draw}
          </svg>
          <p>{rel.means}</p>
          <pre className="syntax"><code>{rel.code}</code></pre>
        </div>
      </div>
      <p className="hint">After the slides of the Essex SEM course (2024, Day 1): correlation, one-directional path, feedback — and no relation. In a path diagram, what you do not draw is an assumption too.</p>
    </div>
  );
}

// ---------------------------------------------------------------- 5b · the full model's matrices, with lavaan's output
const LISREL: { lisrel: string; lavaan: string; what: string }[] = [
  { lisrel: 'Λy, Λx', lavaan: 'lambda', what: 'loadings: items on their factors' },
  { lisrel: 'Θε, Θδ', lavaan: 'theta', what: 'error variances and covariances of the items' },
  { lisrel: 'Φ (exogenous), Ψ (residuals)', lavaan: 'psi', what: '(co)variances of the factors, or of what the structural part leaves unexplained' },
  { lisrel: 'B, Γ', lavaan: 'beta', what: 'regressions among the factors (B: of endogenous on endogenous, Γ: on exogenous)' },
  { lisrel: 'τ (intercepts), κ / α (means)', lavaan: 'nu, alpha', what: 'intercepts τ of the items and means κ of the factors (notation used here, Days 1 and 5)' },
];
function RealGrid({ m, name }: { m: Mat; name: string }) {
  const lower = name === 'psi' || name === 'theta';   // symmetric: show the lower triangle only
  return (
    <div className="mw-grid">
      <div className="mw-name"><code>{name}</code></div>
      <table>
        <thead><tr><th />{m.cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{m.values.map((row, r) => <tr key={r}><th>{m.rows[r]}</th>{row.map((v, c) => <td key={c}><span className={lower && c > r ? 'mw-blank' : Math.abs(v) < 1e-9 ? 'fixed0' : v === 1 && name === 'lambda' ? 'fixed1' : 'free'}>{lower && c > r ? '' : v === 0 ? '0' : v.toFixed(2)}</span></td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
export function FullModelMatrices({ d }: { d: MapData | null }) {
  const [which, setWhich] = useState<'cfa' | 'sem'>('sem');
  if (!d) return <p className="hint">Loading lavaan’s matrices…</p>;
  const m = d[which].matrices;
  return (
    <div className="fig">
      <table className="rp-table left">
        <thead><tr><th>LISREL (notation used here)</th><th>lavaan</th><th>holds</th></tr></thead>
        <tbody>{LISREL.map(r => <tr key={r.lavaan}><td>{r.lisrel}</td><td><code>{r.lavaan}</code></td><td>{r.what}</td></tr>)}</tbody>
      </table>
      <p className="hint">LISREL separates exogenous (ξ, x) from endogenous (η, y) variables and so needs eight matrices; lavaan calls every latent variable η and needs fewer. The model is the same.</p>
      <div className="seg" role="group" aria-label="Model">
        <button aria-pressed={which === 'cfa'} onClick={() => setWhich('cfa')}>Day 2: two factors</button>
        <button aria-pressed={which === 'sem'} onClick={() => setWhich('sem')}>Part 2: values → allow</button>
      </div>
      <pre className="syntax"><code>{which === 'cfa'
        ? `trco_univ_fit %>% lavInspect(what = "est")`
        : `values_allow_fit <- sem(\n  model = "\n    TRCO  =~ ipmodst + imptrad + ipfrule + ipbhprp\n    UNIV  =~ ipeqopt + ipudrst + impenv\n    ALLOW =~ imsmetn + imdfetn + impcntr\n    ALLOW ~ TRCO + UNIV\n  ",\n  data = NL2, estimator = "MLR", missing = "fiml.x"\n)\n\nvalues_allow_fit %>% lavInspect(what = "est")`}</code></pre>
      <div className="mw-mats real">
        <RealGrid m={m.lambda} name="lambda" />
        <RealGrid m={m.psi} name="psi" />
        {m.beta && <RealGrid m={m.beta} name="beta" />}
      </div>
      <div className="mw-mats real"><RealGrid m={m.theta} name="theta" /></div>
      <p className="hint">{which === 'sem'
        ? <>The structural part lives in <code>beta</code>. Read it as <b>row ← column</b>: row ALLOW, columns TRCO ({m.beta?.values[2][0].toFixed(2)}) and UNIV ({m.beta?.values[2][1].toFixed(2)}) — ALLOW ← TRCO and ALLOW ← UNIV, the two regression arrows. In <code>psi</code>, the 0.35 of ALLOW is no longer its variance but its residual variance: what the values leave unexplained. (Allow items reversed: higher = allow more. Scaled χ²({d.sem.fit.df}) = {d.sem.fit['chisq.scaled'].toFixed(1)}, robust CFI {d.sem.fit['cfi.robust'].toFixed(3)}.) <code>theta</code> holds the ten error variances on its diagonal — and zeros elsewhere: no error covariances were drawn.</>
        : <>The zeros in <code>lambda</code> are the cross-loadings you did not draw; the 1s fix the unit of each factor. <code>theta</code> holds the seven error variances on its diagonal.</>}</p>
      <details className="deeper">
        <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>The equations of the full model</span></summary>
        <div className="deeper-body">
          <div className="sc-formula"><Tex block>{'\\text{measurement: } y = \\tau + \\Lambda\\eta + \\varepsilon \\qquad \\text{structure: } \\eta = \\kappa + B\\eta + \\zeta'}</Tex></div>
          <p className="hint">τ are the item intercepts (lavaan: <code>nu</code>), κ the latent means or intercepts (lavaan: <code>alpha</code>). η Lab keeps ν for the thresholds of ordinal items (Day 2, section 9).</p>
          <p>Solving the structure for η and putting it into the measurement part gives the covariance matrix the whole model implies:</p>
          <div className="sc-formula"><Tex block>{'\\Sigma(\\theta) = \\Lambda\\,(I - B)^{-1}\\,\\Psi\\,(I - B)^{-1\\,\\prime}\\,\\Lambda^{\\prime} + \\Theta'}</Tex></div>
          <p>Without regressions among the factors, B = 0, (I − B)⁻¹ = I, and the formula shrinks to the CFA of the workshop above: Σ = ΛΨΛ′ + Θ. Part 2 adds B — the rest is the same machinery.</p>
        </div>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------- the strip on every day page
export function MapStrip({ current }: { current: number }) {
  return (
    <a className="map-strip" href="#/map#course" title="Where this day sits on the map of SEM">
      <span className="ms-lbl">On the map</span>
      <span className="ms-seg meas">{[1, 2, 3, 4, 5].map(n => <i key={n} className={n === current ? 'on' : n < current ? 'past' : ''}>{n}</i>)}<small>measurement</small></span>
      <span className="ms-seg struct">{[6, 7, 8, 9, 10].map(n => <i key={n} className={n === current ? 'on' : n < current ? 'past' : ''}>{n}</i>)}<small>structure</small></span>
    </a>
  );
}
