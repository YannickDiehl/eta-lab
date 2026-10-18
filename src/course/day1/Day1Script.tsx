// Day 1 as an interactive script: the CFA procedure in eight steps (after the Lugano
// 2025 / Essex 2023 code documentation), applied to tradition and conformity in the
// Netherlands. The text follows the earlier course scripts closely (errors corrected); the code is the
// one used throughout η Lab (tidyverse, sjlabelled/sjmisc, easystats, MVN, lavaan, semPlot/semptools); the
// static figures are replaced by interactive ones that work with the real estimates. After a
// didactic review: every step has a goal and a number to check against R.
import { useState, type ReactNode } from 'react';
import { LoadError, Tex } from '../../components/ui.tsx';
import { Eta } from '../../eta/Eta.tsx';
import { Code } from '../day2.tsx';
import { MiniTask, NumberCheck, useStoredValue } from '../day0/widgets.tsx';
import { f2, f3, loading, useDay1 } from './data.ts';
import { ClassicTestTheory, FormalModel, ReflectiveFormative, Scaling } from './figures1.tsx';
import { LoadingCloud } from './figures3.tsx';
import { LikelihoodGap, LikelihoodOne, SearchReplay, useMcData, WhatGoesWrong } from '../map/estimation.tsx';
import { useMapData } from '../map/widgets.tsx';
import { AnnotatedOutput, ChiSquareN, CorrelationMatrix, FitTable, Identification, ItemHistograms, ItemScaleTable, LoadingBars, MeanStructure, NqRule, ResidualCorrelation } from './figures2.tsx';

export const LABELS: Record<string, string> = {
  ipmodst: 'Important to be humble and modest, not draw attention',
  imptrad: 'Important to follow traditions and customs',
  ipfrule: 'Important to do what is told and follow rules',
  ipbhprp: 'Important to behave properly',
  ipeqopt: 'Important that people are treated equally and have equal opportunities',
  ipudrst: 'Important to understand different people',
  impenv: 'Important to care for nature and environment',
  iphlppl: 'Important to help people and care for others well-being',
  iplylfr: 'Important to be loyal to friends and devote to people close',
  impsafe: 'Important to live in secure and safe surroundings',
  ipstrgv: 'Important that government is strong and ensures safety',
  imsmetn: 'Allow many/few immigrants of the same race or ethnic group as the majority',
  imdfetn: 'Allow many/few immigrants of a different race or ethnic group from the majority',
  impcntr: 'Allow many/few immigrants from poorer countries outside Europe',
  imbgeco: 'Immigration bad or good for the country’s economy',
  imueclt: 'Country’s cultural life undermined or enriched by immigrants',
  imwbcnt: 'Immigrants make the country a worse or better place to live',
};
const CONSTRUCT: Record<string, string> = { ipmodst: 'Tradition', imptrad: 'Tradition', ipfrule: 'Conformity', ipbhprp: 'Conformity' };

const STEPS: { title: string; goal: string }[] = [
  { title: 'Translation of the theoretical model into a measurement model', goal: 'you can write the four items as equations of one latent variable.' },
  { title: 'Checking whether it is a reflective or formative construct', goal: 'you can argue why tradition and conformity are measured reflectively.' },
  { title: 'Specification of the model: a scale for the latent variable', goal: 'you know why a latent variable needs a scale, and the two ways to give it one.' },
  { title: 'Checking the model assumptions', goal: 'you have checked sample size, distributions, correlations and item statistics — and know why η Lab uses MLR.' },
  { title: 'Checking whether the model is identified — and estimating it', goal: 'you can count df, know how lavaan searches for the estimates and what its warnings mean, estimate the model and read its output.' },
  { title: 'Checking the fit measures', goal: 'you can judge the global fit with several indices — and know why χ² alone misleads in large samples.' },
  { title: 'Checking for misspecification', goal: 'you can read loadings, residuals and modification indices, and decide whether to change the model.' },
  { title: 'Identifying the mean structure (optional)', goal: 'you know how intercepts and the latent mean reproduce the item means.' },
];

function Step({ n, children }: { n: number; children: ReactNode }) {
  const s = STEPS[n - 1];
  return (
    <section id={`step${n}`} className="sc-step">
      <header><span className="sc-n">Step {n}</span><h2>{s.title}</h2></header>
      <p className="sc-goal"><b>After this step</b> {s.goal}</p>
      {children}
    </section>
  );
}

/** R output as it appears in RStudio, folded until wanted. */
function ROut({ title = 'R output', children, open }: { title?: string; children: ReactNode; open?: boolean }) {
  return <details className="rout" open={open}><summary>{title}</summary><div>{children}</div></details>;
}

function Apply({ children }: { children: ReactNode }) {
  return <div className="sc-apply"><span className="sc-tag">Tradition and conformity, NL 2004</span>{children}</div>;
}

/** A checkpoint: what R should print, typed in to compare. */
function Check({ label, expect, tol = 0, unit, hint }: { label: string; expect: number; tol?: number; unit: string; hint?: string }) {
  const [v, setV] = useStoredValue(`d1:${label}`);
  return <NumberCheck label={label} expect={expect} tol={tol} value={v} onChange={setV} unit={unit} hint={hint} help="#/day/0#consult" />;
}

const PACKAGES = `# data manipulation
library(tidyverse)
library(sjmisc)
library(sjlabelled)
library(sjPlot)

# checking data
library(MVN)
library(easystats)

# building the models
library(lavaan)

# checking the models (from Day 2 on)
library(semTools)

# model visualization
library(semPlot)
library(semptools)`;

const DATA = `NL2 <- read_spss(
  path = "NL2.sav",
  convert.factors = F,
  drop.labels = T
  ) %>%
  # value items: 1 = very much like me ... 6 = not like me at all -> reversed,
  # so that higher values mean "more important"
  mutate(across(ipcrtiv:impfun, \\(x) rec(x, rec = "rev")))

view_df(NL2)
NL2 %>% frq(ipmodst, imptrad, ipfrule, ipbhprp)`;

export function Day1Script() {
  const { d, error } = useDay1();
  const [solution, setSolution] = useState(false);
  const [predicted, setPredicted] = useState(false);
  const m = useMapData(), mc = useMcData();   // the estimation widgets of the map of SEM
  if (error) return <LoadError what="The Day 1 outputs" error={error} />;
  if (!d) return <p className="hint">Loading the outputs from R…</p>;
  const s = d.trco, u = d.univ, fit = s.fit;
  const alpha = /Cronbach's alpha = ([\d.]+)/.exec(s.itemscale_text)?.[1];
  const means = Object.values(s.item_means);

  return (
    <article className="script">
      <nav className="sec-rail" aria-label="The eight steps">
        <a href="#/day/1#constructs">0</a>
        {STEPS.map((t, i) => <a key={i} href={`#/day/1#step${i + 1}`} title={t.title}>{i + 1}</a>)}
        <a href="#/day/1#yourturn" title="Your turn">✎</a>
      </nav>

      <div className="card sc-intro">
        <Eta size={56} mood="explaining" />
        <div>
          <p><b>This script:</b> one construct, four items, eight steps. We follow the CFA procedure from the theoretical idea to an estimated, checked measurement model — tradition and conformity in the Netherlands (ESS 2004). Every figure can be operated; every number comes from R with the code shown next to it.</p>
          <p><b>How to work:</b> open your <code>sem-lab</code> project, create a new script <code>day1.R</code>, and copy each code block into it as you go. Run it line by line and compare what R prints with the boxes “R output” and the numbers to check. “Your turn” at the end applies the whole procedure to a second construct.</p>
          <p className="hint">The code is the one used throughout η Lab: tidyverse, sjlabelled and sjmisc for the data, easystats and MVN for the checks, lavaan with MLR and FIML for the model.</p>
        </div>
      </div>

      <section id="constructs" className="sc-step">
        <header><span className="sc-n">Start</span><h2>Hypothetical constructs and the classic test theory</h2></header>
        <p className="sc-goal"><b>After this part</b> you can say what a latent variable is and why measurement error matters.</p>
        <p>Many variables in the social and behavioral sciences represent <b>hypothetical constructs</b> — traits, attitudes, values. We rarely observe them directly: most constructs can only be captured by several observable indicators, for example the questions of a questionnaire. We assume that these indicators are manifestations of the construct. <b>Manifest indicators</b> are directly observable; <b>latent variables</b> are not.</p>
        <p>So we need a model of the relationship between manifest indicators and latent variables. Its starting point is the classic test theory (Novick, 1966): an observed score is a true score plus error.</p>
        <ClassicTestTheory />
      </section>

      <section id="data" className="sc-step">
        <header><span className="sc-n">Setup</span><h2>Packages and data</h2></header>
        <p className="sc-goal"><b>After this part</b> the ESS data are loaded in R, with the value items reversed.</p>
        <Code code={PACKAGES} />
        <p className="hint">Red messages about functions that are “masked” are normal (Day 0). semTools is loaded now for later days.</p>
        <p>The data: the Dutch respondents of ESS round 2 (2004), the file <code>NL2.sav</code> you saved on Day 0. <code>read_spss()</code> from sjlabelled keeps the variable labels; <code>rec()</code> from sjmisc reverses the 21 value items so that higher values mean “more important”.</p>
        <Code code={DATA} />
        <p>You should see four frequency tables, one per item. Check the first one:</p>
        <Check label="valid N of ipmodst" expect={1849} unit="the data are read and reversed" hint="read NL2.sav as on Day 0" />
        <ROut title="R output · frq() in short">
          <table className="rp-table"><thead><tr><th>item</th>{[1, 2, 3, 4, 5, 6].map(k => <th key={k}>{k}</th>)}<th>NA</th></tr></thead>
            <tbody>{s.frq.map(f => <tr key={f.item}><td>{f.item}</td>{f.counts.map((c, k) => <td key={k}>{c}</td>)}<td>{f.missing}</td></tr>)}</tbody></table>
          <p className="hint">The counts of R’s four tables, side by side. 1 = not like me at all … 6 = very much like me, after reversing.</p>
        </ROut>
      </section>

      <Step n={1}>
        <p>Now the idea becomes a model. A latent value orientation — how important tradition and conformity are to a person — is assumed to cause the answers to four portraits. In the formal model, each indicator y is the latent variable η times its factor loading λ, plus an error ε of its own:</p>
        <FormalModel s={s} />
        <p className="hint">In matrix notation the four equations are one: Y = Λη + E. Some texts call the latent variable ξ (xi) instead of η (Brown, 2015, p. 51) — the meaning is the same.</p>
        <Apply>
          <table className="rp-table left"><thead><tr><th>Name</th><th>Label</th><th>Construct</th></tr></thead>
            <tbody>{s.items.map(it => <tr key={it}><td><code>{it}</code></td><td>{LABELS[it]}</td><td>{CONSTRUCT[it]}</td></tr>)}</tbody></table>
          <p className="hint">Tradition and conformity are neighbouring values in Schwartz’s circle; with the four PVQ items of the ESS they are usually measured as one factor. In lavaan we call this factor <code>TRCO</code>.</p>
        </Apply>
      </Step>

      <Step n={2}>
        <p>Decide how the indicators relate to the latent variable — a decision from theory, not a statistical test: <b>reflective</b> measurement — the indicators are “effects” of the latent variable — or <b>formative</b> measurement — the latent variable is “caused” by, or composed of, the indicators.</p>
        <ReflectiveFormative s={s} />
        <Apply><p>Someone to whom tradition and conformity matter will recognise themselves in all four portraits; if this value becomes more important to a person, all four answers rise. And dropping one portrait would not change what the value is. So the indicators are effects of the latent variable: we specify a <b>reflective</b> measurement model.</p></Apply>
      </Step>

      <Step n={3}>
        <p>A latent variable has no natural unit. Without one, the model cannot be estimated: doubling all loadings and quartering the factor variance would give exactly the same covariances. So we choose a method to give it a scale:</p>
        <ul>
          <li><b>Reference indicator method:</b> the factor loading of one indicator is fixed to 1.0.</li>
          <li><b>Fixed factor method:</b> the factor variance is fixed to 1.0.</li>
        </ul>
        <Scaling s={s} />
        <Apply>
          <p>The lavaan operators we need:</p>
          <table className="rp-table left"><thead><tr><th>Formula type</th><th>Operator</th><th>Mnemonic</th></tr></thead>
            <tbody>
              <tr><td>latent variable definition</td><td><code>=~</code></td><td>is measured by</td></tr>
              <tr><td>regression</td><td><code>~</code></td><td>is regressed on (from Day 6)</td></tr>
              <tr><td>(residual) (co)variance</td><td><code>~~</code></td><td>is correlated with</td></tr>
              <tr><td>intercept</td><td><code>~1</code></td><td>intercept (step 8)</td></tr>
            </tbody></table>
          <p>lavaan uses the reference indicator method by default: the first indicator’s loading is fixed to 1, and the variance of the latent factor is estimated.</p>
          <p>For the fixed factor method, <code>NA*ipmodst</code> frees the first loading, and <code>TRCO ~~ 1*TRCO</code> fixes the variance of the factor. (A variance is written as the covariance of a variable with itself.)</p>
        </Apply>
      </Step>

      <Step n={4}>
        <p>Maximum likelihood estimation has requirements:</p>
        <ul>
          <li><b>Sample size.</b> The ratio of cases to free parameters q (the N:q rule) should be 20:1, at least 10:1. You will count q in step 5.</li>
          <li><b>Distribution.</b> ML assumes continuous, multivariate normal items. With non-normal data, the standard errors and the χ² statistic need a correction: robust ML, <b>MLR</b>. (Six answer categories are treated as continuous here; Day 2 discusses when that is fine.)</li>
          <li><b>χ² and sample size.</b> In small samples (&lt; 100), χ²<sub>ML</sub> is too large. In large samples (&gt; 400), it is almost always significant: small discrepancies count heavily, and a good model may be rejected. Step 6 lets you try this.</li>
        </ul>
        <Apply>
          <NqRule s={s} q={8} />
          <h3>4a · Descriptive statistics</h3>
          <p>First the items one by one: missing values, central tendency, spread and distribution.</p>
          <Code code={`NL2 %>% \n  select(ipmodst, imptrad, ipfrule, ipbhprp) %>% \n  describe_distribution()`} />
          <ItemHistograms s={s} />
          <h3>4b · Multivariate normality</h3>
          <p><code>mvn()</code> offers Mardia’s, Henze–Zirkler’s (the default), Royston’s, Doornik–Hansen’s test and the E-statistic.</p>
          <Code code={`NL2 %>% \n  select(ipmodst, imptrad, ipfrule, ipbhprp) %>% \n  mvn() %>%\n  summary(select = c("mvn", "univariate"))`} />
          <p className="hint">mvn() warns: “Missing values detected in 46 rows. These rows will be removed.” That is fine here — the test uses the 1,835 complete answers. lavaan will later use everyone (FIML).</p>
          <ROut title="R output · mvn()" open><pre className="syntax"><code>{s.mvn}</code></pre></ROut>
          <p>All tests reject normality. With almost 1,900 respondents, every test would reject even small deviations — and the skewness here is mild (between −.28 and −.65). Still, the answers pile up at one end. <b>Because the items are not multivariate normal, we use the MLR estimator. Because some answers are missing, we use Full Information Maximum Likelihood (FIML).</b></p>
          <h3>4c · Correlations</h3>
          <p>Are the items sufficiently correlated? Correlations of about .20 or more support the assumption of a reflective factor: a latent variable in the background explains what the items share.</p>
          <Code code={`NL2 %>% \n  select(ipmodst, imptrad, ipfrule, ipbhprp) %>% \n  correlation() %>% \n  summary()`} />
          <CorrelationMatrix s={s} />
          <h3>4d · Item statistics</h3>
          <p>Finally, the anticipated item scale: item difficulty (between .20 and .80), item discrimination (.20 or higher; the closer to 1, the better) and the mean inter-item correlation (satisfactory between .20 and .40).</p>
          <Code code={`NL2 %>% \n  select(ipmodst, imptrad, ipfrule, ipbhprp) %>% \n  principal_components(n = 1) %>%\n  check_itemscale()`} />
          <ItemScaleTable s={s} />
          {alpha && <Check label="Cronbach's alpha" expect={Number(alpha)} tol={0.005} unit="the item statistics match" hint="look at the last line of the output" />}
          <p>The selected items can plausibly be combined into one scale.</p>
        </Apply>
      </Step>

      <Step n={5}>
        <p>The complexity of a CFA model is limited by the number of <b>observations</b> p — the variances and covariances of the items — and the number of <b>unknown model parameters</b> q. The degrees of freedom must be at least zero: <Tex>{'df = p - q \\geq 0'}</Tex>. With df &gt; 0 we can test how well the model fits the data.</p>
        <Identification />
        <p>Maximum likelihood looks for the parameters that make the model-implied covariances as close as possible to the observed ones. Their distance is measured by F<sub>ML</sub>: it is 0 when the model reproduces the data exactly and grows with the difference. Multiplied by n − 1, it follows a χ² distribution:</p>
        <div className="sc-formula"><Tex block>{'F_{ML} = \\ln|\\Sigma(\\theta)| - \\ln|S| + tr[S\\,\\Sigma(\\theta)^{-1}] - k \\qquad F_{ML}\\,(n-1) = \\chi^2_{ML}'}</Tex></div>
        <p className="hint">S is the observed, Σ(θ) the model-implied covariance matrix; k is the number of items (here 4) — not to be confused with p, the number of variances and covariances. lavaan multiplies by N rather than n − 1, and prints <code>fmin</code>, which is F<sub>ML</sub>/2; with large samples the difference does not matter.</p>
        <Apply>
          <p>Now we estimate the model with <code>cfa()</code> and look at it with <code>summary()</code>:</p>
          <ul>
            <li><code>fit.measures = T</code> shows the most important fit measures;</li>
            <li><code>standardized = T</code> adds standardized values;</li>
            <li><code>rsquare = T</code> (optional) adds the explained variance of each item.</li>
          </ul>
          <Code code={`tradition_conformity_fit <- cfa(\n  model = "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)\n\nsummary(\n  object = tradition_conformity_fit,\n  fit.measures = T,\n  standardized = T\n)`} />
          <p className="hint">lavaan warns: “some cases are empty and will be ignored”, followed by row numbers. Normal: 21 respondents answered none of the four items; FIML uses the other 1,860.</p>
          <Check label="Scaled test statistic" expect={fit['chisq.scaled']} tol={0.005} unit={`χ² = ${fit['chisq.scaled'].toFixed(3)} with ${fit.df} df — the model is estimated`} hint="look for “Test Statistic”, column “Scaled”" />
          <AnnotatedOutput text={s.summary} />
          <p>With four indicators the model is <b>overidentified</b> with {fit.df} degrees of freedom. The standardized loadings, drawn with semPlot and marked for significance with semptools:</p>
          <Code code={`tradition_conformity_plot <- tradition_conformity_fit %>% \n  semPaths(\n    whatLabels = "std", \n    style = "mx", \n    layout = "tree", \n    edge.color = "black", \n    intercepts = F,\n    sizeMan = 10, \n    sizeLat = 12, \n    edge.label.cex = .8,\n    nCharNodes = 50\n  ) \n\ntradition_conformity_plot %>% \n  mark_sig(tradition_conformity_fit) %>% \n  plot()`} />
          <FormalModel s={s} initial="std" />
          <p className="hint">The diagram semPaths draws, here interactive: all four loadings are significant (p &lt; .001 — three stars from <code>mark_sig()</code>; the reference loading has no test because it is fixed).</p>
          <h3>What a loading means — in people</h3>
          <p>Behind every arrow of the diagram stands a cloud of people. Pick an item: the loading is the slope of the line, the error the spread around it.</p>
          <LoadingCloud s={s} labels={LABELS} />
        </Apply>
        <h3>What lavaan did to get these numbers</h3>
        <p>No formula gives the estimates of a CFA directly; lavaan <b>searches</b>. It starts somewhere (the <i>starting values</i>), computes in which direction F<sub>ML</sub> falls, takes a step, and repeats until F stops changing: the model has <b>converged</b>. You have just seen one warning (“some cases are empty”) — harmless. These are the three that are not, and lavaan always says so. Never ignore one:</p>
        {m && <WhatGoesWrong d={m.est} mc={mc} />}
        <details className="deeper">
          <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>Watch the search, step by step — and where F<sub>ML</sub> comes from</span></summary>
          <div className="deeper-body">
            <p>To watch the search we use a model small enough to see at once: tradition/conformity measured by ipfrule and ipbhprp, universalism by ipeqopt and ipudrst (Day 2 puts the two values together) — nine parameters, the real Dutch data. Your four-item model is searched in exactly the same way. Choose a start and replay it:</p>
            {m && <SearchReplay d={m.est} />}
            <p>“Maximum likelihood” asks: if the model were true, how probable would exactly these data be? First for one variable and 25 people:</p>
            <LikelihoodOne />
            {m && <><p>For a whole model the same question is asked of all items at once. χ² is the gap between the model’s likelihood and that of a perfect model — here for the two-factor model of Day 2:</p><LikelihoodGap d={m.est} /></>}
            <p className="hint">The map of SEM (part 6) lets you turn the nine dials of the small model yourself.</p>
          </div>
        </details>
      </Step>

      <Step n={6}>
        <p>Fit measures come in two kinds:</p>
        <table className="rp-table left">
          <thead><tr><th>Kind</th><th>Question</th><th>Measures</th></tr></thead>
          <tbody>
            <tr><td><b>Global fit</b></td><td>Does the model as a whole reproduce the data?</td><td>absolute: χ² and χ²/df, RMSEA, SRMR · comparative (against a model in which nothing correlates): CFI, TLI</td></tr>
            <tr><td><b>Detailed fit</b></td><td>Which part of the model does not fit?</td><td>residuals, modification indices (step 7)</td></tr>
          </tbody>
        </table>
        <p className="hint">Sources: χ²/df Jöreskog (1969); RMSEA Steiger & Lind (1980); SRMR Bentler (1995); CFI Bentler (1990); TLI Tucker & Lewis (1973).</p>
        <Apply>
          <FitTable s={s} />
          <p className="hint">With MLR, the scaled χ² and the robust CFI, TLI and RMSEA are shown. TLI can fall below 0 for very poor models and rise above 1 for very good ones.</p>
          <p>The model is overidentified with {fit.df} degrees of freedom and fits the data well: χ² = {fit['chisq.scaled'].toFixed(2)}, df = {fit.df}, p = {f3(fit['pvalue.scaled'])}, CFI = {f3(fit['cfi.robust'])}, TLI = {f3(fit['tli.robust'])}, RMSEA = {f3(fit['rmsea.robust'])}, SRMR = {f3(fit.srmr)}.</p>
          <ChiSquareN s={s} />
        </Apply>
      </Step>

      <Step n={7}>
        <p>What can cause misfit? The choice of indicators or factors; violated assumptions, such as multivariate normality; or the structure of the model, such as its restrictions.</p>
        <p>How do we find it? Three places to look:</p>
        <ul>
          <li><b>Parameter estimates:</b> negative variances or standardized loadings above 1 (Heywood cases — step 5 shows how often they happen in small samples)?</li>
          <li><b>Correlation residuals:</b> the observed minus the model-implied correlations.</li>
          <li><b>Modification indices:</b> how much χ² would drop if one fixed parameter were freed (a Lagrange multiplier test; Sörbom, 1989). In a CFA, the fixed parameters are cross-loadings and error correlations.</li>
        </ul>
        <Apply>
          <p>If there are recognizable misfits, we look at the modification indices:</p>
          <Code code={`tradition_conformity_fit %>% \n  modificationindices(standardized = T, sort. = T)\n\n# correlation residuals: observed minus model-implied\nresiduals(tradition_conformity_fit, type = "cor")`} />
          <p className="hint">lhs/rhs: the variables of the suggested parameter · op: the operator (~~ a covariance) · mi: the expected drop in χ² · epc: the expected parameter change · sepc.all: the expected change, fully standardized (read it like a correlation).</p>
          <ResidualCorrelation s={s} labels={LABELS} />
          <p>The largest suggested modification is an error correlation between {s.mi[0].lhs} and {s.mi[0].rhs} (MI = {s.mi[0].mi.toFixed(3)}, correlation = {f3(s.mi[0].sepc)}). It is below 3.84, the critical χ² value for one degree of freedom, and far below the threshold of 10 used here: there is no substantial improvement to gain. Any change would need a theoretical reason, not just an index.</p>
          <p>Finally, do the items represent the factor well? All standardized loadings reach the cut-off of ≥ .40:</p>
          <LoadingBars s={s} />
          <p>Together with the fit indices: an appropriate measurement model. We keep it as it is.</p>
        </Apply>
      </Step>

      <Step n={8}>
        <p>With item intercepts τ, the formal model also reproduces the item <b>means</b> — from the intercepts, the loadings and the latent mean κ. (At the start of the day τ was the true score; from here on it is an intercept. The notation used here reuses the letter.)</p>
        <div className="sc-formula"><Tex block>{'y_i = \\tau_i + \\lambda_i\\,\\eta + \\varepsilon_i \\qquad E(y_i) = \\tau_i + \\lambda_i\\,\\kappa'}</Tex></div>
        <p>To identify the mean structure, either the intercept of the reference indicator or the latent mean is fixed to zero. lavaan fixes the latent mean κ to 0 by default — so each intercept equals the item’s mean.</p>
        <MeanStructure s={s} />
        <Apply>
          <p>In practice, the only reason to write intercepts into the model syntax is to put constraints on them (Day 4). With <code>missing = "fiml.x"</code>, lavaan already estimates the mean structure: these are the intercepts in the output of step 5, and the reason it reported 12 parameters. The 4 intercepts come with 4 new observations, the item means — so p = 10 + 4 = 14, q = 8 + 4 = 12, and df stays 2. Explicitly:</p>
          <Code code={`tradition_conformity_mean <- cfa(\n  model = "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x",\n  meanstructure = T\n)\n\nsummary(\n  object = tradition_conformity_mean,\n  fit.measures = T,\n  standardized = T\n)`} />
          <p className="hint">Check: the same χ² ({fit['chisq.scaled'].toFixed(3)}, df {fit.df}) as in step 5, and under “Intercepts” the four item means, from {f2(Math.min(...means))} to {f2(Math.max(...means))}.</p>
        </Apply>
      </Step>

      <section id="yourturn" className="sc-step">
        <header><span className="sc-n">✎</span><h2>Your turn: universalism</h2></header>
        <p className="sc-goal"><b>After this part</b> you can run steps 5 and 6 on your own — and you know what df = 0 means.</p>
        <p>Another construct: universalism with three items — <code>ipeqopt</code> (“{LABELS.ipeqopt}”), <code>ipudrst</code> (“{LABELS.ipudrst}”) and <code>impenv</code> (“{LABELS.impenv}”).</p>
        <MiniTask question="Before you run anything: how many degrees of freedom will the one-factor model of three items have?" options={['df = 2', 'df = 0', 'df = −1']} answer={1}
          done={predicted} onRight={() => setPredicted(true)}
          explain={<>Right: p = 3 · 4 / 2 = 6 variances and covariances, q = 2 loadings + 3 error variances + 1 factor variance = 6, so df = 0. Check it with the slider in step 5 (k = 3).</>} />
        <p>Now fill the gaps, estimate the model, and answer: what do the fit measures tell you — and why?</p>
        <Code code={`universalism_fit <- cfa(\n  model = "UNIV =~ ipeqopt + ____ + ____",\n  data = NL2,\n  estimator = "____",\n  missing = "fiml.x"\n)\n\nsummary(object = ____, fit.measures = T, standardized = T)`} />
        <p className="hint">You should see “Degrees of freedom 0” and no p-value for the χ² test.</p>
        <button className="btn" onClick={() => setSolution(v => !v)} aria-expanded={solution}>{solution ? 'Hide the solution' : 'Show the solution'}</button>
        {solution && (
          <div className="sc-solution">
            <Code code={`universalism_fit <- cfa(\n  model = "UNIV =~ ipeqopt + ipudrst + impenv",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)\n\nsummary(object = universalism_fit, fit.measures = T, standardized = T)`} />
            <p>Standardized loadings: {loading(u).map(l => `${l.rhs} ${f2(l.std)}`).join(' · ')}. And the fit: χ²({u.fit.df}) = {u.fit.chisq.toFixed(2)}, CFI {f3(u.fit['cfi.robust'] ?? 1)}. With three indicators the model is <b>just identified</b> — p = 6 observations, q = 6 parameters, df = 0. It reproduces the data perfectly by construction; its fit cannot be tested. Remember it for Day 2, where universalism and tradition meet in one model.</p>
            <Identification initial={3} />
          </div>
        )}
      </section>
    </article>
  );
}
