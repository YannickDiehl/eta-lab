// Station 13 · Mediation
// An effect can travel along more than one road. X → M → Y splits the total effect into a
// direct and an indirect part; the indirect part is a product, its sampling distribution is
// skewed, and so the course reports bootstrap intervals rather than the Sobel test.
import { useEffect, useMemo, useState } from 'react';
import { Beat, Choose, Explain, Formula, Metric, Slider, StationHead, Tex, Yours, fmt } from '../components/ui.tsx';
import { groupsFor, loadCourseData, type CourseData } from '../data/course.ts';
import { fitModel, type Fitted } from '../math/sem.ts';
import { mediationPaths, structure } from '../model/diagram.ts';
import { TEMPLATES, templateDiagram } from '../studio/templates.ts';
import { markDone, type YourModel } from '../state.ts';
import { effects, monteCarlo, possible, type Paths } from './mediation-sim.ts';

const touch = () => markDone('s13');
const p3 = (p: number) => (p < 0.001 ? '< .001' : `= ${p.toFixed(3).replace(/^0/, '')}`);

/** X, M and Y with the three paths. */
function Triangle({ p }: { p: Paths }) {
  const W = 420, H = 210;
  const pos = { X: [60, 170], M: [210, 46], Y: [360, 170] } as const;
  const arrow = (from: keyof typeof pos, to: keyof typeof pos, v: number, name: string) => {
    const [x1, y1] = pos[from], [x2, y2] = pos[to];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const sx = x1 + ux * 40, sy = y1 + uy * 26, ex = x2 - ux * 44, ey = y2 - uy * 30;
    const mx = (sx + ex) / 2, my = (sy + ey) / 2;
    const w = 1.5 + Math.abs(v) * 7;
    return (
      <g>
        <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={v < 0 ? 'var(--neg)' : 'var(--ink)'} strokeWidth={w} markerEnd="url(#s13-head)" strokeOpacity={Math.abs(v) < 0.02 ? 0.25 : 1} style={{ transition: 'stroke-width .3s' }} />
        {(() => {
          // the label sits beside the arrow, on the side away from the triangle's centre
          let nx = -uy, ny = ux;
          if ((mx - 210) * nx + (my - 129) * ny < 0) { nx = -nx; ny = -ny; }
          return <text className="lbl" x={mx + nx * 16} y={my + ny * 16 + 5} textAnchor={Math.abs(nx) < 0.3 ? 'middle' : nx < 0 ? 'end' : 'start'}>{name} = {fmt(v)}</text>;
        })()}
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`X to M ${fmt(p.a)}, M to Y ${fmt(p.b)}, X to Y directly ${fmt(p.c)}`}>
      <defs><marker id="s13-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--ink)" /></marker></defs>
      {arrow('X', 'M', p.a, 'a')}{arrow('M', 'Y', p.b, 'b')}{arrow('X', 'Y', p.c, 'c′')}
      {(['X', 'M', 'Y'] as const).map(k => (
        <g key={k}>
          <rect x={pos[k][0] - 38} y={pos[k][1] - 24} width="76" height="48" rx="10" fill={k === 'M' ? 'var(--sun)' : 'var(--obs)'} stroke="var(--ink)" strokeWidth="2" />
          <text className="lbl-d" x={pos[k][0]} y={pos[k][1] + 6} textAnchor="middle">{k}</text>
        </g>
      ))}
    </svg>
  );
}

/** The sampling distribution of a·b, with the Sobel and the Monte Carlo interval. */
function Spread({ draws, sobel, mc, ab }: { draws: number[]; sobel: [number, number]; mc: [number, number]; ab: number }) {
  const W = 420, H = 160, B = 44;
  const lo = Math.min(draws[Math.floor(draws.length * 0.002)], sobel[0], 0), hi = Math.max(draws[Math.floor(draws.length * 0.998)], sobel[1], 0);
  const x = (v: number) => 12 + ((v - lo) / (hi - lo || 1)) * (W - 24);
  const bins = new Array(B).fill(0);
  draws.forEach(v => { const k = Math.floor(((v - lo) / (hi - lo || 1)) * B); if (k >= 0 && k < B) bins[k]++; });
  const top = Math.max(...bins), bw = (W - 24) / B;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Sampling distribution of the indirect effect. Monte Carlo 95% interval ${fmt(mc[0], 3)} to ${fmt(mc[1], 3)}; Sobel ${fmt(sobel[0], 3)} to ${fmt(sobel[1], 3)}.`}>
      {bins.map((c, k) => { const h = (c / top) * 80; return h > 0.5 && <rect key={k} x={12 + k * bw + 1} y={92 - h} width={Math.max(bw - 2, 1)} height={h} rx="1.5" fill="var(--sun)" stroke={h > 3 ? 'var(--ink)' : 'none'} strokeWidth=".8" />; })}
      <line x1="12" x2={W - 12} y1="92.5" y2="92.5" stroke="var(--ink)" strokeWidth="1.2" />
      <line x1={x(0)} x2={x(0)} y1="8" y2="96" stroke="var(--muted)" strokeDasharray="3 3" />
      <text className="lbl-s" x={x(0)} y="8" textAnchor="middle">0</text>
      <text className="lbl-s" x={x(mc[0])} y="110" style={{ fill: 'var(--pos)', fontWeight: 800 }}>Monte Carlo 95%</text>
      <line x1={x(mc[0])} x2={x(mc[1])} y1="118" y2="118" stroke="var(--pos)" strokeWidth="5" strokeLinecap="round" />
      <text className="lbl-s" x={x(sobel[0])} y="140" style={{ fill: 'var(--link)', fontWeight: 800 }}>Sobel (symmetric)</text>
      <line x1={x(sobel[0])} x2={x(sobel[1])} y1="148" y2="148" stroke="var(--link)" strokeWidth="5" strokeLinecap="round" />
      <circle cx={x(ab)} cy="118" r="4" fill="var(--ink)" /><circle cx={x(ab)} cy="148" r="4" fill="var(--ink)" />
    </svg>
  );
}

function useCourse() {
  const [data, setData] = useState<CourseData | null>(null);
  useEffect(() => { loadCourseData().then(setData).catch(() => setData(null)); }, []);
  return data;
}

export function S13Mediation({ model }: { model: YourModel }) {
  const [p, setP] = useState<Paths>({ a: 0.3, b: 0.25, c: 0.05, n: 150 });
  const set = (q: Partial<Paths>) => { const next = { ...p, ...q }; if (possible(next)) { setP(next); touch(); } };
  const e = effects(p);
  const mc = useMemo(() => monteCarlo(p), [p]);
  const sobelSig = e.sobel[0] > 0 || e.sobel[1] < 0, mcSig = mc.ci[0] > 0 || mc.ci[1] < 0;
  const share = e.total !== 0 && Math.sign(e.ab) === Math.sign(e.total) ? e.ab / e.total : NaN;

  // the course model on the ESS 2004
  const data = useCourse();
  const tm = TEMPLATES.find(t => t.title.startsWith('Mediation'))!;
  const d = useMemo(() => templateDiagram(tm), [tm]);
  const real = useMemo(() => {
    if (!data) return null;
    const r = fitModel(d, { groups: groupsFor(data, 'ess2004', 'pooled', 'none') });
    return r.ok ? r : null;
  }, [data, d]);
  const L = (id: string) => d.nodes.find(n => n.id === id)?.label ?? id;
  const set0 = real?.effects.find(x => L(x.from) === 'Universalism' && L(x.to) === 'Allow');
  const pathStd = (f: Fitted | null, from: string, to: string) => f?.params.find(q => q.op === '~' && L(q.rhs) === from && L(q.lhs) === to);
  const direct = pathStd(real, 'Universalism', 'Allow');

  // your model
  const yours = useMemo(() => {
    const s = structure(model.diagram);
    const nm = (id: string) => model.diagram.nodes.find(n => n.id === id)?.label || s.names.get(id) || id;
    return mediationPaths(s).map(m => ({ from: nm(m.from), to: nm(m.to), via: m.indirect.map(path => path.slice(0, -1).map(e2 => nm(e2.to)).join(' → ')), direct: !!m.direct }));
  }, [model.diagram]);

  return (
    <article>
      <StationHead kicker="Station 13 · Mediation" title="Mediation"
        lead="An effect can travel along more than one road. Mediation splits it: what X does to Y directly, and what it does by changing M first." />

      <Beat kind="wonder" title="Does universalism matter?">
        <Choose onDone={touch} answer={1}
          question={`In the ESS 2004 (Benelux), the direct path from universalism to allowing immigrants is ${direct ? `β = ${fmt(direct.std)} (p ${p3(direct.p)})` : 'almost zero'} once we account for how people see the effects of immigration. Does universalism matter for immigration attitudes?`}
          options={['No — its path to “allow” is not significant.', 'Yes — mostly through how people see the effects of immigration.', 'We cannot say anything without an experiment.']}
          explain={<>The direct path is only part of the story. Universalism shapes how people judge the effects of immigration{set0 ? <> (the indirect effect is β = {fmt(set0.specific[0]?.std ?? set0.indirect.std)}, {Number.isFinite(set0.indirect.std / set0.total.std) ? `${Math.round((100 * set0.indirect.std) / set0.total.std)} %` : 'most'} of the total)</> : null}, and those judgements drive what people want. A missing direct path does not mean a missing effect. Whether this is causal is another question — see below.</>} />
      </Beat>

      <Beat kind="play" title="Build a mediator">
        <div className="card play">
          <div className="play-grid">
            <div>
              <Triangle p={p} />
              <div className="metrics">
                <Metric label="Direct c′" value={fmt(p.c)} />
                <Metric label="Indirect a·b" value={fmt(e.ab, 3)} />
                <Metric label="Total c = c′ + a·b" value={fmt(e.total, 3)} />
              </div>
              <p className="hint">{Number.isFinite(share) && share <= 1 ? `${Math.round(share * 100)} % of the total effect runs through M.` : Math.sign(e.ab) !== Math.sign(p.c) && Math.abs(e.ab) > 0.01 && Math.abs(p.c) > 0.01 ? 'Direct and indirect effect pull in opposite directions: the total hides both (inconsistent mediation).' : ''}</p>
            </div>
            <div>
              <Slider label="a: X → M" min={-0.55} max={0.55} step={0.05} value={p.a} onChange={v => set({ a: v })} format={v => fmt(v)} />
              <Slider label="b: M → Y" min={-0.55} max={0.55} step={0.05} value={p.b} onChange={v => set({ b: v })} format={v => fmt(v)} />
              <Slider label="c′: X → Y" min={-0.55} max={0.55} step={0.05} value={p.c} onChange={v => set({ c: v })} format={v => fmt(v)} />
              <Slider label="Sample size n" min={40} max={2000} step={10} value={p.n} onChange={v => set({ n: v })} format={v => v.toLocaleString('en')} />
              <p className="mx-cap" style={{ marginTop: 10 }}>How a·b varies from sample to sample (4,000 draws):</p>
              <Spread draws={mc.draws} sobel={e.sobel} mc={mc.ci} ab={e.ab} />
              <p className="hint">{sobelSig === mcSig
                ? `Both intervals ${mcSig ? 'exclude' : 'include'} zero (Sobel z = ${e.z.toFixed(2)}).`
                : `The intervals disagree: the Sobel test says ${sobelSig ? 'significant' : 'not significant'}, the Monte Carlo interval ${mcSig ? 'excludes' : 'includes'} zero. Small samples and small paths make a·b skewed — try n = 80 with a = b = .25.`}</p>
            </div>
          </div>
        </div>
      </Beat>

      <Beat kind="play" title="Universalism, effects, allow — on the ESS">
        <div className="card play">
          {!real ? <p className="hint">Loading the ESS 2004…</p> : (
            <>
              <p className="mx-cap">Universalism → perceived effects of immigration → allowing immigrants, three latent variables, controlling for age (n = {real.N.toLocaleString('en')}). Standardized.</p>
              <table className="rp-table effects-table">
                <thead><tr><th>Effect</th><th>Std.</th><th>p</th></tr></thead>
                <tbody>
                  {set0 && <>
                    {set0.direct && <tr className={set0.direct.p >= .05 ? 'weak' : ''}><td>Direct: universalism → allow</td><td>{fmt(set0.direct.std, 3)}</td><td>{p3(set0.direct.p)}</td></tr>}
                    {set0.specific.map((sp, i) => <tr key={i}><td>Indirect: via {sp.path.slice(1, -1).map(L).join(' → ')}</td><td>{fmt(sp.std, 3)}</td><td>{p3(sp.p)}</td></tr>)}
                    <tr className="on"><td>Total</td><td>{fmt(set0.total.std, 3)}</td><td>{p3(set0.total.p)}</td></tr>
                  </>}
                </tbody>
              </table>
              <p className="hint">The same model is the Day 7 course model in the studio (Data → Course models), where Results → Effects shows these numbers and the lavaan tab writes the <code>:=</code> lines and the bootstrap call.</p>
            </>
          )}
        </div>
      </Beat>

      <Beat kind="explain" title="One effect, two roads">
        <Explain>
          <p>The <b>total effect</b> c is what X does to Y altogether. It splits into the <b>direct effect</b> c′ and the <b>indirect effect</b> a·b. Judge mediation by the indirect effect and its confidence interval — not by whether c′ drops below significance. Labels like “full” and “partial” mediation say more about the sample size than about the process (Zhao, Lynch & Chen, 2010).</p>
          <p>A product of two estimates is not normally distributed, so the Sobel test’s symmetric interval is wrong exactly when it matters: small samples, small paths. Bootstrap (or Monte Carlo) intervals follow the real shape. And latent variables help twice: measurement error in M weakens b and leaks into c′ — the problem from station 1.2.</p>
          <p>The numbers are causal only under strong assumptions: X comes before M, M before Y, and nothing unmeasured drives both M and Y. With cross-sectional data like the ESS, the order is an argument, not a fact (Maxwell & Cole, 2007).</p>
        </Explain>
      </Beat>

      <Beat kind="formula" title="Products and their standard error">
        <Formula plug={<Tex block>{`${fmt(e.total, 3)} = ${fmt(p.c)} + ${fmt(p.a)} \\times ${fmt(p.b)}, \\qquad SE_{ab} = \\sqrt{${fmt(p.a)}^2 \\cdot ${e.seB.toFixed(3)}^2 + ${fmt(p.b)}^2 \\cdot ${e.seA.toFixed(3)}^2} = ${e.seAB.toFixed(3)}`}</Tex>}>
          <Tex block>{"c = c' + a\\,b, \\qquad SE_{ab} \\approx \\sqrt{a^2\\,SE_b^2 + b^2\\,SE_a^2}"}</Tex>
          <p className="hint">In lavaan, label the paths and define the effects: <code>M ~ a*X</code>, <code>Y ~ b*M + c*X</code>, <code>ind := a*b</code>, <code>total := c + a*b</code>. Then <code>se = "bootstrap"</code> and <code>parameterEstimates(fit, boot.ci.type = "perc")</code> give percentile intervals.</p>
        </Formula>
      </Beat>

      <Beat kind="yours" title="The roads in your model">
        <Yours>
          {yours.length ? (
            <>
              <p>Your model has {yours.length === 1 ? 'one effect' : `${yours.length} effects`} with an indirect road:</p>
              <ul>{yours.map((m, i) => <li key={i}><b>{m.from} → {m.to}</b>: via {m.via.join('; via ')}{m.direct ? ', plus a direct path' : ', no direct path'}</li>)}</ul>
              <p className="verdict">The studio splits each into direct, indirect and total (Results → Effects) and writes the bootstrap code. Before you interpret them, write down why X comes before M, and M before Y.</p>
            </>
          ) : <p>Your model has no chain X → M → Y yet. Draw one in the studio — a regression into a variable that itself predicts another — and the studio will split the effect for you.</p>}
        </Yours>
      </Beat>
    </article>
  );
}
