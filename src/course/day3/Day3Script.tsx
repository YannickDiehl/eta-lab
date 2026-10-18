// Day 3 as an interactive script: restrictions, identification and the simultaneous CFA, after
// the Day 3 slides of the Essex SEM course (2024), the worksheet and homework Day 3, the R code Day 3 and
// the Lugano 2025 code documentation. The data: tradition/conformity, universalism and attitudes
// toward immigration in the Netherlands, ESS 2004. All numbers come from R
// (scripts/day3-outputs.R) with the code used throughout η Lab: MLR, FIML, compareFit with Satorra–Bentler.
import { useState, type ReactNode } from 'react';
import { LoadError, Tex } from '../../components/ui.tsx';
import { Eta } from '../../eta/Eta.tsx';
import { CUTOFFS } from '../../math/cutoffs.ts';
import { Code } from '../day2.tsx';
import { LABELS } from '../day1/Day1Script.tsx';
import { f3 } from '../day1/data.ts';
import { MiniTask, NumberCheck, useStoredValue } from '../day0/widgets.tsx';
import { ALLOW_ITEMS, pick, sgn, TRCO_ITEMS, UNIV_ITEMS, useDay3 } from './data.ts';
import { LadderExplorer, LadderTable, TwoWaysTau } from './figures1.tsx';
import { AlphaOmega, ByHand, ScfaView, SCFA_LABELS, SeparateVsSimultaneous, StdConverter } from './figures2.tsx';

const SECTIONS: { title: string; goal: string }[] = [
  { title: 'Restrictions: fixed, constrained, free', goal: 'you know the three kinds of parameters and the four nested models of classical test theory — and what each one claims about the items.' },
  { title: 'Identification: are there enough numbers?', goal: 'you can count the degrees of freedom of a model, name its identification status, and know what the information matrix adds.' },
  { title: 'Solving a model by hand', goal: 'you can compute the loadings of a three-item factor from its correlations — and see why two items are not enough.' },
  { title: 'Equality constraints in lavaan', goal: 'you can fix a parameter, set parameters equal with labels, and free a marker loading.' },
  { title: 'The restriction ladder for tradition and conformity', goal: 'you have estimated the four models, compared them, and can say how far the items are interchangeable.' },
  { title: 'Reliability: alpha, omega and sum scores', goal: 'you know why alpha needs tau-equivalence, and how to compute omega in lavaan.' },
  { title: 'The simultaneous CFA', goal: 'you have estimated three constructs in one model and can judge convergent and discriminant validity.' },
  { title: 'Local misfit: cross-loadings or correlated errors?', goal: 'you can read modification indices with their expected change, and know what a cross-loading and an error covariance claim.' },
  { title: 'Reading the estimates: standardized and unstandardized', goal: 'you can convert a loading between its unstandardized and standardized form, and know which standardized solution a study reports.' },
  { title: 'A strategy for your measurement models', goal: 'you have a five-step plan for the measurement models of your own project.' },
];

function Sec({ n, children }: { n: number; children: ReactNode }) {
  const s = SECTIONS[n - 1];
  return (
    <section id={`s${n}`} className="sc-step">
      <header><span className="sc-n">{n}</span><h2>{s.title}</h2></header>
      <p className="sc-goal"><b>After this part</b> {s.goal}</p>
      {children}
    </section>
  );
}
function ROut({ title = 'R output', children }: { title?: string; children: ReactNode }) {
  return <details className="rout"><summary>{title}</summary><div>{children}</div></details>;
}
function Apply({ children, what = 'Tradition and conformity, NL 2004' }: { children: ReactNode; what?: string }) {
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
  const [v, setV] = useStoredValue(`d3:${label}`);
  return <NumberCheck label={label} expect={expect} tol={tol} value={v} onChange={setV} unit={unit} hint={hint} />;
}
function Task(props: Omit<Parameters<typeof MiniTask>[0], 'done' | 'onRight'>) {
  const [done, setDone] = useState(false);
  return <MiniTask {...props} done={done} onRight={() => setDone(true)} />;
}

const SETUP = `library(tidyverse); library(sjlabelled); library(sjmisc)
library(lavaan); library(semTools)

NL2 <- read_spss(path = "NL2.sav", convert.factors = F, drop.labels = T) %>%
  mutate(across(ipcrtiv:impfun, \\(x) rec(x, rec = "rev")),     # values: higher = more important
         across(imsmetn:impcntr, \\(x) rec(x, rec = "rev")))    # allow immigrants (section 7): higher = allow more

# the one-factor model of Day 1, used in section 2
tradition_conformity_fit <- cfa(
  model = "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp",
  data = NL2,
  estimator = "MLR",
  missing = "fiml.x"
)
# lavaan warns "some cases are empty and will be ignored":
# 21 respondents answered none of the four items`;

const LADDER = `tradition_conformity_congeneric <- cfa(
  model = "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp",
  data = NL2,
  estimator = "MLR",
  missing = "fiml.x"
)

# tau-equivalent: equal loadings (all fixed to 1, the factor variance is free)
tradition_conformity_tau <- cfa(
  model = "TRCO =~ 1*ipmodst + 1*imptrad + 1*ipfrule + 1*ipbhprp",
  data = NL2,
  estimator = "MLR",
  missing = "fiml.x"
)

# parallel: equal loadings and equal error variances (the same label e)
tradition_conformity_parallel <- cfa(
  model = "
    TRCO =~ 1*ipmodst + 1*imptrad + 1*ipfrule + 1*ipbhprp
    ipmodst ~~ e*ipmodst
    imptrad ~~ e*imptrad
    ipfrule ~~ e*ipfrule
    ipbhprp ~~ e*ipbhprp
  ",
  data = NL2,
  estimator = "MLR",
  missing = "fiml.x"
)

# strictly parallel: also equal intercepts (the same label i)
tradition_conformity_strictly_parallel <- cfa(
  model = "
    TRCO =~ 1*ipmodst + 1*imptrad + 1*ipfrule + 1*ipbhprp
    ipmodst ~~ e*ipmodst
    imptrad ~~ e*imptrad
    ipfrule ~~ e*ipfrule
    ipbhprp ~~ e*ipbhprp
    ipmodst ~ i*1
    imptrad ~ i*1
    ipfrule ~ i*1
    ipbhprp ~ i*1
  ",
  data = NL2,
  estimator = "MLR",
  missing = "fiml.x"
)

compFit.tradition_conformity <- compareFit(
  congeneric = tradition_conformity_congeneric,
  tau = tradition_conformity_tau,
  parallel = tradition_conformity_parallel,
  strictly_parallel = tradition_conformity_strictly_parallel,
  argsLRT = list(method = "satorra.bentler.2001")
)

summary(
  object = compFit.tradition_conformity,
  fit.measures = c("chisq.scaled", "df.scaled", "pvalue.scaled", "rmsea.robust", "cfi.robust", "tli.robust", "srmr", "aic", "bic")
)`;

const OMEGA = `# omega with labels and a defined parameter (:=)
tradition_conformity_omega <- cfa(
  model = "
    TRCO =~ NA*ipmodst + l1*ipmodst + l2*imptrad + l3*ipfrule + l4*ipbhprp
    TRCO ~~ 1*TRCO
    ipmodst ~~ e1*ipmodst
    imptrad ~~ e2*imptrad
    ipfrule ~~ e3*ipfrule
    ipbhprp ~~ e4*ipbhprp
    omega := (l1 + l2 + l3 + l4)^2 / ((l1 + l2 + l3 + l4)^2 + e1 + e2 + e3 + e4)
  ",
  data = NL2,
  estimator = "MLR",
  missing = "fiml.x"
)

tradition_conformity_omega %>%
  parameterEstimates() %>%
  filter(op == ":=")

# the same in one line with semTools: omega, and alpha (tau.eq = T)
tradition_conformity_congeneric %>% compRelSEM()
tradition_conformity_congeneric %>% compRelSEM(tau.eq = T)`;

const SCFA = `# the allow items were reversed in the setup: 1 allow none … 4 allow many
values_immigration_fit <- cfa(
  model = "
    TRCO  =~ ipmodst + imptrad + ipfrule + ipbhprp
    UNIV  =~ ipeqopt + ipudrst + impenv
    ALLOW =~ imsmetn + imdfetn + impcntr
  ",
  data = NL2,
  estimator = "MLR",
  missing = "fiml.x"
)

summary(
  object = values_immigration_fit,
  fit.measures = T,
  standardized = T
)`;

const LOCAL = `values_immigration_fit %>%
  modificationindices(standardized = T, sort. = T) %>%
  head(10)

# standardized residuals: |z| > 2 points to local misfit
lavResiduals(values_immigration_fit)$cov.z`;

const STUDIO_SAMPLE = (n: number, f: Record<string, number>) => `# eta Lab's studio uses the respondents who answered all variables used in eta Lab
NL2_studio <- NL2 %>%
  mutate(
    agea = 2004 - yrbrn,
    female = as.numeric(gndr == 2)
  ) %>%
  drop_na(ipcrtiv:impfun, imsmetn:impcntr, imbgeco, imueclt, imwbcnt, agea, female, eduyrs)

nrow(NL2_studio)   # ${n}

cfa(
  model = "
    TRCO  =~ ipmodst + imptrad + ipfrule + ipbhprp
    UNIV  =~ ipeqopt + ipudrst + impenv
    ALLOW =~ imsmetn + imdfetn + impcntr
  ",
  data = NL2_studio,
  estimator = "ML"
) %>%
  fitMeasures(c("chisq", "df", "cfi", "rmsea", "srmr"))
# chisq ${f.chisq.toFixed(3)} · df ${f.df} · cfi ${f.cfi.toFixed(3).replace(/^0/, '')} · rmsea ${f.rmsea.toFixed(3).replace(/^0/, '')} · srmr ${f.srmr.toFixed(3).replace(/^0/, '')}`;

const r2 = (v: number) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2).replace(/^0/, '');
const pTxt = (p: number) => (p < 0.001 ? 'p < .001' : `p = ${p.toFixed(3).replace(/^0/, '')}`);

export function Day3Script() {
  const { d, error } = useDay3();
  const [solution, setSolution] = useState(false);
  if (error) return <LoadError what="The Day 3 outputs" error={error} />;
  if (!d) return <p className="hint">Loading the outputs from R…</p>;
  const t = d.trco, u = d.univ, s = d.scfa;
  const means = d.item_means[0];
  const adaptedDcfi = t.tau_adapted['cfi.robust'] - t.fits.congeneric['cfi.robust'];
  const fc = (a: string, b: string) => { const i = s.factor_cor.names.indexOf(a), j = s.factor_cor.names.indexOf(b); return s.factor_cor.values[Math.max(i, j)][Math.min(i, j)]; };
  const std = (f: string, it: string) => pick(s.estimates, '=~', f, it)!.std;
  const allLabels = { ...LABELS, ...SCFA_LABELS };
  const strictPsi = pick(t.estimates.strict, '~1', 'ipmodst', '')!.est;
  return (
    <article className="script">
      <nav className="sec-rail" aria-label="Sections">
        {SECTIONS.map((x, i) => <a key={i} href={`#/day/3#s${i + 1}`} title={x.title}>{i + 1}</a>)}
        <a href="#/day/3#yourturn" title="Your turn">✎</a>
      </nav>

      <div className="card sc-intro">
        <Eta size={56} mood="explaining" />
        <div>
          <p><b>This script:</b> what a model claims beyond its arrows. Restrictions say <i>how</i> items relate to their factor — equally strongly, equally reliably, equally difficult. Identification asks whether the data hold enough numbers to estimate a model at all. And the simultaneous CFA puts all constructs of a question into one measurement model — tradition/conformity, universalism and attitudes toward immigration in the Netherlands (ESS 2004).</p>
          <p className="hint">The matrix workshop on <a href="#/map#matrices">the map of SEM</a> (part 5) is a good warm-up: it is the identification lesson of this script in miniature. The studio task and “Your turn” practise it.</p>
        </div>
      </div>
      <div className="sc-apply" id="setup">
        <span className="sc-tag">Before you start in R</span>
        <p>The packages, the data and the one-factor model of Day 1 — run this once:</p>
        <Code code={SETUP} />
      </div>

      <Sec n={1}>
        <p>Every parameter of a model is one of three kinds:</p>
        <ul>
          <li><b>fixed</b> — set to a constant: the 1 of a marker loading, the 0 of a cross-loading you did not draw;</li>
          <li><b>constrained</b> — set equal to other parameters: two loadings that must be the same, whatever their value;</li>
          <li><b>free</b> — estimated without any condition.</li>
        </ul>
        <p>Restrictions turn prior knowledge — or a claim — into the model. Classical test theory defines four <b>nested</b> models for the items of one construct, each adding a restriction to the one before:</p>
        <table className="rp-table left">
          <thead><tr><th>model</th><th>restriction</th><th>what it claims</th></tr></thead>
          <tbody>
            <tr><td><b>congeneric</b></td><td>all items load on the same construct; independent errors, no cross-loadings; everything else free</td><td>the items measure the same thing</td></tr>
            <tr><td><b>tau-equivalent</b></td><td>equal loadings — intercepts and error variances may differ</td><td>the items have the same relation to the factor</td></tr>
            <tr><td><b>parallel</b></td><td>equal loadings and equal error variances — intercepts may differ</td><td>… and the same reliability</td></tr>
            <tr><td><b>strictly parallel</b></td><td>equal loadings, error variances and intercepts</td><td>… and the same difficulty: the same average answer</td></tr>
          </tbody>
        </table>
        <p>Each step down the table is <b>nested</b> in the one above: it adds an equality constraint to parameters the model above estimates freely. So the four can be compared with a χ² difference test (Day 2, section 6) — that is the restriction ladder of section 5.</p>
        <Task question="Which parameters does the parallel model set equal that the tau-equivalent model leaves free?"
          options={['the loadings', 'the error variances', 'the intercepts', 'the factor variances']} answer={1}
          explain={<>Tau-equivalent: equal loadings. Parallel adds equal error variances — and with equal loadings, equal error variances mean equal reliabilities. The intercepts come only with strictly parallel.</>} />
        <p className="hint">“Tau” in tau-equivalent is the true score of classical test theory (Day 1), not the intercept τ: tau-equivalent items share their <i>loading</i>; equal intercepts come only with the strictly parallel model.</p>
      </Sec>

      <Sec n={2}>
        <p>A model is <b>identified</b> if the variances and covariances of the data hold enough information to estimate every free parameter. In short: more restrictions make identification easier, more free parameters make it harder.</p>
        <p>Three cases, by comparing the number p of observed variances and covariances with the number q of free parameters (as on Day 1, step 5; the original slides write t for q):</p>
        <ul>
          <li><b>just identified</b> — as many as parameters: df = 0. The model reproduces the data exactly and cannot be tested;</li>
          <li><b>overidentified</b> — more: df &gt; 0. The model makes claims the data can reject;</li>
          <li><b>underidentified</b> — fewer: df &lt; 0. No unique solution.</li>
        </ul>
        <div className="sc-formula"><Tex block>{'df = p - q = \\frac{k(k+1)}{2} - q \\;\\geq\\; 0 \\qquad\\text{e.g. } k = 3,\\; q = 4: \\; 6 - 4 = 2'}</Tex></div>
        <p className="hint">k items, q free parameters. With FIML, lavaan also models the means: then there are k(k + 3)/2 observed numbers (k more: the item means), and each item has an intercept (k more parameters). df stays the same — unless intercepts are constrained, as in the strictly parallel model of section 5.</p>
        <Task question="Regression of one dependent variable on two predictors: what is its identification status?"
          options={['underidentified', 'just identified', 'overidentified']} answer={1}
          explain={<>Three variables give 6 variances and covariances; the model estimates 2 slopes, the residual variance, and the variances and covariance of the predictors: 6 parameters. df = 0 — a regression reproduces the covariances exactly. It can be estimated, but not tested: there is no fit to judge.</>} />
        <Task question="Factor A with two items. Its variance is fixed to 1, and so is the loading of x₂; the loading of x₁ is free. How many free parameters — and what is df?"
          options={['4 parameters, df = −1', '3 parameters (λ₁ and two error variances), df = 0', '2 parameters, df = 1']} answer={1}
          explain={<>Three observed numbers (two variances, one covariance), three free parameters: just identified. But note what it took: fixing both the factor variance <i>and</i> a loading — one restriction more than a factor needs for its unit. A congeneric two-item factor (one loading free, the other a marker, the variance free) has 4 parameters and df = −1.</>} />
        <Task question="Factor B with two items: both loadings fixed to 1, the factor variance free. Identified?"
          options={['No — two items are never enough', 'Yes: 3 parameters (the factor variance, two error variances), df = 0 — the equality of the loadings rescues it', 'Yes, with df = 1']} answer={1}
          explain={<>Fixing both loadings to 1 makes them equal (tau-equivalence) and gives the unit at once. The covariance of the two items is then the factor variance. An equality is one way to identify a two-item factor; the correlation with another factor is the other (section 7).</>} />
        <p>df ≥ 0 is the <b>necessary</b> condition, not a sufficient one: a model can have df ≥ 0 and still not be identified (two-item factors, section 3).</p>
        <Deeper title="Two sides of identification, and the information matrix">
        <p>Two sides meet in identification (Jöreskog, 1973; Bollen, 1989): <b>deductively</b>, the structure of the model and its fixed and constrained parameters imply the variances and covariances of the items; <b>inductively</b>, the observed variances and covariances give estimates of the free parameters.</p>
        <p>The <b>sufficient</b> condition is that every single free parameter can be expressed by the observed variances and covariances — for complex models too tedious by hand. Empirically, a model is identified when its <b>information matrix</b> — the curvature of the fitting function (the map of SEM, part 6) — can be inverted. Its inverse is the covariance matrix of the estimates; when two estimates correlate near or above .9, they are almost linearly dependent: an identification or multicollinearity problem (Bollen, 1989, pp. 246–251).</p>
        <Apply>
          <Code code={`# correlations of the estimates (Mplus: TECH3)\ntradition_conformity_fit %>%\n  lavInspect(what = "vcov") %>%\n  cov2cor() %>%\n  round(2)`} />
          <p>For the one-factor model of Day 1, the largest correlation between two estimates (in absolute value) is {d.vcov_max.trco.r.toFixed(2).replace('-', '−')}, between <code>{d.vcov_max.trco.a}</code> and <code>{d.vcov_max.trco.b}</code>: with a marker item, loadings and the factor variance trade off. Close to .9, but below. Empirical underidentification happens when a model is identified on paper but not with these data: a factor correlation near 0 between two two-item factors, for example (try it in the matrix workshop of the map).</p>
        </Apply>
        </Deeper>
        <Transfer answer={<p>Usually not. A reflective and a formative model of the same variables can fit equally well or cannot be compared at all — the formative model with a latent outcome is often not even identified on its own. The decision rests on theory: does the construct cause the answers, or do the indicators make up the construct (Day 1, step 2)?</p>}>
          <p>Draw a reflective measurement model with three indicators, and a formative model with three predictors and one latent dependent variable. Can you decide on empirical grounds which one is right?</p>
        </Transfer>
      </Sec>

      <Sec n={3}>
        <p>Every model implies the variances and covariances of its items. For an item x₁ = λ₁A + e₁, with Var(A) = 1 and the error uncorrelated with the factor:</p>
        <div className="sc-formula"><Tex block>{'\\operatorname{Var}(x_1) = \\lambda_1^2\\operatorname{Var}(A) + \\operatorname{Var}(e_1) + 2\\lambda_1\\underbrace{\\operatorname{Cov}(A, e_1)}_{=\\,0} = \\lambda_1^2 + \\theta_{11}, \\qquad \\operatorname{Cov}(x_1, x_2) = \\lambda_1\\lambda_2'}</Tex></div>
        <p>With standardized loadings, the implied matrix is the correlation matrix: two items with loadings .5 and .5 should correlate .5 · .5 = .25. With unstandardized loadings it is the covariance matrix. A just-identified model can be <b>solved</b> from these equations — no search needed:</p>
        <div className="sc-formula"><Tex block>{'\\lambda_1^2 = \\frac{\\sigma_{12}\\,\\sigma_{13}}{\\sigma_{23}}, \\quad \\lambda_2^2 = \\frac{\\sigma_{12}\\,\\sigma_{23}}{\\sigma_{13}}, \\quad \\lambda_3^2 = \\frac{\\sigma_{13}\\,\\sigma_{23}}{\\sigma_{12}}, \\qquad \\theta_{ii} = \\sigma_{ii} - \\lambda_i^2'}</Tex></div>
        <p className="hint">With covariances σ the loadings are unstandardized (Var(A) = 1); with correlations r they are standardized. Note the square: the formula gives λ², the loading is its square root.</p>
        <Apply what="Universalism, NL 2004">
          <ByHand d={d} />
          <Code code={`universalism_fit <- cfa(\n  model = "UNIV =~ ipeqopt + ipudrst + impenv",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)\n\n# the correlations the model works with (FIML)\nuniversalism_fit %>%\n  lavInspect(what = "sampstat") %>%\n  .$cov %>%\n  cov2cor()`} />
        </Apply>
        <Task question="Factor A with three items, all three loadings labelled f₁ (equal), Var(A) = 1. Is the model identified?"
          options={['No — three items are the minimum without restrictions', 'Yes: 6 observed numbers, 4 parameters (f₁ and three error variances), df = 2', 'Only if the errors correlate']} answer={1}
          explain={<>The equality saves two parameters: every covariance equals f₁², every variance f₁² + θ<sub>ii</sub>. A tau-equivalent three-item factor is overidentified — the equality itself can be tested.</>} />
      </Sec>

      <Sec n={4}>
        <p>lavaan writes restrictions into the model string, in front of a variable:</p>
        <table className="rp-table left">
          <thead><tr><th>syntax</th><th>does</th></tr></thead>
          <tbody>
            <tr><td><code>1*ipmodst</code></td><td>fixes the loading to 1 (a number fixes)</td></tr>
            <tr><td><code>a*imptrad + a*ipfrule</code></td><td>constrains: the same label means the same estimate</td></tr>
            <tr><td><code>NA*ipmodst</code></td><td>frees a parameter lavaan would otherwise fix (the marker loading)</td></tr>
            <tr><td><code>TRCO ~~ 1*TRCO</code></td><td>fixes the factor variance — the other way to give the factor its unit</td></tr>
            <tr><td><code>ipmodst ~~ e*ipmodst</code> · <code>ipmodst ~ i*1</code></td><td>labels an error variance · an intercept</td></tr>
          </tbody>
        </table>
        <p>Tau-equivalence can be written in two ways — and they are the same model:</p>
        <Apply><TwoWaysTau d={d} /></Apply>
        <Check label="Scaled χ² of the tau-equivalent model" expect={t.fits.tau['chisq.scaled']} tol={0.005} unit={`χ²(${t.fits.tau.df}) = ${t.fits.tau['chisq.scaled'].toFixed(3)}, for both ways`} hint="summary(object = tradition_conformity_tau, fit.measures = T, standardized = T): Test Statistic, column Scaled" />
        <p className="hint"><b>Check: df = {t.fits.tau.df}.</b> If lavaan reports df = 4 for option 2, you freed the marker with <code>NA*</code> but forgot <code>TRCO ~~ 1*TRCO</code>: the common loading and the factor variance cannot be told apart — and lavaan may not warn. With <code>NA*</code> and no labels at all, it warns that “vcov does not appear to be positive definite”: the model is not identified.</p>
      </Sec>

      <Sec n={5}>
        <p>Now the ladder on the four tradition/conformity items of Day 1. Choose a level and look at the three rows: how far apart are the items in exactly the parameters the level sets equal?</p>
        <Apply>
          <LadderExplorer d={d} showUniv={solution} />
          <p>In R, the four models and their comparison with the Satorra–Bentler test:</p>
          <Code code={LADDER} />
          <LadderTable L={t} note="Each model is compared with the one above it (robust indices; Δχ² scaled after Satorra & Bentler, 2001). Green: ΔCFI within −.010 (Chen, 2007)." />
          <ROut title="R output · summary(compFit.tradition_conformity)"><pre className="syntax"><code>{t.compare_text}</code></pre></ROut>
          <p className="hint">As on Day 2 (section 6), compareFit adds a NOTE: the column “Chisq” holds the standard, not the robust χ² values. Report “Chisq diff” — it is already the scaled Satorra–Bentler difference.</p>
          <p><b>Only the congeneric model holds.</b> Equal loadings already cost Δχ²<sub>SB</sub>({t.lrt.tau.ddf}) = {t.lrt.tau.dchisq.toFixed(1)}, {pTxt(t.lrt.tau.p)}, and ΔCFI {sgn(t.fits.tau['cfi.robust'] - t.fits.congeneric['cfi.robust'])}: the four items are not equally strong measures — ipbhprp (“behave properly”) stands out with the largest loading. Equal error variances (parallel) and equal intercepts (strictly parallel) make it far worse: the strict model would have every item at the same mean, {strictPsi.toFixed(2)}, while the observed means run from {Math.min(...TRCO_ITEMS.map(i => means[i])).toFixed(2)} (ipmodst) to {Math.max(...TRCO_ITEMS.map(i => means[i])).toFixed(2)} (ipbhprp).</p>
          <p>Once tau-equivalence fails, the two models below it are not really candidates — they include the failed equality. The ladder is shown in full here to see what each claim costs.</p>
          <Check label="Scaled χ² of the strictly parallel model" expect={t.fits.strict['chisq.scaled']} tol={0.01} unit={`χ²(${t.fits.strict.df}) = ${t.fits.strict['chisq.scaled'].toFixed(2)}`} />
          <Deeper title="Partially tau-equivalent: release one loading">
            <p>If one item breaks the equality, release it: <code>TRCO =~ 1*ipmodst + 1*imptrad + 1*ipfrule + ipbhprp</code>. The adapted model has χ²<sub>scaled</sub>({t.tau_adapted.df}) = {t.tau_adapted['chisq.scaled'].toFixed(2)}, CFI {f3(t.tau_adapted['cfi.robust'])}, RMSEA {f3(t.tau_adapted['rmsea.robust'])}. Against the congeneric model: Δχ²<sub>SB</sub>({t.lrt.adapted?.ddf}) = {t.lrt.adapted?.dchisq.toFixed(2)}, {pTxt(t.lrt.adapted?.p ?? 1)}, and ΔCFI {sgn(adaptedDcfi)}.</p>
            <p>The two criteria disagree: the χ² difference rejects the equal loadings of the first three items at α = .05; the change in CFI stays within −.010. With {d.n.toLocaleString('en')} respondents the χ² test detects small differences — here we read such cases with Chen’s criterion, as you will on Day 4, and report both. Substantively: ipmodst, imptrad and ipfrule are about equally strong measures; “behave properly” is the strongest.</p>
          </Deeper>
        </Apply>
      </Sec>

      <Sec n={6}>
        <p>Why care whether items are tau-equivalent? Because the most common reliability coefficient assumes it. <b>Cronbach’s alpha</b> is the reliability of an unweighted sum score if the items are tau-equivalent. When the loadings differ, alpha underestimates it. <b>Omega</b> uses the loadings of the congeneric model, so it holds without the equality:</p>
        <AlphaOmega d={d} />
        <Apply>
          <Code code={OMEGA} />
          <Check label="omega of tradition/conformity" expect={d.omega_def[0].est} tol={0.002} unit={`ω = ${d.omega_def[0].est.toFixed(3)} — the := line of the output, or compRelSEM()`} />
          <p>ω = {f3(d.reliability.trco.omega_congeneric)}, α = {f3(d.reliability.trco.alpha)}. Close — the loadings differ moderately. For universalism (three items with similar loadings): ω = {f3(d.reliability.univ.omega_congeneric)}, α = {f3(d.reliability.univ.alpha)}. Both scales are not very reliable as sum scores — one more reason to work with the latent variables.</p>
        </Apply>
      </Sec>

      <Sec n={7}>
        <p>So far, one construct at a time. A <b>simultaneous CFA</b> puts all constructs of a question into one measurement model and lets the factors correlate. Compared with indices, sum scores or separate CFAs, it</p>
        <ul>
          <li>estimates the correlations between the constructs <b>corrected for measurement error</b>;</li>
          <li>tests the <b>number of factors</b> — are two constructs really two?</li>
          <li>tests <b>cross-loadings</b> and <b>error correlations between items of different constructs</b> (method effects; Podsakoff et al., 2003);</li>
          <li>prepares the structural model of Part 2: a structural model can only be as good as this measurement model.</li>
        </ul>
        <p className="hint">Alternatives to correlated factors — a factor above the factors (higher-order) or a general factor beside them (bifactor) — follow on Day 5.</p>
        <p>In matrix form, with two factors and six items, the zeros are the cross-loadings that were not drawn:</p>
        <div className="sc-formula"><Tex block>{'\\begin{pmatrix}x_1\\\\x_2\\\\x_3\\\\x_4\\\\x_5\\\\x_6\\end{pmatrix} = \\begin{pmatrix}\\lambda_1&0\\\\\\lambda_2&0\\\\\\lambda_3&0\\\\0&\\lambda_4\\\\0&\\lambda_5\\\\0&\\lambda_6\\end{pmatrix}\\begin{pmatrix}\\eta_1\\\\\\eta_2\\end{pmatrix} + \\begin{pmatrix}\\varepsilon_1\\\\\\vdots\\\\\\varepsilon_6\\end{pmatrix}'}</Tex></div>
        <Task question="Two factors, two items each, the first loading of each fixed to 1, the factors correlate. How many df — and is the model identified?"
          options={['df = −1: not identified', 'df = 1: identified — as long as the factor correlation is not 0', 'df = 0: just identified']} answer={1}
          explain={<>10 observed numbers; 2 free loadings, 4 error variances, 2 factor variances and 1 covariance: 9 parameters, df = 1. Each two-item factor borrows information from the correlation with the other. If that correlation is near 0, the two halves fall apart and neither is identified: empirical underidentification (the matrix workshop of the map shows it).</>} />
        <Apply what="Values and attitudes toward immigration, NL 2004">
          <p>The third construct: whether the Netherlands should allow many or few immigrants of the same race or ethnic group as the majority (<code>imsmetn</code>), of a different one (<code>imdfetn</code>), and from poorer countries outside Europe (<code>impcntr</code>). The answers run from 1 “allow many” to 4 “allow none”; we reverse them so that higher means <i>allow more</i>. Four categories are a grey zone (Day 2, section 9); for comparability with the values we keep MLR here.</p>
          <Code code={SCFA} />
          <Check label="Scaled χ² of the simultaneous CFA" expect={s.fit['chisq.scaled']} tol={0.005} unit={`χ²(${s.fit.df}) = ${s.fit['chisq.scaled'].toFixed(2)}`} />
          <SeparateVsSimultaneous d={d} />
          <p>Separately, two of the three constructs are just identified — their fit cannot be tested. Together, the 33 covariances between items of different constructs must be explained by three factor correlations: df = {s.fit.df}, and the model holds: CFI {f3(s.fit['cfi.robust'])}, RMSEA {f3(s.fit['rmsea.robust'])}, SRMR {f3(s.fit.srmr)}.</p>
          <ROut title="R output · summary(values_immigration_fit)"><pre className="syntax"><code>{s.summary}</code></pre></ROut>
          <Check label="Number of observations" expect={d.n_scfa} tol={0.5} unit="every respondent with at least one of the ten answers" hint="the line “Number of observations” at the top of the summary" />
          <p className="hint"><b>Check the direction of the allow items:</b> the correlation UNIV–ALLOW must be positive (+{fc('UNIV', 'ALLOW').toFixed(2).replace(/^0/, '')}). Negative? The allow items were not reversed — run the setup block again, from <code>read_spss</code> on.</p>
          <p><b>Validity</b>, read from the standardized solution, with the criteria used here:</p>
          <ul>
            <li><b>convergent</b> — loadings of at least .5, at minimum .4: {(['ALLOW', 'TRCO', 'UNIV'] as const).map(f => { const v = (f === 'ALLOW' ? ALLOW_ITEMS : f === 'TRCO' ? TRCO_ITEMS : UNIV_ITEMS).map(i => std(f, i)); return `${f} ${r2(Math.min(...v))}–${r2(Math.max(...v))}`; }).join('; ')}. The value items are borderline — ipmodst and ipeqopt below .5;</li>
            <li><b>discriminant</b> — factor correlations below .85: the largest is TRCO–UNIV with {r2(fc('TRCO', 'UNIV'))}; and no substantial cross-loadings (below .3): the largest expected one, TRCO → impenv, is about {r2(s.mi.find(m => m.op === '=~')!.sepc)} (standardized) — borderline; freed, it is {r2(s.cross.est[0].std)} (section 8);</li>
            <li><b>nomological</b> — correlations that make sense: universalism goes with more openness to immigration ({r2(fc('UNIV', 'ALLOW'))}), tradition/conformity with less ({r2(fc('TRCO', 'ALLOW'))}). That the two values correlate positively ({r2(fc('TRCO', 'UNIV'))}), although Schwartz’s circle puts them on different sides, is partly a response style: some respondents rate every value as important. Schwartz recommends centering the value ratings on each person’s mean before such comparisons. Part 2 turns these correlations into effects.</li>
          </ul>
        </Apply>
      </Sec>

      <Sec n={8}>
        <p>When theory does not fix every detail, modification indices help to reach a satisfactory solution — the model-generating approach (Day 2, section 8). Read each index together with its <b>expected parameter change</b> (EPC): the MI says how much χ² would drop, the EPC how large the freed parameter would be. A large MI with a tiny EPC is a significant but trivial misfit; check both before you free anything. In a simultaneous CFA, two kinds of additions compete:</p>
        <ul>
          <li>a <b>cross-loading</b>: the item measures a second construct too. It changes what a factor is — and the factor correlations change with it;</li>
          <li>an <b>error covariance</b>: two items share something beyond their factors — wording, a common response format, social desirability. The factors stay as they are.</li>
        </ul>
        <Apply what="Values and attitudes toward immigration, NL 2004">
          <Code code={LOCAL} />
          <ScfaView d={d} labels={allLabels} />
          <p>{s.n_resid} of the 45 standardized residuals exceed |2|; the largest, {s.resid[0].z.toFixed(1)}, is between {s.resid[0].a} and {s.resid[0].b} — the same pair as on Day 2. Freed one at a time:</p>
          <table className="rp-table">
            <thead><tr><th>added</th><th>Δχ²<sub>SB</sub> (1)</th><th>CFI</th><th>RMSEA</th></tr></thead>
            <tbody>
              <tr><td>— the example model</td><td>—</td><td>{f3(s.fit['cfi.robust'])}</td><td>{f3(s.fit['rmsea.robust'])}</td></tr>
              <tr><td>error covariance <code>{s.cov.par}</code></td><td>{s.cov.lrt.dchisq.toFixed(1)}, {pTxt(s.cov.lrt.p)}</td><td>{f3(s.cov.fit['cfi.robust'])}</td><td>{f3(s.cov.fit['rmsea.robust'])}</td></tr>
              <tr><td>cross-loading <code>{s.cross.par}</code></td><td>{s.cross.lrt.dchisq.toFixed(1)}, {pTxt(s.cross.lrt.p)}</td><td>{f3(s.cross.fit['cfi.robust'])}</td><td>{f3(s.cross.fit['rmsea.robust'])}</td></tr>
            </tbody>
          </table>
          <p className="hint">Why is Δχ²<sub>SB</sub> smaller than the modification index ({s.mi[0].mi.toFixed(1)} → {s.cov.lrt.dchisq.toFixed(1)}, {s.mi.find(m => m.op === '=~')!.mi.toFixed(1)} → {s.cross.lrt.dchisq.toFixed(1)})? The MI approximates the drop in the standard ML χ²; the robust difference test corrects for the non-normal data (as on Day 2). The same for the EPC: the expected standardized cross-loading was about {s.mi.find(m => m.op === '=~')!.sepc.toFixed(2)}, freely estimated it is {s.cross.est[0].std.toFixed(2)}. Both are approximations — the estimated model has the last word.</p>
          <p>Both improve the fit; neither is needed for an acceptable model. The decision is about the items: does caring for nature belong partly to tradition — as preserving what is handed down — or do “follow traditions and customs” and “care for nature and environment” share something else? Whatever you decide, decide it once for Day 2’s model and this one, and write the reason down.</p>
          <ROut title="R output · modificationindices(values_immigration_fit)"><pre className="syntax"><code>{s.mi_text}</code></pre></ROut>
          <Task question={`Third on the list: TRCO =~ ipeqopt, MI ${s.mi[2].mi.toFixed(1)}, standardized EPC ${s.mi[2].sepc.toFixed(2).replace('-', '−')}. What would freeing it claim?`}
            options={['That equal opportunities is a traditional value too.', 'That the more traditional a person, the less they endorse equal opportunities — beyond what universalism explains: an item of one construct measuring the opposite of another.', 'Nothing about the constructs — only that the fit improves.']} answer={1}
            explain={<>A negative cross-loading: “treated equally” would partly measure the absence of tradition/conformity. Possible — but hard to defend from the item text alone, and the index is not a reason. Leave it unless your theory predicts it.</>} />
        </Apply>
        <Deeper title="CFA step by step: a checklist for exploring a measurement structure">
          <ol>
            <li><b>The base model.</b> Inspect the correlation matrix; fix the number of factors; let the factors covary; fix one loading per factor to 1; one loading per item (no cross-loadings); error covariances 0, error variances free; estimate unstandardized and standardized coefficients, MIs and EPCs.</li>
            <li><b>Evaluate it.</b> Identified (df ≥ 0, no error message)? Factor and error covariance matrices positive definite? Correlations of estimates above .9? Global fit? Misspecification by MIs, standardized residuals above 2? A substantive interpretation for every path, error covariance and factor correlation?</li>
            <li><b>Possible modifications.</b> Fix non-significant loadings to 0; free loadings (also cross-loadings) where MI and content support it; free error covariances <i>only</i> with a good theoretical explanation; fewer factors if their covariance matrix is not positive definite, more factors if errors correlate in a pattern — <i>only</i> with a substantive interpretation; delete items with low loadings or several residual correlations.</li>
            <li><b>Evaluate the final model</b> as in 2, and: at least two (better three) items per factor with standardized loadings above .5; the indicator reliabilities (R²); how many loadings per factor; error covariances per item.</li>
          </ol>
        </Deeper>
      </Sec>

      <Sec n={9}>
        <p>lavaan prints every loading three times: unstandardized (<code>Estimate</code>), with only the factor standardized (<code>Std.lv</code>), and with factor and item standardized (<code>Std.all</code>). They convert into each other with the standard deviations of factor and item:</p>
        <div className="sc-formula"><Tex block>{'b^{*} = b\\,\\frac{SD_\\eta}{SD_y}, \\qquad b = b^{*}\\,\\frac{SD_y}{SD_\\eta}, \\qquad \\theta^{*} = \\frac{\\theta}{\\sigma^2_y} = 1 - b^{*2}, \\qquad r_{\\eta_1\\eta_2} = \\frac{\\psi_{21}}{SD_{\\eta_1} SD_{\\eta_2}}, \\qquad \\psi = b^{*2}_{\\text{marker}}\\,\\sigma^2_{\\text{marker}}'}</Tex></div>
        <p className="hint">b is the unstandardized loading λ of the earlier sections, b* its standardized form. θ* = 1 − b*² holds for an item with one loading. The last formula recovers the factor variance from the marker item. The square of a factor correlation, r², is the variance two constructs share.</p>
        <Apply><StdConverter d={d} /></Apply>
        <p className="hint">The same logic converts a factor covariance into a factor correlation, and an error covariance into an error correlation. After Brown (2015), chapter 4.</p>
        <p>One more contrast, from the same chapter: an exploratory factor analysis estimates every loading of every item on every factor; a CFA fixes the cross-loadings to 0. The CFA solution is simpler to read, and its factor correlation is usually larger — the small cross-loadings of the EFA are absorbed by the correlation of the factors. A CFA with cross-loadings fixed to zero is a strong claim, which is why section 8 tests it.</p>
        <Transfer><p>How many factors do you have in your research project — and how many items per factor?</p></Transfer>
      </Sec>

      <Sec n={10}>
        <p>For the measurement models of every structural model, η Lab follows five steps:</p>
        <ol>
          <li>Test every scale with several items <b>separately</b>.</li>
          <li><b>Modify</b> where MIs, EPCs and minimum loadings (above .5, at least .4) say so — with reasons.</li>
          <li>Estimate a <b>simultaneous CFA</b> with all scales that later enter the structural model.</li>
          <li>Check for <b>cross-loadings and error correlations</b>. If possible, drop the items concerned and estimate again; with too few items, allow the cross-loading or error correlation and justify it theoretically.</li>
          <li>Test for <b>differential item functioning</b> with multi-group models (Day 4) and MIMIC models (Day 7).</li>
        </ol>
        <Transfer answer={<p>For the guiding question “do universalism and tradition/conformity relate to openness to immigration?”: (1) the three scales separately — TRCO testable, UNIV and ALLOW just identified; (2) no modification without a reason; (3) the simultaneous CFA above; (4) the imptrad–impenv strain, decided by the item texts; (5) invariance across the Benelux countries (Day 4) before comparing them, and age or education as MIMIC covariates (Day 7).</p>}>
          <p>Write down all five steps for your own research project, as an analysis plan. Which step do you expect to be the hardest?</p>
        </Transfer>
      </Sec>

      <section id="studio" className="sc-step">
        <header><span className="sc-n">Studio</span><h2>Before the studio task: why its numbers differ slightly</h2></header>
        <p>The studio estimates with ML from the covariances of the {d.studio.n.toLocaleString('en')} Dutch respondents who answered <i>all</i> variables used in η Lab; this script uses FIML and every respondent with at least one answer: {d.n.toLocaleString('en')} for tradition/conformity, {d.n_scfa.toLocaleString('en')} for the three-construct model. To get the studio’s numbers in R:</p>
        <Code code={STUDIO_SAMPLE(d.studio.n, d.studio.fit)} />
      </section>

      <section id="yourturn" className="sc-step">
        <header><span className="sc-n">✎</span><h2>Your turn: the ladder for universalism</h2></header>
        <p className="sc-goal"><b>After this part</b> you have tested the restrictions for a second construct on your own — and decided which one to release.</p>
        <p>Write your own syntax for the tau-equivalent, parallel and strictly parallel model of universalism (<code>ipeqopt</code>, <code>ipudrst</code>, <code>impenv</code>), with MLR and FIML. Compare the models with the Satorra–Bentler test. Which is the highest level of equality you can assume? And which restriction would you release to improve the model that is too restrictive?</p>
        <Code code={`universalism_tau <- cfa(\n  model = "UNIV =~ ____*ipeqopt + ____*ipudrst + ____*impenv",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)\n\n# parallel: add equal error variances; strictly parallel: add equal intercepts\n\ncompFit.universalism <- compareFit(\n  tau = universalism_tau,\n  parallel = ____,\n  strictly_parallel = ____,\n  argsLRT = list(method = "satorra.bentler.2001")\n)\n\n# which equality breaks the strict model?\nlavTestScore(universalism_strictly_parallel)`} />
        <p className="hint">The congeneric model of three items has df = 0: comparing the tau-equivalent model with it is a test against the saturated model — its χ² is the tau-equivalent model’s own.</p>
        <button className="btn" onClick={() => setSolution(v => !v)} aria-expanded={solution}>{solution ? 'Hide the solution' : 'Show the solution'}</button>
        {solution && (
          <div className="sc-solution">
            <LadderTable L={u} />
            <p><b>Parallel is the highest level</b>: equal loadings (Δχ²<sub>SB</sub>({u.lrt.tau.ddf}) = {u.lrt.tau.dchisq.toFixed(2)}, {pTxt(u.lrt.tau.p)}) and equal error variances ({u.lrt.parallel.dchisq.toFixed(2)}, {pTxt(u.lrt.parallel.p)}) hold; equal intercepts do not (Δχ²<sub>SB</sub>({u.lrt.strict.ddf}) = {u.lrt.strict.dchisq.toFixed(1)}, CFI {f3(u.fits.strict['cfi.robust'])}). The three universalism items are interchangeable measures — but not equally easy to agree with: the means are {UNIV_ITEMS.map(i => `${i} ${means[i].toFixed(2)}`).join(', ')}.</p>
            <p><b>Reading <code>lavTestScore()</code>.</b> Each row tests one equality, written with lavaan’s internal labels: <code>{d.univ_plabels.map(x => x.plabel).join(', ')}</code> are the intercepts of {d.univ_plabels.map(x => x.item).join(', ')} — see them with <code>parTable(universalism_strictly_parallel) %&gt;% select(lhs, op, rhs, label, plabel)</code>. With MLR, lavaan warns that it falls back to the ordinary score test: harmless, the test is just not robust. The equality ipeqopt = ipudrst costs X² = {d.univ_score[0].X2.toFixed(1)}, while ipeqopt = impenv costs only {d.univ_score.find(x => x.par.includes('intercept') && x.with === 'impenv')?.X2.toFixed(1)} — so <b>ipudrst</b> (“understand different people”) is the outlier. Releasing one intercept at a time confirms it: scaled χ² {d.univ_release.map(r => `${r.chisq.toFixed(1)} (${r.item} released)`).join(', ')}.</p>
            <p>With ipudrst released, the model has χ²<sub>scaled</sub>({d.univ_strict_partial.df}) = {d.univ_strict_partial['chisq.scaled'].toFixed(2)}, CFI {f3(d.univ_strict_partial['cfi.robust'])}, RMSEA {f3(d.univ_strict_partial['rmsea.robust'])} — still worse than the parallel model ({pTxt(d.univ_strict_partial_lrt.p)}); the other two intercepts differ too, if less.</p>
            <Code code={`universalism_parallel <- cfa(\n  model = "\n    UNIV =~ 1*ipeqopt + 1*ipudrst + 1*impenv\n    ipeqopt ~~ e*ipeqopt\n    ipudrst ~~ e*ipudrst\n    impenv ~~ e*impenv\n  ",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)\n\nuniversalism_strictly_parallel <- cfa(\n  model = "\n    UNIV =~ 1*ipeqopt + 1*ipudrst + 1*impenv\n    ipeqopt ~~ e*ipeqopt\n    ipudrst ~~ e*ipudrst\n    impenv ~~ e*impenv\n    ipeqopt ~ i*1\n    ipudrst ~ i*1\n    impenv ~ i*1\n  ",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)`} />
            <ROut title="R output · summary(compFit.universalism)"><pre className="syntax"><code>{u.compare_text}</code></pre></ROut>
            <p className="hint">Compare with tradition/conformity: there even equal loadings failed. The same procedure, two constructs, two different answers — a restriction is a property of a particular set of items, not of a method.</p>
          </div>
        )}
        <p className="hint">Change in CFI for each rung uses Chen’s limit of {CUTOFFS.deltaCfi.toFixed(3).replace(/^0/, '')}, as in section 5.</p>
      </section>
    </article>
  );
}
