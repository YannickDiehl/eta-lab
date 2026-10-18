// Station 11 · Two rulers
// Measurement invariance as a question about the instrument: before comparing countries,
// check that the items measure the same thing everywhere. A sandbox bends one item in one
// country; the real Benelux data then show the same pattern — and what it does to the means.
import { useEffect, useMemo, useState } from 'react';
import { Beat, Choose, Explain, Formula, LoadError, Metric, Slider, StationHead, Tex, Yours, fmt } from '../components/ui.tsx';
import { groupsFor, loadCourseData, type CourseData } from '../data/course.ts';
import { fitModel, type Fitted } from '../math/sem.ts';
import { fromLavaan, structure } from '../model/diagram.ts';
import { ladder, LEVELS, locks, type Level } from '../model/invariance.ts';
import { constructName, markDone, type YourModel } from '../state.ts';
import { BIASED, FAIR, ITEMS, LABELS, POP, RELEASE, itemMeans, naiveMean, runLadder, type World } from './invariance-sim.ts';

const TITLE: Record<Level, string> = { configural: 'Configural', metric: 'Metric', scalar: 'Scalar', strict: 'Strict' };
const ALLOWS: Record<Level, string> = { configural: 'the same pattern', metric: 'relations', scalar: 'factor means (and mean scores, if every item is invariant)', strict: 'sum-score variances and reliabilities' };
const cfiClass = (d: number) => (d < -0.01 ? 'poor' : 'good');
const touch = () => markDone('s11');

function LadderTable({ rungs, labels }: { rungs: Fitted[]; labels?: boolean }) {
  return (
    <table className="rp-table">
      <thead><tr><th>Level</th><th>χ²</th><th>df</th><th>CFI</th><th>ΔCFI</th>{labels && <th>allows comparing</th>}</tr></thead>
      <tbody>
        {rungs.map((r, i) => {
          const d = i ? r.cfi - rungs[i - 1].cfi : NaN;
          return (
            <tr key={i}>
              <td>{TITLE[LEVELS[i]]}</td><td>{r.chisq.toFixed(1)}</td><td>{r.df}</td><td>{r.cfi.toFixed(3)}</td>
              <td className={i ? cfiClass(d) : ''}>{i ? d.toFixed(3) : '–'}</td>
              {labels && <td>{ALLOWS[LEVELS[i]]}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Four items on their answer scale: where country A and country B land on average. */
function Rulers({ w }: { w: World }) {
  const [a, b] = itemMeans(w);
  const lo = 2.8, hi = 5.6, W = 460, x = (v: number) => 104 + ((v - lo) / (hi - lo)) * (W - 124);
  return (
    <svg viewBox={`0 0 ${W} ${ITEMS.length * 54 + 44}`} width="100%" role="img"
      aria-label={`Average answers: ${LABELS.map((l, i) => `${l} A ${a[i].toFixed(2)}, B ${b[i].toFixed(2)}`).join('; ')}`}>
      {LABELS.map((l, i) => {
        const y = 28 + i * 54, bias = i === BIASED && Math.abs(w.bias) > 0.001;
        return (
          <g key={l}>
            <text className="lbl" x="8" y={y + 5} style={{ fontWeight: i === BIASED ? 800 : 600 }}>{l}</text>
            <line x1={x(lo)} x2={x(hi)} y1={y} y2={y} stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
            {[3, 4, 5].map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1={y - 5} y2={y + 5} stroke="var(--ink)" strokeWidth="1.5" /><text className="lbl-s" x={x(t)} y={y + 20} textAnchor="middle">{t}</text></g>)}
            {bias && <line x1={x(b[i] - w.bias)} x2={x(b[i])} y1={y - 12} y2={y - 12} stroke="var(--neg)" strokeWidth="3" markerEnd="url(#s11-arrow)" />}
            <circle cx={x(a[i])} cy={y} r="8" fill="var(--latent)" stroke="var(--ink)" strokeWidth="2" style={{ transition: 'cx .4s ease' }} />
            <circle cx={x(b[i])} cy={y} r="8" fill="var(--obs)" stroke="var(--ink)" strokeWidth="2" style={{ transition: 'cx .4s ease' }} />
          </g>
        );
      })}
      <defs><marker id="s11-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--neg)" /></marker></defs>
      <text className="lbl-s" x="8" y={ITEMS.length * 54 + 20}>lavender = country A · peach = country B</text>
      <text className="lbl-s" x="8" y={ITEMS.length * 54 + 38} style={{ fill: 'var(--neg)' }}>red arrow = the part of the gap that is the item, not the people</text>
    </svg>
  );
}

// ---- the real data: tradition and conformity in the Benelux, ESS 2004
const REAL = { ...fromLavaan(`Tradition =~ ${ITEMS.join(' + ')}`).diagram, stdlv: true };
const REAL_S = structure(REAL);
const REAL_INT = locks(REAL_S).filter(l => l.kind === 'intercept');

function useCourse() {
  const [data, setData] = useState<CourseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadCourseData().then(setData).catch(e => setError((e as Error).message)); }, []);
  return { data, error };
}

export function S11TwoRulers({ model }: { model: YourModel }) {
  const [w, setW] = useState<World>({ ...FAIR, bias: 0.5 });
  const [rel, setRel] = useState({ intercept: false, loading: false });
  const free = [...(rel.intercept ? [RELEASE.intercept] : []), ...(rel.loading ? [RELEASE.loading] : [])];
  const sim = useMemo(() => runLadder(w, free), [w, rel]);   // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<World>) => { setW(x => ({ ...x, ...p })); touch(); };
  const metricBreaks = sim.rungs[1] && sim.rungs[1].cfi - sim.rungs[0].cfi < -0.01;
  const scalarBreaks = sim.rungs[2] && sim.rungs[2].cfi - sim.rungs[1].cfi < -0.01;

  // real data
  const { data, error } = useCourse();
  const [released, setReleased] = useState<string[]>([]);
  const groups = useMemo(() => (data ? groupsFor(data, 'ess2004', 'pooled', 'country') : null), [data]);
  const real = useMemo(() => groups && LEVELS.map(level => fitModel(REAL, { groups, level, free: released })).filter((r): r is Fitted => r.ok), [groups, released]);
  const meansAt = (f?: Fitted) => (f ? [1, 2].map(g => f.params.find(p => p.group === g && p.op === '~1' && p.lhs === REAL_S.latent[0])?.est ?? NaN) : []);
  const fullScalar = useMemo(() => (groups ? fitModel(REAL, { groups, level: 'scalar' }) : null), [groups]);
  const realMeans = meansAt(real?.[2]);
  const naiveMeans = fullScalar?.ok ? meansAt(fullScalar) : [];
  const anchors = REAL_INT.length - released.length;
  const nl = groups?.findIndex(x => x.label === 'Netherlands') ?? -1, be = groups?.findIndex(x => x.label === 'Belgium') ?? -1;
  const itemMean = (g: number, v: string) => (groups && g >= 0 ? groups[g].means[groups[g].names.indexOf(v)] : NaN);
  // what releasing each remaining intercept would buy (and do to the Dutch mean)
  const probe = useMemo(() => (groups ? new Map(REAL_INT.filter(l => !released.includes(l.key)).map(l => {
    const f = fitModel(REAL, { groups, level: 'scalar', free: [...released, l.key] });
    return [l.key, f.ok ? { cfi: f.cfi, nl: meansAt(f)[1] } : null] as const;
  })) : null), [groups, released]);   // eslint-disable-line react-hooks/exhaustive-deps
  const spread = probe ? [...probe.values()].filter(Boolean).map(x => x!.nl) : [];

  // your model
  const d = model.diagram, g = model.groups;
  const yours = useMemo(() => (structure(d).latent.length ? ladder(d, Math.max(g.names.length, 2), g.free, g.level) : null), [d, g]);
  const modest = BIASED;

  return (
    <article>
      <StationHead kicker="Station 11 · Measurement invariance" title="Two rulers"
        lead="Comparing countries, men and women, or age groups assumes that the questionnaire is the same ruler for all of them. That is a claim you can test — rung by rung." />

      <Beat kind="wonder" title="More traditional, or less?">
        <Choose onDone={touch} answer={2}
          question={`In the ESS 2004, Dutch respondents value being modest much less than Belgians (${fmt(itemMean(nl, 'ipmodst'))} vs ${fmt(itemMean(be, 'ipmodst'))} on the 1–6 scale) — but agree more that people should follow rules (${fmt(itemMean(nl, 'ipfrule'))} vs ${fmt(itemMean(be, 'ipfrule'))}). Are the Dutch more or less traditional?`}
          options={['Less — the gap in modesty is the largest.', 'More — following rules is the core of conformity.', 'That depends on which items work the same way in both countries — it has to be tested.']}
          explain={<>An item’s average mixes two things: how traditional people are <i>and</i> how easy the item is to agree with in that country. When items disagree like this, at least one of them is not the same ruler in both countries. Below you will see that the answer swings from “equally traditional” to “clearly less” — depending on which item you decide to distrust.</>} />
      </Beat>

      <Beat kind="play" title="Bend one ruler">
        <div className="card play">
          <div className="play-grid">
            <div>
              <p className="mx-cap">Average answers to four items in two countries (1,000 people each).</p>
              <Rulers w={w} />
              <div className="metrics">
                <Metric label="True difference (B − A)" value={fmt(w.kappa)} />
                <Metric label="Item averages suggest" value={fmt(naiveMean(w))} />
                <Metric label="Scalar model estimates" value={sim.mean === null ? '–' : fmt(sim.mean)} />
              </div>
              <p className="hint">Differences in standard deviations of tradition in country A.</p>
            </div>
            <div>
              <Slider label="B more traditional by" min={-0.6} max={0.6} step={0.05} value={w.kappa} onChange={v => set({ kappa: v })} format={v => fmt(v)} />
              <Slider label="“modest” easier in B by" min={-0.8} max={0.8} step={0.05} value={w.bias} onChange={v => set({ bias: v })} format={v => fmt(v)} />
              <Slider label="“modest” loading in B" min={0.2} max={1.3} step={0.05} value={w.loadB} onChange={v => set({ loadB: v })} format={v => fmt(v)} />
              <p className="hint" style={{ margin: '2px 0 8px' }}>In country A, “modest” loads {POP.lambda[modest].toFixed(2)}.</p>
              <LadderTable rungs={sim.rungs} />
              <div className="row" style={{ marginTop: 10, gap: 14 }}>
                <label className="chk"><input type="checkbox" checked={rel.loading} onChange={e => { setRel(r => ({ ...r, loading: e.target.checked })); touch(); }} /> free the loading of “modest”</label>
                <label className="chk"><input type="checkbox" checked={rel.intercept} onChange={e => { setRel(r => ({ ...r, intercept: e.target.checked })); touch(); }} /> free its intercept</label>
              </div>
              <p className="hint">{metricBreaks ? 'The metric rung fails: “modest” is tied more or less strongly to tradition in B. Relations involving the factor are not comparable yet.'
                : scalarBreaks ? `The scalar rung fails: one item is easier in B. Forcing equal intercepts pushes the bias into the factor mean — ${fmt(sim.mean ?? NaN)} instead of ${fmt(w.kappa)}. Free that one intercept.`
                  : free.length ? `With ${free.length === 1 ? 'one equality' : 'two equalities'} released, the other items anchor the comparison: partial invariance. The factor mean is ${fmt(sim.mean ?? NaN)}, the truth ${fmt(w.kappa)}.`
                    : 'Every rung holds: the same ruler in both countries. The scalar model recovers the true difference.'}</p>
            </div>
          </div>
        </div>
      </Beat>

      <Beat kind="play" title="The Benelux, for real">
        <div className="card play">
          {error && <LoadError what="The course data" error={error} />}
          {!real && !error && <p className="hint">Loading the ESS 2004…</p>}
          {real && groups && (
            <div className="play-grid">
              <div>
                <p className="mx-cap">Tradition and conformity, four items, Belgium · Luxembourg · Netherlands (n = {groups.map(x => x.n.toLocaleString('en')).join(' · ')}).</p>
                <LadderTable rungs={real} labels />
                <p className="hint">Metric holds; scalar does not. Which intercepts differ? Each button shows the CFI after freeing it — free one at a time, best first.</p>
                <div className="row" style={{ gap: 6 }}>
                  {REAL_INT.map((l, i) => {
                    const on = released.includes(l.key), gain = probe?.get(l.key);
                    return <button key={l.key} className={`tool ${on ? 'pressed' : ''}`} aria-pressed={on} disabled={!on && anchors <= 2}
                      title={gain ? `Freeing this intercept: CFI ${gain.cfi.toFixed(3)}, Netherlands ${fmt(gain.nl)}` : undefined}
                      onClick={() => { setReleased(r => (on ? r.filter(k => k !== l.key) : [...r, l.key])); touch(); }}>
                      {on ? '✓ ' : ''}{LABELS[i]}{!on && gain && anchors > 2 ? <small style={{ opacity: .75 }}> · CFI {gain.cfi.toFixed(3).replace(/^0/, '')}</small> : null}</button>;
                  })}
                </div>
                {anchors <= 2 && <p className="hint">Two intercepts must stay equal: they are the anchor that makes the means comparable at all.</p>}
              </div>
              <div>
                <table className="rp-table">
                  <thead><tr><th>Factor mean vs. Belgium</th>{groups.slice(1).map(x => <th key={x.label}>{x.label}</th>)}</tr></thead>
                  <tbody>
                    <tr><td>all intercepts equal</td>{naiveMeans.map((v, i) => <td key={i}>{fmt(v)}</td>)}</tr>
                    <tr className={released.length ? 'on' : ''}><td>{released.length ? `${released.length} released` : '(release one to compare)'}</td>{realMeans.map((v, i) => <td key={i}>{released.length ? fmt(v) : ''}</td>)}</tr>
                  </tbody>
                </table>
                <p className="hint">In standard deviations of tradition in Belgium. {released.length
                  ? `With ${released.map(k => LABELS[REAL_INT.findIndex(l => l.key === k)]).map(x => `“${x}”`).join(' and ')} freed, the Netherlands sit at ${fmt(realMeans[1])}.`
                  : spread.length ? `Free one intercept and the Netherlands land anywhere between ${fmt(Math.max(...spread))} and ${fmt(Math.min(...spread))} — the items you keep as anchors decide the story.` : ''}</p>
                <p className="hint">Fit alone cannot pick the anchor: it says <i>that</i> the rulers differ, not <i>which</i> ruler is bent. Is “following rules” a different thing to agree with in Dutch than in French? That is a question for the substantive literature — and a reason to report how robust the comparison is.</p>
              </div>
            </div>
          )}
        </div>
      </Beat>

      <Beat kind="explain" title="Four rungs, four promises">
        <Explain>
          <p><b>Configural</b>: the same items load on the same factors everywhere. <b>Metric</b>: the loadings are equal — a one-point change in tradition means the same change in the answers, so relations (correlations, regressions) can be compared. <b>Scalar</b>: the intercepts are equal too — people with the same tradition give the same average answer, so factor means can be compared — and the means of observed sum scores, if every item in the score is invariant. <b>Strict</b>: the residual variances are equal — only then do the variances, reliabilities and standardized differences of sum scores compare like with like.</p>
          <p>Each rung is a restricted version of the one below, so you compare neighbours: a drop in CFI of more than .010 says the new equalities do not hold (Cheung & Rensvold, 2002; Chen, 2007, whom the course follows). If a few items break a rung, you may free them and keep the rest as anchors — <b>partial invariance</b> (Byrne, Shavelson & Muthén, 1989). With many groups, the alignment method looks for the pattern with the fewest differences (Asparouhov & Muthén, 2014).</p>
        </Explain>
      </Beat>

      <Beat kind="formula" title="Where an item average comes from">
        <Formula plug={<Tex block>{`\\bar x_{\\text{modest}}^{B} - \\bar x_{\\text{modest}}^{A} = \\underbrace{${fmt(w.bias)}}_{\\tau^B - \\tau^A} + \\underbrace{${w.loadB.toFixed(2)} \\times ${fmt(w.kappa)}}_{\\lambda^B \\kappa} = ${fmt(w.bias + w.loadB * w.kappa)}`}</Tex>}>
          <Tex block>{'x_{i}^{(g)} = \\tau_i^{(g)} + \\lambda_i^{(g)}\\,\\eta^{(g)} + \\varepsilon_i^{(g)} \\quad\\Rightarrow\\quad E\\big(x_i^{(g)}\\big) = \\tau_i^{(g)} + \\lambda_i^{(g)}\\,\\kappa^{(g)}'}</Tex>
          <p className="hint">The mean of an item mixes the item (its intercept τ) and the people (the factor mean κ). Only if τ and λ are the same in both groups is a difference in item means a difference in κ. lavaan’s ladder: <code>group.equal = c("loadings")</code>, then <code>c("loadings", "intercepts")</code>, then <code>+ "residuals"</code>; partial: <code>group.partial = "ipmodst~1"</code>.</p>
        </Formula>
      </Beat>

      <Beat kind="yours" title={`Is ${constructName(model)} the same ruler everywhere?`}>
        <Yours task={{ id: 'd4-ladder', label: 'Today’s task: the ladder across the Benelux' }}>
          {yours ? (
            <>
              <p>Compared across {g.on ? `${g.names.length} groups (${g.names.filter(Boolean).join(', ')})` : 'two groups'}, your model climbs the ladder with {yours.rungs.map(r => `df ${r.df}`).join(' → ')}.{!g.on && ' Switch on ⇄ Groups in the studio to choose your groups — and estimate the ladder on the course data or your own.'}</p>
              <p className="verdict">Before you look at the numbers, write down which items might be read differently in your groups — and why. Free only those you can explain.</p>
            </>
          ) : <p>Your model has no factor with items yet. Draw one in the studio; then ⇄ Groups sets up the ladder for it.</p>}
        </Yours>
      </Beat>
    </article>
  );
}
