// Day 5 as an interactive script: latent means and beyond one factor, after the course's Day 5
// slides (Essex 2024), the alignment deck, the active session and consolidation task of 2022, the
// R code Day 5 and the higher-order example, and Brown's reporting checklist. The data: ESS 2004
// Benelux (values, attitudes toward immigration) and a simulated MTMM design. All numbers come from
// R (scripts/day5-outputs.R) with the course's own code.
import { useState, type ReactNode } from 'react';
import { LoadError, Predict, Tex } from '../../components/ui.tsx';
import { Eta } from '../../eta/Eta.tsx';
import { Code } from '../day2.tsx';
import { MiniTask, NumberCheck, useStoredValue } from '../day0/widgets.tsx';
import { REPORT } from '../day5.tsx';
import { f2, f3, sgn, useDay5 } from './data.ts';
import { CHEN_RULE } from '../../math/cutoffs.ts';
import { LABELS } from '../day1/Day1Script.tsx';
import { BifactorView, CascadeView, HigherOrder, MeanEquation, MeansCompare, MtmmMatrix, ProbeTable } from './figures.tsx';

const SECTIONS: { title: string; goal: string; minutes: string }[] = [
  { title: 'Comparing means: latent or observed?', goal: 'you can say what a difference in item means is made of, and why a t-test on sum scores can mislead.', minutes: '30' },
  { title: 'Testing strategies — and when modifying becomes chasing the sample', goal: 'you know the classical strategies for invariance testing, and why the later steps of a modification cascade rarely replicate.', minutes: '25' },
  { title: 'Alignment: means without full invariance', goal: 'you know the idea of alignment, and can run it in R for a few groups.', minutes: '20' },
  { title: 'A factor above the factors: second-order models', goal: 'you can specify a second-order factor, count its identification, and know when it is testable.', minutes: '20' },
  { title: 'One general factor and its facets: bifactor models', goal: 'you know what a bifactor model claims, how to read omega hierarchical, and why better fit alone is no argument for it.', minutes: '20' },
  { title: 'Traits and methods: MTMM', goal: 'you can read a multitrait-multimethod matrix and model method variance in two ways.', minutes: '25' },
  { title: 'Reporting a CFA', goal: 'you know what a report of a measurement model contains.', minutes: '10' },
  { title: 'Week 1 in one page', goal: 'you have a strategy for testing measurement models in comparative research — from one factor to latent means.', minutes: '10' },
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
function Apply({ children, what = 'Tradition/conformity in the Benelux, ESS 2004' }: { children: ReactNode; what?: string }) {
  return <div className="sc-apply"><span className="sc-tag">{what}</span>{children}</div>;
}
function Transfer({ children, answer }: { children: ReactNode; answer?: ReactNode }) {
  return (
    <div className="transfer"><span className="sc-tag">Transfer question</span>{children}
      {answer && <details className="deeper"><summary><span className="shape d" aria-hidden="true" /><span>One possible answer</span></summary><div className="deeper-body">{answer}</div></details>}
    </div>
  );
}
function Deeper({ title, children }: { title: string; children: ReactNode }) {
  return <details className="deeper"><summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>{title}</span></summary><div className="deeper-body">{children}</div></details>;
}
function Check({ label, expect, tol = 0.005, unit, hint }: { label: string; expect: number; tol?: number; unit: string; hint?: string }) {
  const [v, setV] = useStoredValue(`d5:${label}`);
  return <NumberCheck label={label} expect={expect} tol={tol} value={v} onChange={setV} unit={unit} hint={hint} />;
}
function Task(props: Omit<Parameters<typeof MiniTask>[0], 'done' | 'onRight'>) {
  const [done, setDone] = useState(false);
  return <MiniTask {...props} done={done} onRight={() => setDone(true)} />;
}

const SETUP = `library(tidyverse); library(sjlabelled); library(sjmisc)
library(lavaan); library(semTools); library(sirt)

read_country <- function(file) {
  read_spss(path = file, convert.factors = F, drop.labels = T) %>%
    mutate(across(ipcrtiv:impfun, \\(x) rec(x, rec = "rev")),     # values: higher = more important
           across(imsmetn:impcntr, \\(x) rec(x, rec = "rev")))    # allow: higher = allow more
}
BE2 <- read_country("BE2.sav")
LU2 <- read_country("LU2.sav")
NL2 <- read_country("NL2.sav")

ESS <- bind_rows(BE2, LU2, NL2)   # Belgium first: the reference group`;

const MEANS = `# the mean score of the four items, and a t-test Belgium against the Netherlands
ESS %>%
  mutate(trco_score = rowMeans(across(c(ipmodst, imptrad, ipfrule, ipbhprp)), na.rm = T)) %>%
  filter(cntry %in% c("BE", "NL")) %>%
  t.test(trco_score ~ cntry, data = .)   # t > 0: Belgium minus the Netherlands
# Cohen's d by hand: the difference of the means over the pooled SD (NL - BE, so negative)

# the latent means if the two anchors held (partial scalar invariance, not supported on Day 4), in SD of Belgium
tradition_conformity_fit_partial <- cfa(
  model = "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp",
  data = ESS,
  estimator = "MLR",
  group = "cntry",
  group.equal = c("loadings", "intercepts"),
  group.partial = c("ipfrule~1", "ipmodst~1"),
  missing = "fiml.x",
  std.lv = T
)

tradition_conformity_fit_partial %>%
  parameterEstimates() %>%
  filter(op == "~1", lhs == "TRCO")`;

const ALIGN = `# step 1: the configural model, factor variances fixed to 1 in every group
tradition_conformity_fit_config <- cfa(
  model = "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp",
  data = ESS,
  estimator = "MLR",
  group = "cntry",
  missing = "fiml.x",
  std.lv = T
)

# its loadings and intercepts, one row per country
estimates <- tradition_conformity_fit_config %>% parameterEstimates()
lambda <- estimates %>%
  filter(op == "=~") %>%
  select(group, rhs, est) %>%
  pivot_wider(names_from = rhs, values_from = est) %>%
  select(-group) %>%
  as.matrix()
nu <- estimates %>%
  filter(op == "~1", lhs %in% c("ipmodst", "imptrad", "ipfrule", "ipbhprp")) %>%
  select(group, lhs, est) %>%
  pivot_wider(names_from = lhs, values_from = est) %>%
  select(-group) %>%
  as.matrix()
rownames(lambda) <- rownames(nu) <- c("BE", "LU", "NL")

# step 2: align - find the group means and variances that make the parameters as equal as possible
tradition_conformity_aligned <- invariance.alignment(
  lambda = lambda,
  nu = nu,
  wgt = matrix(sqrt(lavInspect(tradition_conformity_fit_config, "nobs")), 3, 4)
)

tradition_conformity_aligned$pars          # alpha0: aligned means, psi0: aligned variances
tradition_conformity_aligned$es.invariance # R2: how much of the non-invariance is absorbed`;

const HIGHER = `conservation_second <- cfa(
  model = "
    Tradition    =~ imptrad + ipmodst
    Conformity   =~ ipfrule + ipbhprp
    Security     =~ impsafe + ipstrgv
    Conservation =~ Tradition + Conformity + Security
  ",
  data = BE2,
  estimator = "MLR",
  missing = "fiml.x"
)

summary(
  object = conservation_second,
  fit.measures = T,
  standardized = T
)`;

const BIFACTOR = `immigration_bifactor <- cfa(
  model = "
    GENERAL =~ ipeqopt + ipudrst + impenv + imsmetn + imdfetn + impcntr + imbgeco + imueclt + imwbcnt
    UNIV    =~ ipeqopt + ipudrst + impenv
    ALLOW   =~ imsmetn + imdfetn + impcntr
    EFFECTS =~ imbgeco + imueclt + imwbcnt
  ",
  data = NL2,
  estimator = "MLR",
  missing = "fiml.x",
  std.lv = T,          # every factor variance 1
  orthogonal = T       # all factors uncorrelated: the bifactor claim
)

summary(object = immigration_bifactor, fit.measures = T, standardized = T)`;

const MTMM = `# the studio's simulated data: 3 traits x 3 methods, n = 1000
set.seed(2028)
mtmm_population <- '
  Parl =~ 0.75*parl_a + 0.7*parl_b + 0.7*parl_c
  Legal =~ 0.75*legal_a + 0.7*legal_b + 0.7*legal_c
  Police =~ 0.75*police_a + 0.7*police_b + 0.7*police_c
  Scale11 =~ 0.35*parl_a + 0.35*legal_a + 0.35*police_a
  Agree4 =~ 0.45*parl_b + 0.45*legal_b + 0.45*police_b
  Scale5 =~ 0.3*parl_c + 0.3*legal_c + 0.3*police_c
  Parl ~~ 1*Parl; Legal ~~ 1*Legal; Police ~~ 1*Police; Scale11 ~~ 1*Scale11; Agree4 ~~ 1*Agree4; Scale5 ~~ 1*Scale5
  Parl ~~ 0.6*Legal + 0.45*Police; Legal ~~ 0.55*Police
  Scale11 ~~ 0*Parl + 0*Legal + 0*Police + 0*Agree4 + 0*Scale5
  Agree4 ~~ 0*Parl + 0*Legal + 0*Police + 0*Scale5
  Scale5 ~~ 0*Parl + 0*Legal + 0*Police
'
mtmm <- simulateData(mtmm_population, sample.nobs = 1000, standardized = T)

# traits only: the methods ignored
trust_traits <- cfa(
  model = "
    Parl   =~ parl_a + parl_b + parl_c
    Legal  =~ legal_a + legal_b + legal_c
    Police =~ police_a + police_b + police_c
  ",
  data = mtmm,
  std.lv = T
)

# correlated traits, uncorrelated methods (CT-UM): one factor per method, uncorrelated with the traits and each other
trust_ctum <- cfa(
  model = "
    Parl    =~ parl_a + parl_b + parl_c
    Legal   =~ legal_a + legal_b + legal_c
    Police  =~ police_a + police_b + police_c
    Scale11 =~ parl_a + legal_a + police_a
    Agree4  =~ parl_b + legal_b + police_b
    Scale5  =~ parl_c + legal_c + police_c
    Scale11 ~~ 0*Parl + 0*Legal + 0*Police + 0*Agree4 + 0*Scale5
    Agree4  ~~ 0*Parl + 0*Legal + 0*Police + 0*Scale5
    Scale5  ~~ 0*Parl + 0*Legal + 0*Police
  ",
  data = mtmm,
  std.lv = T
)

# correlated uniqueness (CU): method effects as error covariances within each format
trust_cu <- cfa(
  model = "
    Parl   =~ parl_a + parl_b + parl_c
    Legal  =~ legal_a + legal_b + legal_c
    Police =~ police_a + police_b + police_c
    parl_a ~~ legal_a + police_a
    legal_a ~~ police_a
    parl_b ~~ legal_b + police_b
    legal_b ~~ police_b
    parl_c ~~ legal_c + police_c
    legal_c ~~ police_c
  ",
  data = mtmm,
  std.lv = T
)

# the fit, and the trait correlations each model estimates
list(traits = trust_traits, ct_um = trust_ctum, cu = trust_cu) %>%
  map(\\(f) fitMeasures(f, c("chisq", "df", "cfi", "rmsea")))
list(traits = trust_traits, ct_um = trust_ctum, cu = trust_cu) %>%
  map(\\(f) lavInspect(f, "cor.lv")[c("Parl", "Legal", "Police"), c("Parl", "Legal", "Police")])`;

const PROBE = `attitudes <- "
  ALLOW   =~ imsmetn + imdfetn + impcntr
  EFFECTS =~ imbgeco + imueclt + imwbcnt
"

# 1. the model in each country
attitudes_fit_countries <- ESS %>%
  split(as.factor(.$cntry)) %>%
  map(~ cfa(model = attitudes, data = ., estimator = "MLR", missing = "fiml.x"))

# 2. the Day 3 question: ALLOW tau-equivalent in the Netherlands?
allow_tau_nl <- cfa(model = "ALLOW =~ 1*imsmetn + 1*imdfetn + 1*impcntr", data = NL2, estimator = "MLR", missing = "fiml.x")

# 3. configural, metric, scalar
attitudes_fit_config <- cfa(model = attitudes, data = ESS, estimator = "MLR", group = "cntry", missing = "fiml.x")
attitudes_fit_metric <- ____
attitudes_fit_scalar <- ____

# 4. candidates for release: at most one intercept per factor, with a reason about the item
lavTestScore(attitudes_fit_scalar)

# 5. reliability in each country
attitudes_fit_countries %>% map(compRelSEM)`;

export function Day5Script() {
  const { d, error } = useDay5();
  const [solution, setSolution] = useState(false);
  if (error) return <LoadError what="The Day 5 outputs" error={error} />;
  if (!d) return <p className="hint">Loading the outputs from R…</p>;
  const m = d.means, nlPartial = m.latent.partial.means.find(x => x.group === 'NL')!, luPartial = m.latent.partial.means.find(x => x.group === 'LU')!;
  const h = d.higher, b = d.bifactor, mt = d.mtmm, p = d.probe;
  return (
    <article className="script">
      <nav className="sec-rail" aria-label="Sections">
        {SECTIONS.map((x, i) => <a key={i} href={`#/day/5#s${i + 1}`} title={x.title}>{i + 1}</a>)}
        <a href="#/day/5#yourturn" title="Your turn: the week-1 probe">✎</a>
      </nav>

      <div className="card sc-intro">
        <Eta size={56} mood="explaining" />
        <div>
          <p><b>Today:</b> the end of week 1 — and its payoff. With invariant measures we can compare what we actually care about: the means of constructs. Then three ways beyond one factor per construct — a factor above the factors, a general factor beside them, and method factors — and how to report a measurement model. The day ends with the week-1 probe: the whole procedure, once more, on your own, with two new constructs.</p>
          <p><b>How to work:</b> a new script <code>day5.R</code> in your project, the three country files from Day 0. Sections 1–8 are the core, the studio task practises section 6, and the probe (75–90 min) brings the whole first week together.</p>
        </div>
      </div>
      <div className="sc-apply" id="setup">
        <span className="sc-tag">Before you start in R</span>
        <p>The packages (sirt is new today: <code>install.packages("sirt")</code>) and the three countries:</p>
        <Code code={SETUP} />
      </div>

      <Sec n={1}>
        <p>Why go to such lengths for invariance? Because the question behind most comparisons is about <b>means</b>: are the Dutch less traditional than the Belgians? An item mean answers it only under conditions. For one item in two groups the model says</p>
        <div className="sc-formula"><Tex block>{'E(y_{g}) = \\tau_{g} + \\lambda_{g}\\,\\kappa_{g}'}</Tex></div>
        <p>— the item mean is the intercept plus the loading times the latent mean. A recap of Day 4, now with the means in front: draw the four cases of the course slides — equal intercepts and slopes; unequal intercepts, equal slopes; equal intercepts, unequal slopes; both unequal. In which does a difference in item means speak for the latent means?</p>
        <MeanEquation />
        <p>A t-test on sum or mean scores therefore assumes, silently, what Day 4 tested: equal loadings <i>and</i> equal intercepts. It weights every item equally, and it carries the measurement error into the comparison, which shrinks standardized differences such as Cohen’s d — comparing those, or correlations of sum scores, also needs equal error variances (strict invariance).</p>
        <Task question="By the mean score, Luxembourg is as traditional as Belgium. What will the latent means say, once the two bent intercepts of Day 4 are released?"
          options={['The same: the mean score is unbiased.', 'Luxembourg lower: the released items are the ones Luxembourgers find easier to agree with, so the mean score hides a lower latent mean.', 'Luxembourg higher.']} answer={1}
          explain={<>With “rules” and “modest” released, the anchors “tradition” and “behave properly” carry the comparison — and “behave properly” puts Luxembourg below Belgium ({d.means.item_means.map(r => `${r.cntry} ${(r.ipbhprp as number).toFixed(2)}`).join(', ')}). The mean score averages over the bent rulers. See the figure below.</>} />
        <Apply>
          <Code code={MEANS} />
          <MeansCompare d={d} />
          <p>The t-test finds the Netherlands below Belgium: t({m.t.df.toFixed(0)}) = {m.t.t.toFixed(2)} (positive: BE − NL), {m.t.p < 0.001 ? 'p < .001' : `p = ${f3(m.t.p)}`}, d = {f2(m.t.d)}. <b>Day 4 did not support partial scalar invariance</b> for tradition/conformity (ΔCFI −.024 against metric). So read the latent means as a sensitivity analysis — what the comparison would say if the two anchors held: the Netherlands {sgn(nlPartial.std)} SD, Luxembourg {sgn(luPartial.std)} SD (p = {f3(luPartial.p ?? 1)}). With effects coding (Day 4, section 9) the same means on the 1–6 scale of the items: {m.latent.partial.means.map(x => `${x.group} ${x.eff.toFixed(2)}`).join(', ')}.</p>
          <Check label="Latent mean of the Netherlands (SD of Belgium)" expect={nlPartial.std} tol={0.005} unit={`${sgn(nlPartial.std, 3)} — if the two anchors held`} hint="the row TRCO ~1 for group 3 (NL)" />
        </Apply>
        <Deeper title="Which equality allows which comparison — the full table">
          <table className="rp-table left">
            <thead><tr><th>equal across groups</th><th>level</th><th>what it means, what it allows</th></tr></thead>
            <tbody>
              <tr><td>the pattern of fixed and free parameters</td><td>configural</td><td>the same model structure</td></tr>
              <tr><td>loadings Λ</td><td>metric</td><td>the same unit: relations (covariances, unstandardized paths) can be compared</td></tr>
              <tr><td>intercepts τ</td><td>scalar</td><td>the same systematic response bias: the prerequisite for comparing latent means — and raw mean scores</td></tr>
              <tr><td>factor variances</td><td>—</td><td>the same heterogeneity; with them, equal covariances are equal correlations</td></tr>
              <tr><td>factor covariances</td><td>—</td><td>with equal variances, equal correlations</td></tr>
              <tr><td>latent means κ</td><td>—</td><td>with equal intercepts: the same latent means — the test of a mean difference</td></tr>
              <tr><td>error variances Θ</td><td>strict</td><td>with equal factor variances, equal reliabilities: needed for standardized differences and correlations of sum scores</td></tr>
            </tbody>
          </table>
          <p className="hint">After the course slides; Day 4 shows the same ladder. Three ways to give the latent means an origin are on Day 4 (section 9). All three need (partial) scalar invariance; none of them makes non-invariant intercepts comparable.</p>
        </Deeper>
        <Transfer answer={<p>Most studies compare indices or sum scores with a t-test or ANOVA — which assumes scalar (for d: strict) invariance without testing it. If the groups are countries, survey modes or waves, test the ladder first; if they are, say, men and women in one country, the question is the same, only less often asked.</p>}>
          <p>How have you compared means so far — with indices or sum scores? What would you need to test before the comparison means what you want it to mean?</p>
        </Transfer>
      </Sec>

      <Sec n={2}>
        <p>Day 4 climbed the ladder from configural to scalar and released single equalities. Two classical strategies frame this (course slides). <b>Backward</b>: start with the fully invariant model and release the invariance of one item at a time, each with a likelihood-ratio test. <b>Forward</b>: start with the fully non-invariant model and set items invariant one by one.</p>
        <p>Each step is judged with the scaled χ² difference and with Chen’s criteria: {CHEN_RULE} Beyond this course: JRule (modification indices judged together with their expected change) and Bayesian approximate invariance. The trouble starts when the release of equalities and the addition of parameters are left to the indices alone.</p>
        <Apply what="Tradition/conformity and universalism in the Benelux, ESS 2004">
          <p>The two values of Days 2 and 3, all three countries, the scalar model — and then six steps, each taking the largest index at the time: a score test for an equality, or a modification index for a cross-loading or error covariance. Move the slider step by step; before each step, ask yourself: would I free this — and why?</p>
          <CascadeView d={d} />
          <p>The course slides show the same pattern on other data (χ² from 758 to 36 in six steps). The lesson is not “never modify” — the first steps here, the intercepts of “rules” and “modest” and the imptrad ↔ impenv covariance, are the ones Days 2 and 4 argued about. It is that every later step needs a reason given <i>before</i> the index, or a test in new data: half of the sample, another country, another round.</p>
          <Predict question={`In half A, steps 4–6 lower χ² by ${(d.cascade.half_a[3].fit['chisq.scaled'] - d.cascade.half_a[6].fit['chisq.scaled']).toFixed(0)} (from ${d.cascade.half_a[3].fit['chisq.scaled'].toFixed(0)} to ${d.cascade.half_a[6].fit['chisq.scaled'].toFixed(0)}). The same three steps in half B: by how much will they lower χ² there?`} min={0} max={60} step={1} start={40} truth={Math.round(d.cascade.half_b[3].fit['chisq.scaled'] - d.cascade.half_b[6].fit['chisq.scaled'])} format={v => v.toFixed(0)}
            explain={() => <>By only {(d.cascade.half_b[3].fit['chisq.scaled'] - d.cascade.half_b[6].fit['chisq.scaled']).toFixed(0)} — the late steps fitted half A, not the countries. Switch the figure to “found in half A, tested in half B”.</>} />
          <Deeper title="The six steps in R">
            <Code code={`values_fit_cascade <- cfa(\n  model = "\n${d.cascade_final.model.split('\n').map(l => l.trim()).filter(Boolean).map(l => `    ${l}`).join('\n')}\n  ",\n  data = ESS,\n  estimator = "MLR",\n  group = "cntry",\n  group.equal = c("loadings", "intercepts"),\n  group.partial = c(${d.cascade_final.free.map(x => `"${x}"`).join(', ')}),\n  missing = "fiml.x"\n)`} />
          </Deeper>
        </Apply>
        <Transfer answer={<p>Groups: countries, survey modes, men and women, education groups. Time: the waves of a panel (Day 9). Fit: the scaled Δχ² is reported, the decision follows Chen’s criteria for the sample size at hand.</p>}>
          <p>Do you need measurement invariance in your research — across groups, across time, or both? And which fit measures would you use to decide?</p>
        </Transfer>
      </Sec>

      <Sec n={3}>
        <p>With many groups, full or partial scalar invariance often fails — and releasing intercept after intercept becomes the cascade above. <b>Alignment</b> (Asparouhov & Muthén, 2014) takes another route. First the configural model is estimated, with no equalities at all. Then, like the rotation of an exploratory factor analysis, the group means and variances are chosen so that the loadings and intercepts become <i>as equal as possible</i>: a simplicity function rewards many nearly invariant parameters and a few large differences over many medium ones. No equality is imposed and no χ² test is passed. The result is a set of means that are comparable <i>if</i> the assumption holds: most parameters are approximately invariant — as a rule of thumb, no more than about a quarter of them differ substantially.</p>
        <Apply>
          <Code code={ALIGN} />
          <p>The aligned means: Belgium 0, Luxembourg {sgn(d.alignment.means[1])}, the Netherlands {sgn(d.alignment.means[2])} (in SD of Belgium). Further from Belgium than the partial model ({sgn(nlPartial.std)}) — because alignment chooses its anchors differently. Look at the intercepts after alignment:</p>
          <table className="rp-table">
            <thead><tr><th>intercept</th>{d.groups.map(g => <th key={g}>{g}, configural</th>)}{d.groups.map(g => <th key={g + 'a'}>{g}, aligned</th>)}</tr></thead>
            <tbody>{['ipmodst', 'imptrad', 'ipfrule', 'ipbhprp'].map((it, k) => <tr key={it}><td>{it}</td>{d.alignment.nu_config.map((r, g) => <td key={g}>{r[k].toFixed(2)}</td>)}{d.alignment.nu_aligned.map((r, g) => <td key={g + 'a'}><b>{r[k].toFixed(2)}</b></td>)}</tr>)}</tbody>
          </table>
          <p>Only “behave properly” ends up equal across the three countries; the other three intercepts stay far apart. Alignment has in effect found a one-item anchor — the 25 % rule is clearly broken here, and the aligned means are as uncertain as the partial ones. sirt also prints an R² (here {f3(d.alignment.r2[1])} for the intercepts); it is computed relative to the raw size of the parameters and comes out near 1 almost always, so it says little about invariance.</p>
          <Check label="Aligned latent mean of the Netherlands" expect={d.alignment.means[2]} tol={0.005} unit={`${sgn(d.alignment.means[2], 3)} — alpha0 for NL`} hint="tradition_conformity_aligned$pars, column alpha0" />
          <p className="hint">With three countries alignment is a demonstration; it is designed for many groups (the course slides: 15 ESS countries). Fixed alignment (as here) sets the first group’s mean to 0 and variance to 1; free alignment estimates them too. Bayesian approximate invariance — equalities allowed to deviate a little through priors — is the third way; in R, with <code>blavaan</code>.</p>
        </Apply>
      </Sec>

      <Sec n={4}>
        <p>When first-order factors correlate highly, something may stand behind them. In Schwartz’s theory, tradition, conformity and security make up the higher-order value <b>conservation</b>. A <b>second-order</b> model writes it down: the first-order factors are the indicators of a factor above them.</p>
        <Task question="Count first: three first-order factors with two items each, one second-order factor. How many parameters does the second-order part have, and what does it reproduce?"
          options={['6 parameters reproducing 6 variances and covariances of the first-order factors: just identified.', '3 parameters for 6 numbers: overidentified.', 'It is not identified.']} answer={0}
          explain={<>Two free second-order loadings (one is the marker), the variance of conservation, and three disturbance variances: 6 — for the 3 variances and 3 covariances of the first-order factors. The overall df = {h.second.fit.df} come from the measurement part, the same as in the correlated model.</>} />
        <Apply what="Conservation in Belgium, ESS 2004">
          <HigherOrder d={d} />
          <Code code={HIGHER} />
          <p className="hint">The general rule: with k first-order factors, a second-order factor replaces k(k + 1)/2 variances and covariances by 2k parameters (k − 1 loadings, its variance, k disturbances) and gains k(k − 3)/2 degrees of freedom — 0 for three factors, 2 for four, 5 for five. The course slides show the syndrome of group-focused enmity as a large example: some eight to ten prejudices, from xenophobia to sexism, as facets of one second-order factor.</p>
          <Check label="Second-order loading of Conformity (standardized)" expect={h.second.est.find(e => e.op === '=~' && e.lhs === 'Conservation' && e.rhs === 'Conformity')!.std} tol={0.005} unit="Std.all of Conservation =~ Conformity — almost 1: a warning sign" />
        </Apply>
      </Sec>

      <Sec n={5}>
        <p>A second-order factor works <i>through</i> the first-order factors. A <b>bifactor</b> model puts a general factor <i>beside</i> them: every item measures the general factor and its own facet, and all factors are uncorrelated. The question it asks: is there one thing behind all the items, and how much is left for the facets?</p>
        <Task question="Will the bifactor model fit better than three correlated factors — and would that settle that there is one general factor?"
          options={['Yes and yes.', 'It will fit better — it has more parameters and absorbs odd response patterns too — but that does not settle it.', 'It will fit worse.']} answer={1}
          explain={<>Better fit is almost guaranteed and therefore no argument (Reise, Kim, Mansolf & Widaman, 2016). What counts is how much of the total score is the general factor: omega hierarchical.</>} />
        <Apply what="Universalism and attitudes toward immigration, NL 2004">
          <BifactorView d={d} />
          <Code code={BIFACTOR} />
          <div className="sc-formula"><Tex block>{'\\omega_H = \\frac{(\\sum_i \\lambda_{iG})^2}{(\\sum_i \\lambda_{iG})^2 + \\sum_s (\\sum_{i \\in s} \\lambda_{is})^2 + \\sum_i \\theta_{ii}}'}</Tex></div>
          <p className="hint">Omega hierarchical: the share of the variance of the total score that is the general factor. From the standardized solution (a sum of z-standardized items): ω<sub>H</sub> = {f3(b.omega_h)}; for the raw sum score, as semTools computes it with <code>compRelSEM(immigration_bifactor, true = list(GENERAL = "GENERAL"), obs.var = F)</code>: {f3(b.omega_h_raw)} (the items have 1–4, 1–6 and 0–10 scales). Reise et al. (2013) take ω<sub>H</sub> ≥ .50 as a minimum for a meaningful total score and .75–.80 as “essentially unidimensional”. Note also how the EFFECTS facet collapses: its specific loadings are small and not significant — the typical bifactor pattern when the general factor absorbs a facet.</p>
        </Apply>
        <Transfer answer={<p>Two candidates: a general attitude toward immigration (the allow and effects items) with specific facets — or a response style that runs through all items asked in the same format. The bifactor model cannot tell which; the items’ content and the fact that universalism hardly loads point to the first.</p>}>
          <p>What could the general factor here be — and how would you know?</p>
        </Transfer>
      </Sec>

      <Sec n={6}>
        <p>Every measurement shares something with every other measurement made the same way. Campbell and Fiske (1959) turned this into a design: measure several <b>traits</b> with several <b>methods</b>, and read the correlations. Today the multitrait-multimethod matrix is modelled — with method factors or with correlated uniquenesses (CU). The same logic lies behind common method variance in surveys (Podsakoff et al., 2003): items in the same format, the same block or the same wording share variance that is neither construct.</p>
        <Apply what="Trust in institutions, three formats — simulated data">
          <MtmmMatrix d={d} />
          <Code code={MTMM} />
          <table className="rp-table">
            <thead><tr><th>model</th><th>χ² (df)</th><th>CFI</th><th>RMSEA</th></tr></thead>
            <tbody>{(['traits', 'ctcm', 'cu'] as const).map(k => <tr key={k}><td>{k === 'traits' ? 'traits only' : k === 'ctcm' ? 'traits + uncorrelated method factors (CT-UM)' : 'traits + correlated uniqueness (CU)'}</td><td>{mt.fits[k].chisq.toFixed(1)} ({mt.fits[k].df})</td><td>{f3(mt.fits[k].cfi)}</td><td>{f3(mt.fits[k].rmsea)}</td></tr>)}</tbody>
          </table>
          <Check label="χ² of the method-factor model (CT-UM)" expect={mt.fits.ctcm.chisq} tol={0.05} unit={`χ²(${mt.fits.ctcm.df}) = ${mt.fits.ctcm.chisq.toFixed(2)} — the same for CU`} hint="fitMeasures(trust_ctum, c(&quot;chisq&quot;, &quot;df&quot;)); with another lavaan version simulateData may draw other data" />
          <p>The two ways of modelling the methods fit identically here: with three traits, a method factor over three items is just identified, like their three covariances. With more traits they differ — a method factor claims one method effect shared by all items of a format; correlated uniqueness allows a different one for every pair. Here the fit cannot choose between them; the studio task asks you to decide whether and how to model the methods — and the reason must do it.</p>
          <Deeper title="Let the methods correlate too: CTCM — better fit, wrong traits">
            <p>The full correlated-traits-correlated-methods model frees the correlations among the method factors as well. On these data it fits even better — χ²({mt.ctcm_true.fit.df}) = {mt.ctcm_true.fit.chisq.toFixed(2)} — but it gets the traits wrong: trait correlations {mt.ctcm_true.trait_cor.map(f2).join(', ')} instead of the true {mt.true_cor.map(f2).join(', ')}, and method correlations of {mt.ctcm_true.method_cor.map(f2).join(', ')} that the simulation never put in. Traits and correlated methods trade variance with each other; the fit does not choose.</p>
          </Deeper>
          <Deeper title="A method factor for one instrument: response style in the values questionnaire">
            <p>Without several methods there is no MTMM — but one method can still leave a trace. For the values questionnaire, Schwartz et al. (2012) add one factor on <i>all</i> value items with equal loadings: whatever makes a respondent rate every value as more or less important (response style, often read as social desirability). It needs the whole circle of values — with only two positively correlated values, the method factor cannot be told apart from their correlation. All 21 items, the four higher values, and a method factor with one label:</p>
            <Code code={`values_method <- cfa(\n  model = "\n    OPENNESS      =~ ipcrtiv + impfree + impdiff + ipadvnt + ipgdtim + impfun\n    ENHANCEMENT   =~ imprich + iprspot + ipshabt + ipsuces\n    CONSERVATION  =~ impsafe + ipstrgv + ipfrule + ipbhprp + imptrad + ipmodst\n    TRANSCENDENCE =~ ipeqopt + ipudrst + impenv + iphlppl + iplylfr\n    METHOD =~ m*ipcrtiv + m*impfree + m*impdiff + m*ipadvnt + m*ipgdtim + m*impfun +\n              m*imprich + m*iprspot + m*ipshabt + m*ipsuces + m*impsafe + m*ipstrgv +\n              m*ipfrule + m*ipbhprp + m*imptrad + m*ipmodst + m*ipeqopt + m*ipudrst +\n              m*impenv + m*iphlppl + m*iplylfr\n    METHOD ~~ 0*OPENNESS + 0*ENHANCEMENT + 0*CONSERVATION + 0*TRANSCENDENCE\n  ",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x",\n  std.lv = T\n)`} />
            <p>The method factor loads {d.method_factor.with.loadings.map(f2).join(' to ')} (standardized). And it changes the picture of the circle: openness and conservation correlate {f2(d.method_factor.without.cor[2][0])} without it, {f2(d.method_factor.with.cor[2][0])} with it — the opposites of Schwartz’s circle become opposites only once the response style has its own factor. Fit: CFI {f3(d.method_factor.without.fit['cfi.robust'])} → {f3(d.method_factor.with.fit['cfi.robust'])}. This is the alternative to centering the ratings on each person’s mean (Day 3, section 7).</p>
          </Deeper>
        </Apply>
        <Transfer><p>Do you use different methods in your research — different numbers of categories, different survey modes, different wordings? Could an MTMM design answer a question you have about them?</p></Transfer>
      </Sec>

      <Sec n={7}>
        <p>A CFA is only as convincing as its report. The checklist after Brown (2015, pp. 127–129), in our words — it is also the project step of today:</p>
        <ol>{REPORT.map(r => <li key={r}>{r}</li>)}</ol>
        <p className="hint">The studio drafts most of this for your project: lavaan tab → Report .qmd, with the reasons from your logbook.</p>
      </Sec>

      <Sec n={8}>
        <p>Week 1 in one page — Day 3’s five steps, now with groups and means. For each step: what to do, how to tell it worked, and what to do if not.</p>
        <table className="rp-table left week1-tab">
          <thead><tr><th>step</th><th>how to tell it worked</th><th>if not</th></tr></thead>
          <tbody>
            <tr><td><b>0 · Plan</b> (Day 2): write down which changes you would accept, before any index</td><td>a list in your project log</td><td>—</td></tr>
            <tr><td><b>1 · One construct at a time</b> (Day 1): reflective? scaled? identified? MLR + FIML</td><td>df ≥ 0, no warning about vcov or negative variances; CFI/RMSEA/SRMR acceptable; loadings ≥ .4</td><td>more items, a reason-based modification, another estimator for few categories (Day 2)</td></tr>
            <tr><td><b>2 · All constructs together</b> (Days 2–3): the simultaneous CFA; restrictions the theory claims; ω</td><td>factor correlations below .85; restrictions within Chen’s limit; ω reported</td><td>a cross-loading or error covariance with a reason about the items; drop a troublemaker item</td></tr>
            <tr><td><b>3 · Each group on its own</b> (Day 4)</td><td>the baseline model fits in every group</td><td>a group-specific parameter with a reason — or leave the group out</td></tr>
            <tr><td><b>4 · The ladder</b> (Day 4): configural → metric → scalar</td><td>each rung within Chen’s criteria; a partial model judged against metric too</td><td>release with reasons, two anchors per factor; report how the result depends on the anchors</td></tr>
            <tr><td><b>5 · The comparison</b> (Day 5)</td><td>latent means under the level reached</td><td>no mean comparison — or alignment for many groups, as a sensitivity analysis</td></tr>
            <tr><td><b>6 · Validate and report</b></td><td>modifications replicate in a holdout half or another sample; the whole path is in the report</td><td>say which steps were data-driven</td></tr>
          </tbody>
        </table>
        <p>Never compare raw mean scores without scalar invariance — and not their standardized differences or correlations without strict invariance. Week 2 builds structural models on these measurement models: a path between two latent variables is only as good as the measurement of both.</p>
      </Sec>

      <section id="studio" className="sc-step">
        <header><span className="sc-n">Studio</span><h2>The studio task of today</h2></header>
        <p>“Traits and methods” runs on the simulated MTMM data of section 6 — the same population and seed, so the studio and R give the same numbers for the same model.</p>
        <p><a className="btn primary" href="#/model?task=d5-mtmm">Start the studio task →</a></p>
      </section>

      <section id="yourturn" className="sc-step">
        <header><span className="sc-n">✎</span><h2>Your turn: the week-1 probe</h2><span className="hint" style={{ margin: 0 }}>about 75–90 min · evening or weekend</span></header>
        <p className="sc-goal"><b>After this part</b> you have run the whole procedure of week 1 on your own, on two constructs you have not analysed before.</p>
        <p>Attitudes toward immigration in Belgium, Luxembourg and the Netherlands: <b>ALLOW</b> (<code>imsmetn</code>, <code>imdfetn</code>, <code>impcntr</code> — reversed in the setup, higher = allow more) and <b>EFFECTS</b> (<code>imbgeco</code> “{LABELS.imbgeco}”, <code>imueclt</code> “{LABELS.imueclt}”, <code>imwbcnt</code> “{LABELS.imwbcnt}”; 0–10, higher = more positive). The rules: no cross-loadings and no error covariances; per factor you may release at most <b>one</b> intercept, the same in all countries — and only with a reason about the item’s wording. Then:</p>
        <ol>
          <li>Fit the two-factor model in each country. Does it hold everywhere?</li>
          <li>A Day 3 question first: are the three ALLOW items tau-equivalent in the Netherlands?</li>
          <li>Test configural, metric and scalar invariance.</li>
          <li>Find candidates with the score test, release at most one intercept per factor that you can argue from the wording — write the reason — and decide whether partial scalar invariance is reached.</li>
          <li>Compute ω for both factors in each country.</li>
          <li>If you may: which country is most open, which sees immigration most positively?</li>
        </ol>
        <Code code={PROBE} />
        <p>Numbers to check on the way:</p>
        <div className="ncheck-row">
          <Check label="configural: scaled χ²" expect={p.fits.config['chisq.scaled']} tol={0.1} unit={`χ²(${p.fits.config.df}) = ${p.fits.config['chisq.scaled'].toFixed(1)}`} />
          <Check label="ALLOW tau-equivalent in NL: scaled χ²" expect={p.tau.fit['chisq.scaled']} tol={0.1} unit={`χ²(${p.tau.fit.df}) = ${p.tau.fit['chisq.scaled'].toFixed(1)} — the congeneric model has df = 0, so this is the test`} />
          <Check label="scalar: robust CFI" expect={p.fits.scalar['cfi.robust']} tol={0.005} unit={`CFI ${f3(p.fits.scalar['cfi.robust'])}`} />
        </div>
        <p className="hint">Reading <code>lavTestScore()</code>: the rows name equalities with internal labels (<code>.p12. == .p40.</code>); look them up with <code>parTable()</code>, as on Day 4, section 7.</p>
        <button className="btn" onClick={() => setSolution(v => !v)} aria-expanded={solution}>{solution ? 'Hide the solution' : 'Show the solution'}</button>
        {solution && (
          <div className="sc-solution">
            <ProbeTable d={d} />
            <p><b>1.</b> The model holds in Belgium and the Netherlands; in Luxembourg it is acceptable, not good (CFI {f3(p.base.LU['cfi.robust'])}, RMSEA {f3(p.base.LU['rmsea.robust'])}). <b>2.</b> No: equal loadings for the three ALLOW items cost χ²({p.tau.fit.df}) = {p.tau.fit['chisq.scaled'].toFixed(1)} — the three items are not equally strong measures of ALLOW. Not needed for the comparison, but it means a sum score would weight them wrongly. <b>3.</b> Metric invariance holds (ΔCFI {sgn(p.fits.metric['cfi.robust'] - p.fits.config['cfi.robust'], 3)}; Δχ²<sub>SB</sub>({p.lrt.metric.ddf}) = {p.lrt.metric.dchisq.toFixed(1)}, p &lt; .001 — significant in samples this large, but well within Chen’s limit); scalar fails (ΔCFI {sgn(p.fits.scalar['cfi.robust'] - p.fits.metric['cfi.robust'], 3)}). <b>4.</b> The score test names the intercepts of imbgeco ({p.score[0].X2.toFixed(0)}) and imsmetn ({p.score[1].X2.toFixed(0)}) — one per factor. Reasons are near at hand: whether immigration is “good for the economy” depends on a country’s economy (Luxembourg’s labour market depends on immigrants); “the same race or ethnic group as the majority” refers to a different majority in each country. Released: CFI {f3(p.fits.partial['cfi.robust'])}, ΔCFI {sgn(p.fits.partial['cfi.robust'] - p.fits.metric['cfi.robust'], 3)} against metric — <b>partial scalar invariance is reached</b>, with two anchors per factor. <b>5.</b> ω: {Object.entries(p.omega).map(([g, o]) => `${g} ${f2(o[0])} / ${f2(o[1])}`).join(', ')} (ALLOW / EFFECTS). <b>6.</b> In SD of Belgium — EFFECTS: {p.means.filter(x => x.factor === 'EFFECTS' && x.group !== 'BE').map(x => `${x.group} ${sgn(x.std)}`).join(', ')}; ALLOW: {p.means.filter(x => x.factor === 'ALLOW' && x.group !== 'BE').map(x => `${x.group} ${sgn(x.std)} (p = ${f3(x.p ?? 1)})`).join(', ')}. Luxembourgers see immigration as most positive for their country, by almost half a standard deviation; whether to allow immigrants, the three countries hardly differ.</p>
            <Code code={`attitudes_fit_metric <- cfa(model = attitudes, data = ESS, estimator = "MLR", group = "cntry",\n  group.equal = "loadings", missing = "fiml.x")\nattitudes_fit_scalar <- cfa(model = attitudes, data = ESS, estimator = "MLR", group = "cntry",\n  group.equal = c("loadings", "intercepts"), missing = "fiml.x")\nattitudes_fit_partial <- cfa(model = attitudes, data = ESS, estimator = "MLR", group = "cntry",\n  group.equal = c("loadings", "intercepts"), group.partial = c("imbgeco~1", "imsmetn~1"), missing = "fiml.x")\n\ncompareFit(scalar = attitudes_fit_partial, metric = attitudes_fit_metric, config = attitudes_fit_config,\n  argsLRT = list(method = "satorra.bentler.2001")) %>% summary()\n\n# the latent means, in SD of Belgium\nattitudes_fit_partial %>% update(std.lv = T) %>% parameterEstimates() %>% filter(op == "~1", lhs %in% c("ALLOW", "EFFECTS"))`} />
            <ROut title="R output · compareFit(partial, metric, config)"><pre className="syntax"><code>{p.compare_text}</code></pre></ROut>
            <p className="hint">Compare with tradition/conformity (Day 4): there, two releases on one factor were not enough. Here, one per factor is — the same procedure, a different answer. That is why the ladder is climbed for every construct.</p>
          </div>
        )}
      </section>
    </article>
  );
}
