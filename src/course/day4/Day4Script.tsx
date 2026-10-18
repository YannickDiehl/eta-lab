// Day 4 as an interactive script: multi-group CFA and measurement invariance, after the course's
// Day 4 slides (Essex 2024), the worksheet Day 4 (levels, Chen's criteria), the Essex 2023 R code
// and the Lugano 2025 code documentation (MI and partial MI for tradition and conformity). The
// data: tradition/conformity in Belgium, Luxembourg and the Netherlands, ESS 2004. All numbers
// come from R (scripts/day4-outputs.R) with the course's own code. After a didactic review:
// goals and times per section, checkpoints, a label primer that recalls Day 3, the iterative
// score test, and one course position on partial invariance (Chen, robust indices).
import { useState, type ReactNode } from 'react';
import { LoadError, Tex } from '../../components/ui.tsx';
import { Eta } from '../../eta/Eta.tsx';
import { Code } from '../day2.tsx';
import { LABELS } from '../day1/Day1Script.tsx';
import { f3 } from '../day1/data.ts';
import { NumberCheck, useStoredValue } from '../day0/widgets.tsx';
import { CHEN_RULE } from '../../math/cutoffs.ts';
import { sgn, useDay4 } from './data.ts';
import { BaselineLoadings, ItemMeansByCountry, LevelsGrid } from './figures1.tsx';
import { InvarianceExplorer, ItemLines, PointCloud } from './figures3.tsx';
import { DecisionTree, ReleaseLab, RungTable, ScoreTable, UnbeSolution } from './figures2.tsx';

const SECTIONS: { title: string; goal: string; minutes: string }[] = [
  { title: 'Are measurements comparable across groups?', goal: 'you know the levels of invariance, what each one allows you to compare — and how lavaan sets a parameter equal across groups.', minutes: '20' },
  { title: 'Step 1: the measurement model in each country', goal: 'you have checked that the model works in each country on its own.', minutes: '20' },
  { title: 'Step 2: configural invariance', goal: 'you have estimated all countries in one model, without equalities.', minutes: '10' },
  { title: 'Step 3: metric invariance', goal: 'you have tested equal loadings — and know what they allow.', minutes: '15' },
  { title: 'Step 4: scalar invariance', goal: 'you have tested equal intercepts and can see why the model collapses.', minutes: '20' },
  { title: 'Comparing the models', goal: 'you can decide about each rung with the χ² difference and Chen’s criteria.', minutes: '25' },
  { title: 'Partial invariance: which equality breaks?', goal: 'you can find the equality that costs most with the score test.', minutes: '25' },
  { title: 'Releasing intercepts — and who the anchors are', goal: 'you can release an intercept step by step, judge the result, and see what the anchors do to the means.', minutes: '30' },
  { title: 'Latent means', goal: 'you know three ways to give latent means an origin, and how to read the result.', minutes: '20' },
  { title: 'When invariance fails', goal: 'you know the options when full invariance fails.', minutes: '15' },
];

function Sec({ n, children }: { n: number; children: ReactNode }) {
  const s = SECTIONS[n - 1];
  return (
    <section id={`s${n}`} className="sc-step">
      <header><span className="sc-n">{n}</span><h2>{s.title}</h2><span className="hint" style={{ margin: 0 }}>about {s.minutes} min</span></header>
      <p className="sc-goal"><b>After this part</b> {s.goal}</p>
      {children}
    </section>
  );
}
function ROut({ title = 'R output', children }: { title?: string; children: ReactNode }) {
  return <details className="rout"><summary>{title}</summary><div>{children}</div></details>;
}
function Apply({ children }: { children: ReactNode }) {
  return <div className="sc-apply"><span className="sc-tag">Tradition/conformity in the Benelux, ESS 2004</span>{children}</div>;
}
function Transfer({ children }: { children: ReactNode }) {
  return <div className="transfer"><span className="sc-tag">Transfer question</span>{children}</div>;
}
function Deeper({ title, children }: { title: string; children: ReactNode }) {
  return <details className="deeper"><summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>{title}</span></summary><div className="deeper-body">{children}</div></details>;
}
function Check({ label, expect, tol = 0.05, unit, hint }: { label: string; expect: number; tol?: number; unit: string; hint?: string }) {
  const [v, setV] = useStoredValue(`d4:${label}`);
  return <NumberCheck label={label} expect={expect} tol={tol} value={v} onChange={setV} unit={unit} hint={hint} />;
}

const DATA = `BE2 <- read_spss(path = "BE2.sav", convert.factors = F, drop.labels = T)
LU2 <- read_spss(path = "LU2.sav", convert.factors = F, drop.labels = T)
NL2 <- read_spss(path = "NL2.sav", convert.factors = F, drop.labels = T)

# Belgium first: the first group in the data is the reference group
# (or set the order explicitly with group.label = c("BE", "LU", "NL") in cfa())
ESS <- bind_rows(BE2, LU2, NL2) %>%
  mutate(across(ipcrtiv:impfun, \\(x) rec(x, rec = "rev")))

ESS %>%
  group_by(cntry) %>%
  summarise(across(c(ipmodst, imptrad, ipfrule, ipbhprp), \\(x) mean(x, na.rm = T)))`;

const COUNTRIES = `# split() cuts ESS into a list of three data sets, one per country;
# map() runs the same cfa() on each of them
ESS_countries <- ESS %>%
  split(as.factor(.$cntry))

tradition_conformity_fit_countries <- ESS_countries %>%
  map(~ cfa(
    model = "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp",
    data = .,
    estimator = "MLR",
    missing = "fiml.x"
    ))

tradition_conformity_fit_countries %>%
  map(~ summary(
    object = .,
    fit.measures = T,
    standardized = T
  ))`;

const fitCall = (name: string, extra = '') => `${name} <- cfa(
  model = "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp",
  data = ESS,
  estimator = "MLR",
  group = "cntry",${extra}
  missing = "fiml.x"
)`;

const LABEL_PRIMER = `# the same label in every group makes a parameter equal across groups:
# a, b, c are estimated once and used in Belgium, Luxembourg and the Netherlands
model_equal <- "
  TRCO =~ ipmodst + c(a, a, a)*imptrad + c(b, b, b)*ipfrule + c(c, c, c)*ipbhprp
"
# c(a, a, a) gives the loading of imptrad the label a in all three groups.
# This is what group.equal = "loadings" writes for you.`;

const METRIC_EXPLICIT = `# the metric model written out, group by group:
# the loadings carry the same labels (a-d) in every group, so they are equal;
# with the fixed-factor method the factor variance is fixed to 1 in the first group only -
# the equal loadings carry the unit to the other groups, where the variance is free
tradition_conformity_fit_metric2 <- cfa(
  model = "
    group: BE
    TRCO =~ NA*ipmodst + a*ipmodst + b*imptrad + c*ipfrule + d*ipbhprp
    TRCO ~~ 1*TRCO

    group: LU
    TRCO =~ NA*ipmodst + a*ipmodst + b*imptrad + c*ipfrule + d*ipbhprp
    TRCO ~~ NA*TRCO

    group: NL
    TRCO =~ NA*ipmodst + a*ipmodst + b*imptrad + c*ipfrule + d*ipbhprp
    TRCO ~~ NA*TRCO
  ",
  data = ESS,
  estimator = "MLR",
  group = "cntry",
  missing = "fiml.x"
)`;

const SCALAR_EXPLICIT = `# the scalar model written out: the intercepts get labels too (e-h);
# the latent mean is fixed to 0 in the first group and free in the others
tradition_conformity_fit_scalar2 <- cfa(
  model = "
    group: BE
    TRCO =~ NA*ipmodst + a*ipmodst + b*imptrad + c*ipfrule + d*ipbhprp
    ipmodst ~ e*1
    imptrad ~ f*1
    ipfrule ~ g*1
    ipbhprp ~ h*1
    TRCO ~ 0*1
    TRCO ~~ 1*TRCO

    group: LU
    TRCO =~ NA*ipmodst + a*ipmodst + b*imptrad + c*ipfrule + d*ipbhprp
    ipmodst ~ e*1
    imptrad ~ f*1
    ipfrule ~ g*1
    ipbhprp ~ h*1
    TRCO ~ NA*1
    TRCO ~~ NA*TRCO

    group: NL
    TRCO =~ NA*ipmodst + a*ipmodst + b*imptrad + c*ipfrule + d*ipbhprp
    ipmodst ~ e*1
    imptrad ~ f*1
    ipfrule ~ g*1
    ipbhprp ~ h*1
    TRCO ~ NA*1
    TRCO ~~ NA*TRCO
  ",
  data = ESS,
  estimator = "MLR",
  group = "cntry",
  missing = "fiml.x"
)`;

const STUDIO_SAMPLE = `# eta Lab's studio uses the respondents who answered all course variables
ESS_studio <- ESS %>%
  mutate(
    agea = 2004 - yrbrn,
    female = as.numeric(gndr == 2)
  ) %>%
  drop_na(ipcrtiv:impfun, imsmetn:impcntr, imbgeco, imueclt, imwbcnt, agea, female, eduyrs)

nrow(ESS_studio)   # 4579

studio_fit <- function(equal) cfa(
  model = "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp",
  data = ESS_studio,
  estimator = "ML",
  group = "cntry",
  group.equal = equal
)
studio_fit(character(0)) %>% fitMeasures(c("chisq", "df", "cfi"))           # configural 13.6 (6)
studio_fit("loadings") %>% fitMeasures(c("chisq", "df", "cfi"))             # metric 22.0 (12)
studio_fit(c("loadings", "intercepts")) %>% fitMeasures(c("chisq", "df", "cfi"))  # scalar 629.4 (18), CFI .721`;

export function Day4Script() {
  const { d, error } = useDay4();
  const [solution, setSolution] = useState(false);
  if (error) return <LoadError what="The Day 4 outputs" error={error} />;
  if (!d) return <p className="hint">Loading the outputs from R…</p>;
  const f = d.fits, b = d.baseline, plain = (k: number) => b[k].fit.chisq;
  const top = d.score_scalar[0], second = d.score_scalar[1], next = d.score_partial[0], next2 = d.score_partial[1];
  const dP = f.partial['cfi.robust'] - f.metric['cfi.robust'], dP3 = f.partial3['cfi.robust'] - f.metric['cfi.robust'];
  const raw3 = d.estimates.partial3.filter(e => e.op === '~1' && e.lhs === 'TRCO');
  const nl3 = d.means.partial3[2], lu3 = d.means.partial3[1];
  const u = d.unbe;

  return (
    <article className="script">
      <nav className="sec-rail" aria-label="Sections">
        <a href="#/day/4#start" title="Start">0</a>
        {SECTIONS.map((t, i) => <a key={i} href={`#/day/4#s${i + 1}`} title={t.title}>{i + 1}</a>)}
        <a href="#/day/4#yourturn" title="Your turn">✎</a>
      </nav>

      <div className="card sc-intro">
        <Eta size={56} mood="explaining" />
        <div>
          <p><b>Today:</b> do the mean levels of tradition and conformity differ between Belgium, Luxembourg and the Netherlands? Before we can answer, we have to ask whether the four items measure the same thing in all three countries — with the same ruler. We climb the course’s ladder of measurement invariance, step by step.</p>
          <p><b>How to work:</b> a new script <code>day4.R</code> in your project, packages as on Day 1, and the three country files from Day 0. Sections 1–8 are the core; section 9 and the folded parts go deeper. The studio task practises section 8, “Your turn” (30 min) the whole procedure. Chen (2007) is reading to skim.</p>
        </div>
      </div>

      <section id="start" className="sc-step">
        <header><span className="sc-n">Start</span><h2>Three countries, four items</h2><span className="hint" style={{ margin: 0 }}>about 15 min</span></header>
        <p className="sc-goal"><b>After this part</b> the three countries are in one data set, and you have seen why their raw means cannot answer today’s question.</p>
        <p>The data: the Belgian, Luxembourgish and Dutch respondents of ESS round 2 — the three files you saved on Day 0 — bound into one data set.</p>
        <Code code={DATA} />
        <p className="hint">You should see a table with three rows: BE, LU, NL. Later, lavaan warns that “some cases are empty”: 36 of the 5,294 respondents answered none of the four items. FIML uses the other {d.n.toLocaleString('en')}.</p>
        <ItemMeansByCountry d={d} labels={LABELS} />
      </section>

      <Sec n={1}>
        <p>Measurement invariance is a property of a measurement instrument: the instrument measures the same concept in the same way across groups of respondents, or across time points. It can be assessed with a <b>multiple-group CFA</b> (MGCFA): the same model in all groups, with some parameters set equal across groups — “fix them to be equal”.</p>
        <p>Groups can be countries (Belgian, Dutch and Luxembourgish respondents; all countries of an ESS round; all rounds), education groups, age groups — or the same people at several times.</p>
        <p>A sequential testing strategy tests different levels of invariance, each with more equalities than the one before:</p>
        <div className="sc-formula"><Tex block>{'\\text{metric: }\\lambda^{1} = \\lambda^{2} = \\dots = \\lambda^{G} \\qquad \\text{scalar: }\\lambda^{1} = \\dots = \\lambda^{G},\\; \\tau^{1} = \\dots = \\tau^{G}'}</Tex></div>
        <div className="card bridge-card">
          <p><b>Day 3 and Day 4: two ladders, the same tools.</b></p>
          <table className="rp-table left">
            <thead><tr><th /><th>Day 3: the restriction ladder</th><th>Day 4: the invariance ladder</th></tr></thead>
            <tbody>
              <tr><td>equal across</td><td>the <b>items</b> of one construct, in one group</td><td>the <b>groups</b>, for each item separately</td></tr>
              <tr><td>example</td><td>tau-equivalent: all four loadings are equal</td><td>metric: imptrad’s loading is the same in BE, LU and NL — the four items may still differ from each other</td></tr>
              <tr><td>tools</td><td colSpan={2}>labels for equal parameters, nested models, Δχ²<sub>SB</sub>, ΔCFI — the same as on Day 3</td></tr>
            </tbody>
          </table>
          <p className="hint">Two names to keep apart: “strictly parallel” (Day 3: equal intercepts and error variances across the items) and “strict invariance” (today: equal error variances across the groups).</p>
        </div>
        <p>A parameter that carries the same label in every group is estimated once — equal across groups:</p>
        <Code code={LABEL_PRIMER} />
        <p className="hint">lavaan writes such labels for you when you use <code>group.equal</code>. In its output and in <code>lavTestScore()</code> they appear as automatic labels like <code>.p12.</code> (section 7).</p>
        <p className="hint">A warm-up with a known truth: “Bend one ruler” in <a href="#/s11">station 4.2</a> (10 min) bends one item in one country and shows what each rung catches.</p>
        <p>The superscript is the group: λ¹ is a loading in Belgium, λ² the same loading in Luxembourg, up to group G. “Equal across groups” is an <b>equality constraint</b>: lavaan estimates one value and uses it in every group. That costs no parameters but gains degrees of freedom — and makes the model testable.</p>
        <LevelsGrid />
        <p>What setting a parameter equal does, in the course’s picture: the expected answer Y of a group over the latent variable η — one line per group, with its intercept τ, its slope λ, and the latent mean κ of the group. Switch the levels:</p>
        <InvarianceExplorer />
        <table className="rp-table left">
          <thead><tr><th>Invariance of …</th><th>also called</th><th>parameters</th></tr></thead>
          <tbody>
            <tr><td>form</td><td>configural</td><td>which item loads on which factor</td></tr>
            <tr><td>loadings</td><td>metric, weak</td><td>λ</td></tr>
            <tr><td>intercepts</td><td>scalar, strong</td><td>τ</td></tr>
            <tr><td>residuals</td><td>strict</td><td>error variances</td></tr>
            <tr><td>structural (co)variances</td><td>—</td><td>factor variances and covariances</td></tr>
            <tr><td>latent means</td><td>—</td><td>κ</td></tr>
          </tbody>
        </table>
        <Transfer><p>Draw a one-factor model with three indicators (x1–x3, loadings λ1–λ3, errors ε1–ε3). Which of its parameters could be set equal across groups — and which comparison would each equality allow?</p></Transfer>
      </Sec>

      <Sec n={2}>
        <p>Before we approach a common model across all groups, we check whether the measurement model can be estimated properly in each group. The baseline models involve no between-group constraints — a separate analysis per group, <b>no test of invariance yet</b>. Look at:</p>
        <ol type="a">
          <li>whether the unstandardized loadings look similar across countries (overlapping intervals) — a first impression, not yet a test;</li>
          <li>whether a group needs an error covariance of its own;</li>
          <li>whether a group needs a cross-loading of its own.</li>
        </ol>
        <Apply>
          <Code code={COUNTRIES} />
          <BaselineLoadings d={d} />
          <ROut title="R output · the three summaries"><pre className="syntax"><code>{d.baseline_summary}</code></pre></ROut>
          <Check label="Netherlands: scaled χ² of the baseline model" expect={d.baseline[2].fit['chisq.scaled']} tol={0.005} unit={`χ²(${d.baseline[2].fit.df}) = ${d.baseline[2].fit['chisq.scaled'].toFixed(3)} — the congeneric model of Day 1 and Day 3, the same numbers`} hint="the third summary; the countries come in the order BE, LU, NL" />
          <p>In all three countries the measurement model reaches a good fit; nothing points to an error covariance or cross-loading of its own (with df = 2 the global fit is a strong hint; <code>map(modificationindices)</code> would show it in detail). The loadings of <code>imptrad</code> and <code>ipfrule</code> are a little larger in Belgium than in the Netherlands — whether that matters, the metric model will test.</p>
        </Apply>
      </Sec>

      <Sec n={3}>
        <p>Configural invariance: the same number of factors and the same loading pattern in all groups; <b>no equality constraints</b> across groups. All groups are estimated together, with the same estimator.</p>
        <Apply>
          <Code code={fitCall('tradition_conformity_fit_config')} />
          <p><code>group = "cntry"</code> fits the model in every country at once. The groups are numbered in the order they appear in the data: 1 = BE, 2 = LU, 3 = NL. In each country, ipmodst’s loading is 1 and the latent mean is 0 — three separate scales, nothing compared yet.</p>
          <p>Since nothing is constrained, the configural model is the three baseline models side by side. Its ML χ² — the column “Standard” in the summaries of step 1, not the scaled values in the table — is their sum: <Tex>{`${plain(0).toFixed(2)} + ${plain(1).toFixed(2)} + ${plain(2).toFixed(2)} = ${f.config.chisq.toFixed(2)}`}</Tex> with 3 × 2 = {f.config.df} df. With MLR: χ²({f.config.df}) = {f.config['chisq.scaled'].toFixed(2)}, CFI = {f3(f.config['cfi.robust'])}, RMSEA = {f3(f.config['rmsea.robust'])}, SRMR = {f3(f.config.srmr)}. The same pattern fits in all three countries — but no comparison of estimates is allowed yet.</p>
          <Check label="scaled χ², configural" expect={f.config['chisq.scaled']} unit={`χ²(${f.config.df}) = ${f.config['chisq.scaled'].toFixed(2)}`} hint="look for “Test Statistic”, column “Scaled”" />
          <ROut title="R output · summary(tradition_conformity_fit_config)"><pre className="syntax"><code>{d.config_summary}</code></pre></ROut>
        </Apply>
      </Sec>

      <Sec n={4}>
        <p>Metric invariance: equal structure and <b>equal factor loadings</b> across groups. Respondents from different groups attribute the same meaning to the construct: one unit more of the latent variable means the same change in the answers everywhere. Comparisons of regression coefficients, covariances and variances become valid.</p>
        <Apply>
          <Code code={fitCall('tradition_conformity_fit_metric', '\n  group.equal = "loadings",')} />
          <p>χ²({f.metric.df}) = {f.metric['chisq.scaled'].toFixed(2)}, CFI = {f3(f.metric['cfi.robust'])}, RMSEA = {f3(f.metric['rmsea.robust'])}. Six more degrees of freedom: 3 free loadings × 2 further countries = 6 equalities. The χ² difference is not significant — Δχ²<sub>SB</sub>(6) = {d.lrt.metric.dchisq.toFixed(2)}, p = {f3(d.lrt.metric.p)} — even with {d.n.toLocaleString('en')} respondents, and section 6 shows that the fit indices agree. <b>Metric invariance holds.</b></p>
          <Check label="Δχ²_SB, configural against metric" expect={d.lrt.metric.dchisq} tol={0.02} unit={`Δχ²(${d.lrt.metric.ddf}) = ${d.lrt.metric.dchisq.toFixed(2)} — from compareFit (section 6) or lavTestLRT(config, metric, method = "satorra.bentler.2001")`} hint={'a different number? Check that both models use estimator = "MLR" and missing = "fiml.x", and that BE, LU, NL are bound in this order'} />
          <Deeper title="The metric model written out, group by group">
            <p>What <code>group.equal = "loadings"</code> does behind the scenes, with the fixed-factor method of Day 1, step 3:</p>
            <Code code={METRIC_EXPLICIT} />
            <p className="hint">In the configural model the factor variance has to be fixed in every country; once the loadings are equal, fixing it in one country is enough.</p>
          </Deeper>
        </Apply>
      </Sec>

      <Sec n={5}>
        <p>Scalar invariance: equal structure, equal loadings and <b>equal intercepts</b> across groups. Respondents from different groups “use” the scale in a similar manner: people with the same value on the construct give the same expected answer. Only then can latent means be compared.</p>
        <Apply>
          <Code code={fitCall('tradition_conformity_fit_scalar', '\n  group.equal = c("loadings", "intercepts"),')} />
          <p>χ²({f.scalar.df}) = {f.scalar['chisq.scaled'].toFixed(1)}, CFI = {f3(f.scalar['cfi.robust'])}, RMSEA = {f3(f.scalar['rmsea.robust'])}. The degrees of freedom: 4 intercepts × 2 further countries = 8 new equalities, but the latent means of Luxembourg and the Netherlands are now free (2 parameters): 18 − 12 = 6. The model collapses.</p>
          <p>Why, the item lines show. <b>Your turn:</b> switch between metric and scalar for <code>ipfrule</code>, then for <code>ipmodst</code>. Where is the filled marker furthest from the ring?</p>
          <ItemLines d={d} labels={LABELS} />
          <p>The same, with people instead of lines. Switch from metric to scalar and watch the clouds:</p>
          <PointCloud d={d} labels={LABELS} />
          <details className="deeper"><summary><span className="shape d" aria-hidden="true" /><span>Answer</span></summary><div className="deeper-body"><p>For <code>ipmodst</code> the gap is largest in the Netherlands, whose answers fall below the line, while Belgium lies above it. For <code>ipfrule</code> it is the other way round: Belgium below, the Netherlands above. Under the scalar model one latent mean per country has to explain all four items at once — and the conflict is between Belgium and the Netherlands, exactly the pair the score test names in section 7.</p></div></details>
          <ROut title="R output · summary(tradition_conformity_fit_scalar)"><pre className="syntax"><code>{d.scalar_summary}</code></pre></ROut>
        </Apply>
      </Sec>

      <Sec n={6}>
        <p>How do we decide which level is supported? Estimate the configural, metric and scalar models one after another, inspect the fit of each as usual, and inspect the <b>differences</b> between neighbouring models. For two nested models, m1 (the simpler model, with more df) and m2:</p>
        <div className="sc-formula"><Tex block>{'\\chi^2_d = \\chi^2_{m1} - \\chi^2_{m2} \\quad\\text{with}\\quad df_{m1} - df_{m2}'}</Tex></div>
        <p>With MLR, the difference needs the Satorra–Bentler correction (Day 2). And the χ² difference test is sensitive to sample size: in large samples it rejects almost every equality. Chen (2007) therefore proposes cut-offs for the change in fit indices, separately for small and large samples (n = total sample size):</p>
        <table className="rp-table">
          <thead><tr><th>Index</th><th>n ≤ 300: metric</th><th>n ≤ 300: scalar</th><th>n &gt; 300: metric</th><th>n &gt; 300: scalar</th></tr></thead>
          <tbody>
            <tr><td>ΔCFI</td><td>≥ −.005</td><td>≥ −.005</td><td>≥ −.010</td><td>≥ −.010</td></tr>
            <tr><td>ΔRMSEA</td><td>≤ .010</td><td>≤ .010</td><td>≤ .015</td><td>≤ .015</td></tr>
            <tr><td>ΔSRMR</td><td>≤ .025</td><td>≤ .005</td><td>≤ .030</td><td>≤ .010</td></tr>
          </tbody>
        </table>
        <p className="hint">{CHEN_RULE} Note −.010, not −.10.</p>
        <p><b>Robust or scaled?</b> With MLR, lavaan reports two corrected versions of CFI and RMSEA: <code>cfi.scaled</code> — what Mplus prints (scalar CFI {f3(f.scalar['cfi.scaled'])}) — and <code>cfi.robust</code>, the newer version used in this course ({f3(f.scalar['cfi.robust'])}). Pick one, use it for every rung, and say which. Here: robust.</p>
        <Apply>
          <Code code={`compFit.tradition_conformity <- compareFit(\n  scalar = tradition_conformity_fit_scalar,\n  metric = tradition_conformity_fit_metric,\n  config = tradition_conformity_fit_config,\n  argsLRT = list(method = "satorra.bentler.2001")\n)\n\nsummary(\n  object = compFit.tradition_conformity,\n  fit.measures = c("chisq.scaled", "df.scaled", "pvalue.scaled",\n                   "rmsea.robust", "cfi.robust", "tli.robust",\n                   "srmr", "aic", "bic")\n)`} />
          <RungTable d={d} />
          <ROut title="R output · summary(compFit.tradition_conformity)"><pre className="syntax"><code>{d.compare_text}</code></pre></ROut>
          <p>Metric measurement invariance is given, full scalar invariance is not: ΔCFI = {sgn(f.scalar['cfi.robust'] - f.metric['cfi.robust'])}. The countries’ latent means cannot be compared — yet.</p>
        </Apply>
        <Transfer><p>Which type of sample do you have — and which global fit measures, and which cut-offs for their changes, can you use with it?</p></Transfer>
      </Sec>

      <Sec n={7}>
        <h3>7a · The idea</h3>
        <p>Especially in cross-cultural research, full invariance of all parameters seldom exists (Davidov et al., 2014, 2018). Byrne, Shavelson and Muthén (1989) showed that with <b>partial invariance</b> multi-group analyses are still legitimate: only some parameters are kept equal.</p>
        <div className="card rule-card"><b>The rule:</b> for partial metric invariance, the reference indicator plus one more loading must be equal across groups; for latent mean comparisons, <b>two items with equal loadings and intercepts</b> are enough. These items are the <b>anchors</b>.</div>
        <p>The procedure: (1) find the equality constraint that strains most and relax it; (2) re-estimate, and compare with the metric model again.</p>
        <h3>7b · The score test in R</h3>
        <p>The tool for step (1) is the <b>score test</b>: for each equality, how much would χ² drop if it were released? You know it from Day 3’s “Your turn” — the same function, now for equalities across groups. And releasing one intercept is the same move as Day 3’s partially tau-equivalent model, which released one loading.</p>
        <Apply>
          <Code code={`tradition_conformity_fit_scalar %>% \n  lavTestScore()`} />
          <p className="hint">lavaan warns that it falls back to the ordinary score test: read X2 as an approximate drop in the ML χ², not in the scaled one. The first table, the total score test, gives the drop if all constraints were released at once: X2({14}) = {d.score_total.toFixed(1)}. Below it, the univariate tests — one per equality.</p>
          <ROut title="R output · lavTestScore() — the univariate tests, largest first"><pre className="syntax"><code>{d.score_text}</code></pre></ROut>
          <p>The tests name the equalities by automatic labels such as <code>.p12. == .p40.</code>. To find out what they are, look the two labels of the largest row up in the parameter table:</p>
          <Code code={`tradition_conformity_fit_scalar %>% \n  parTable() %>% \n  select(lhs, op, rhs, group, label, plabel, est, se) %>% \n  filter(plabel %in% c(".p12.", ".p40."))`} />
          <ROut title="R output · parTable() — the two labels"><pre className="syntax"><code>{d.partable_text}</code></pre></ROut>
          <p>Click a row to decode it:</p>
          <ScoreTable d={d} labels={LABELS} />
          <Check label="largest X2 of the score test" expect={top.X2} tol={0.1} unit={`X2 = ${top.X2.toFixed(1)}: the intercept of ${top.item}, ${top.g1} = ${top.g2}`} hint="the first row of lavTestScore()$uni, sorted by X2 — or the R output above" />
          <p>The largest drop: the intercept of <code>{top.item}</code> between {top.g1} and {top.g2} (X2 = {top.X2.toFixed(1)}), closely followed by <code>{second.item}</code> ({second.g1} = {second.g2}, X2 = {second.X2.toFixed(1)}). Both are about the Netherlands — where, in the raw means, <code>ipfrule</code> was highest and <code>ipmodst</code> lowest.</p>
        </Apply>
      </Sec>

      <Sec n={8}>
        <p>A released intercept no longer links the countries; the remaining equal intercepts — the <b>anchors</b> — carry the comparison of the latent means. So every release needs a reason about the item: wording, translation, what “being humble” or “following rules” means in a country. “The score test was largest” is not a reason. We release one intercept at a time. Here the reasons are hypotheses — “do what you are told” may weigh differently in Dutch and in French, “humble and modest” may describe a virtue in one country and self-effacement in another — whether they hold is a question of content, not of fit. The releases below show the mechanics.</p>
        <Apply>
          <h3>Release 1 · ipfrule</h3>
          <Code code={fitCall('tradition_conformity_fit_scalar_partial', '\n  group.equal = c("loadings", "intercepts"),\n  group.partial = c("ipfrule~1"),')} />
          <p className="hint"><code>group.partial</code> releases the parameter in <i>all</i> groups — here also between Belgium and Luxembourg, where the score test found no difference (X2 = 2.2). Labels group by group would allow finer releases; <code>group.partial</code> is much shorter.</p>
          <p>Check with <code>compareFit()</code> against the metric model, as in section 6: ΔCFI = {sgn(dP)}. Still far outside Chen’s limit.</p>
          <h3>Score test again</h3>
          <Code code={`tradition_conformity_fit_scalar_partial %>% \n  lavTestScore()`} />
          <ROut title="R output · lavTestScore() after the first release"><pre className="syntax"><code>{d.score_partial_text}</code></pre></ROut>
          <ScoreTable d={d} labels={LABELS} rows={d.score_partial} />
          <p>Now <code>{next.item}</code> ({next.g1} = {next.g2}) is on top, X2 = {next.X2.toFixed(1)}, followed by <code>{next2.item}</code> (X2 = {next2.X2.toFixed(1)}).</p>
          <p className="hint">Before you read on: which intercept would <i>you</i> release, in which direction is it off — and why? Decide in the studio task first; the second release, all combinations and the course’s verdict are folded below.</p>
          <Deeper title="After your own decision: the second release, all combinations and the verdict">
          <h3>Release 2 · ipmodst</h3>
          <Code code={fitCall('tradition_conformity_fit_scalar_partial3', '\n  group.equal = c("loadings", "intercepts"),\n  group.partial = c("ipfrule~1", "ipmodst~1"),')} />
          <Code code={`compareFit(\n  scalar = tradition_conformity_fit_scalar_partial3,\n  metric = tradition_conformity_fit_metric,\n  config = tradition_conformity_fit_config,\n  argsLRT = list(method = "satorra.bentler.2001")\n) %>% \n  summary(fit.measures = c("chisq.scaled", "df.scaled", "pvalue.scaled",\n                           "rmsea.robust", "cfi.robust", "tli.robust", "srmr"))`} />
          <Check label="robust CFI with both released" expect={f.partial3['cfi.robust']} tol={0.005} unit={`CFI ${f3(f.partial3['cfi.robust'])}, ΔCFI ${sgn(dP3)}`} hint="look for cfi.robust in the fit table" />
          <ROut title="R output · compareFit with ipfrule and ipmodst free"><pre className="syntax"><code>{d.compare_partial3_text}</code></pre></ROut>
          <p>Try all four combinations — and watch the Dutch mean:</p>
          <ReleaseLab d={d} labels={LABELS} />
          <ItemLines d={d} labels={LABELS} initial="partial3" item0="ipmodst" models={['metric', 'scalar', 'partial', 'partial3']} />
          <div className="card decision-box">
            <p><b>The course’s reading.</b> Chen asks whether the new equalities cost fit — and with both intercepts released they still do, on all three criteria: ΔCFI = {sgn(dP3)}, ΔRMSEA = {sgn(f.partial3['rmsea.robust'] - f.metric['rmsea.robust'], 3)} (limit .015), ΔSRMR = {sgn(f.partial3.srmr - f.metric.srmr, 3)} (limit .010 for intercepts). A good absolute CFI ({f3(f.partial3['cfi.robust'])}) answers a different question. So partial scalar invariance is <b>not supported</b> for tradition and conformity across the Benelux; only the comparisons that metric invariance allows are safe. The latent means below are shown as a sensitivity analysis, not as a finding.</p>
            <p className="hint">The other reading — accepting the model by its absolute fit — is defensible too — which one you take is a decision to write down, with its reason.</p>
          </div>
          </Deeper>
        </Apply>
      </Sec>

      <Sec n={9}>
        <p>Once loadings and intercepts are (at least partially) invariant, the structural part of the model can be compared: factor variances, covariances, and the <b>latent means</b> (mean and covariance structures, MACS). For illustration we use the model with <code>ipfrule</code> and <code>ipmodst</code> free — keep in mind that section 8 did not support it. A latent mean needs an origin — here: Belgium at 0 (Day 5 compares the means in depth).</p>
        <Deeper title="Three ways to give the latent means an origin (Little, Slegers & Card, 2006)">
        <table className="rp-table left">
          <thead><tr><th>Method</th><th>How</th><th>Reading</th></tr></thead>
          <tbody>
            <tr><td><b>1 · Reference group</b></td><td>The latent mean is fixed to 0 in the first group; a loading or the factor variance is fixed to 1; loadings and intercepts are equal across groups.</td><td>Every other group’s mean is a difference to the reference group (here: Belgium). lavaan’s default.</td></tr>
            <tr><td><b>2 · Marker variable</b></td><td>One item’s intercept is fixed to 0 and its loading to 1; the other intercepts and loadings are estimated but equal across groups.</td><td>The latent means take the scale of that item — an arbitrary choice that can change the interpretation.</td></tr>
            <tr><td><b>3 · Effects coding</b></td><td>The intercepts of a construct sum to 0, its loadings average 1.</td><td>The latent mean lies on the 1–6 scale of the items: a weighted average of the item means.</td></tr>
          </tbody>
        </table>
        <p className="hint">With the same equalities, all three give the same fit: they are equivalent parametrizations of the same model. All three need (partial) scalar invariance.</p>
        </Deeper>
        <Apply>
          <Code code={`# method 1, lavaan's default: in units of ipmodst (the reference indicator)\ntradition_conformity_fit_scalar_partial3 %>% \n  parameterEstimates() %>% \n  filter(op == "~1", lhs == "TRCO")\n\n# the same model in standard deviations of Belgium\ntradition_conformity_fit_scalar_partial3 %>% \n  update(std.lv = T) %>%     # Belgium: mean 0, variance 1\n  parameterEstimates() %>% \n  filter(op == "~1", lhs == "TRCO")\n\n# method 3, effects coding: on the 1-6 scale of the items\ntradition_conformity_fit_scalar_partial3 %>% \n  update(effect.coding = T) %>% \n  parameterEstimates() %>% \n  filter(op == "~1", lhs == "TRCO")`} />
          <table className="rp-table">
            <thead><tr><th></th><th>units of ipmodst</th><th>SD of Belgium</th><th>effects coding (1–6)</th></tr></thead>
            <tbody>{d.groups.map((g, i) => <tr key={g}><td>{g}</td><td>{i === 0 ? '0' : sgn(raw3[i].est, 2)}</td><td>{i === 0 ? '0' : sgn(d.means.partial3[i].std, 2)}</td><td>{d.effect_means[i].est.toFixed(2)}</td></tr>)}</tbody>
          </table>
          <p>Same model, three units. In standard deviations of Belgium: Luxembourg {sgn(lu3.std, 2)}, the Netherlands {sgn(nl3.std, 2)}. With only <code>ipfrule</code> free, the Netherlands would be at {sgn(d.means.partial[2].std, 2)}; with only <code>ipmodst</code> free, at {sgn(d.means.partial2[2].std, 2)}. The answer to today’s question depends on the anchors — that is why they have to be named and argued in every report.</p>
          <Deeper title="The scalar model written out, group by group">
            <Code code={SCALAR_EXPLICIT} />
          </Deeper>
        </Apply>
      </Sec>

      <Sec n={10}>
        <p>What if full invariance fails? The course’s decision tree:</p>
        <DecisionTree />
        <Transfer>
          <ul>
            <li>For which items would you propose configural invariance in your research? For which metric, for which scalar invariance?</li>
            <li>What about partial invariance for your research — which items could be your anchors? Write them into <a href="#/day/4#project">your project step</a> below.</li>
          </ul>
        </Transfer>
      </Sec>

      <section id="studio" className="sc-step">
        <header><span className="sc-n">Studio</span><h2>Before the studio task: why its numbers differ slightly</h2></header>
        <p>The studio estimates with ML from the covariances of the {(4579).toLocaleString('en')} respondents who answered all course variables; the script uses FIML and all {d.n.toLocaleString('en')} respondents with at least one answer. To get the studio’s numbers in R:</p>
        <Code code={STUDIO_SAMPLE} />
      </section>

      <section id="yourturn" className="sc-step">
        <header><span className="sc-n">✎</span><h2>Your turn: universalism and benevolence</h2><span className="hint" style={{ margin: 0 }}>about 30 min · evening</span></header>
        <p className="sc-goal"><b>After this part</b> you can run the whole procedure on your own.</p>
        <p>Do the mean levels of universalism and benevolence differ across Belgium, Luxembourg and the Netherlands? The five items: <code>ipeqopt</code> (“{LABELS.ipeqopt}”), <code>ipudrst</code> (“{LABELS.ipudrst}”), <code>impenv</code> (“{LABELS.impenv}”), <code>iphlppl</code> (“{LABELS.iphlppl}”) and <code>iplylfr</code> (“{LABELS.iplylfr}”).</p>
        <p>Run the core of the procedure for <code>UNBE =~ ipeqopt + ipudrst + impenv + iphlppl + iplylfr</code>: configural, metric, scalar — and if scalar fails, one score test to find the intercept you would release. The solution shows the rest (baselines, partial model, means). Fill the gaps:</p>
        <Code code={`universalism_benevolence_fit_scalar <- cfa(\n  model = "UNBE =~ ipeqopt + ipudrst + impenv + iphlppl + iplylfr",\n  data = ESS,\n  estimator = "MLR",\n  group = "____",\n  group.equal = c("____", "____"),\n  missing = "fiml.x"\n)\n\nuniversalism_benevolence_fit_scalar %>% \n  ____()\n\nuniversalism_benevolence_fit_scalar_partial <- cfa(\n  model = "UNBE =~ ipeqopt + ipudrst + impenv + iphlppl + iplylfr",\n  data = ESS,\n  estimator = "MLR",\n  group = "cntry",\n  group.equal = c("loadings", "intercepts"),\n  group.partial = c("____~1"),\n  missing = "fiml.x"\n)`} />
        <p>Numbers to check on the way (robust indices):</p>
        <div className="ncheck-row">
          <Check label="configural: scaled χ²" expect={u.fits.config['chisq.scaled']} tol={0.1} unit={`χ²(${u.fits.config.df}) = ${u.fits.config['chisq.scaled'].toFixed(1)}`} />
          <Check label="scalar: robust CFI" expect={u.fits.scalar['cfi.robust']} tol={0.005} unit={`CFI ${f3(u.fits.scalar['cfi.robust'])}`} />
        </div>
        <button className="btn" onClick={() => setSolution(v => !v)} aria-expanded={solution}>{solution ? 'Hide the solution' : 'Show the solution'}</button>
        {solution && <div className="sc-solution"><UnbeSolution d={d} /></div>}
      </section>
    </article>
  );
}
