// Day 2 as an interactive script: estimation and fit, after the Day 2 slides of the Essex SEM
// course (2024), the Day 2 worksheet and homework, and the Essex 2023 / Lugano 2025 code
// documentation. The example model joins Day 1's two constructs: tradition/conformity and
// universalism in one CFA of the Dutch ESS 2004 data. All numbers come from R
// (scripts/day2-outputs.R) with the code used throughout η Lab. After a didactic review the order runs
// estimate → fit → local fit → comparison → checklist; ordinal items close the day.
import { useState, type ReactNode } from 'react';
import { LoadError, Predict, Tex } from '../../components/ui.tsx';
import { Eta } from '../../eta/Eta.tsx';
import { CUTOFF_SOURCE } from '../../math/cutoffs.ts';
import { ESTIMATOR_RULE } from '../../math/estimatorRule.ts';
import { Code } from '../day2.tsx';
import { LABELS } from '../day1/Day1Script.tsx';
import { f2, f3 } from '../day1/data.ts';
import { NumberCheck, useStoredValue } from '../day0/widgets.tsx';
import { factorCor, loadings, useDay2 } from './data.ts';
import { AssumptionDiagram, EstimatorCompare, MatrixPanel, SumScoreVsFactor, TwoFactorDiagram } from './figures1.tsx';
import { LatentVsSumCloud } from './figures3.tsx';
import { ScaleSwitch, useMcData, ValleyWidth } from '../map/estimation.tsx';
import { EstimatorChooser, FimlWidget, MlrSimulation, WlsmvPipeline } from '../map/robust.tsx';
import { useMapData } from '../map/widgets.tsx';
import { EvalChecklist, FitRulers, IdentHomework, MiExplorer, NestedCompare, PearsonVsPolychoric, TestingTypes, Thresholds, WaldTable } from './figures2.tsx';

const SECTIONS: { title: string; goal: string }[] = [
  { title: 'The model as a set of assumptions', goal: 'you can say which assumptions a path diagram makes — also through the arrows it leaves out — and why sum scores are no substitute.' },
  { title: 'The input: from the data matrix to the covariance matrix', goal: 'you can compare the observed and the model-implied matrix and find where the model strains.' },
  { title: 'Estimators: ML and MLR', goal: 'you know what MLR and FIML change — and what they do not.' },
  { title: 'Global fit', goal: 'you can judge the fit of the example model with several indices together.' },
  { title: 'Local fit: modification indices and Wald tests', goal: 'you can read a modification index, know where standard errors and tests come from, and why an index alone is no reason to change a model.' },
  { title: 'Nested models and model comparison', goal: 'you can compare two models with the Satorra–Bentler test and with AIC/BIC.' },
  { title: 'A checklist for model evaluation', goal: 'you can evaluate a CFA point by point before you interpret it.' },
  { title: 'Three ways to test a model', goal: 'you can tell strictly confirmatory, alternative-model and model-generating research apart.' },
  { title: 'Beyond continuous items: ordinality', goal: 'you know when to treat ordered answers as ordinal, what thresholds are, what WLSMV changes — and which estimator suits your data.' },
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
function ROut({ title = 'R output', children, open }: { title?: string; children: ReactNode; open?: boolean }) {
  return <details className="rout" open={open}><summary>{title}</summary><div>{children}</div></details>;
}
function Apply({ children }: { children: ReactNode }) {
  return <div className="sc-apply"><span className="sc-tag">Tradition/conformity and universalism, NL 2004</span>{children}</div>;
}
function Transfer({ children, answer }: { children: ReactNode; answer?: ReactNode }) {
  return (
    <div className="transfer"><span className="sc-tag">Transfer question</span>{children}
      {answer && <details className="deeper"><summary><span className="shape d" aria-hidden="true" /><span>One possible answer</span></summary><div className="deeper-body">{answer}</div></details>}
    </div>
  );
}
function Check({ label, expect, tol = 0.005, unit, hint }: { label: string; expect: number; tol?: number; unit: string; hint?: string }) {
  const [v, setV] = useStoredValue(`d2:${label}`);
  return <NumberCheck label={label} expect={expect} tol={tol} value={v} onChange={setV} unit={unit} hint={hint} />;
}

const MODEL = `trco_univ_model <- "
  TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp
  UNIV =~ ipeqopt + ipudrst + impenv
"

trco_univ_fit <- cfa(
  model = trco_univ_model,
  data = NL2,
  estimator = "MLR",
  missing = "fiml.x"
)`;

const STUDIO_SAMPLE = `# eta Lab's studio uses the respondents who answered all variables used in eta Lab
NL2_studio <- NL2 %>%
  mutate(
    agea = 2004 - yrbrn,
    female = as.numeric(gndr == 2)
  ) %>%
  drop_na(ipcrtiv:impfun, imsmetn:impcntr, imbgeco, imueclt, imwbcnt, agea, female, eduyrs)

nrow(NL2_studio)   # 1690

cfa(model = trco_univ_model, data = NL2_studio, estimator = "ML") %>%
  fitMeasures(c("chisq", "df", "cfi", "rmsea", "srmr"))
# chisq 103.943 · df 13 · cfi .950 · rmsea .064 · srmr .037`;

export function Day2Script() {
  const { d, error } = useDay2();
  const [solution, setSolution] = useState(false);
  const m = useMapData(), mc = useMcData();   // the estimation widgets of the map of SEM
  if (error) return <LoadError what="The Day 2 outputs" error={error} />;
  if (!d) return <p className="hint">Loading the outputs from R…</p>;
  const f = d.mlr.fit, r = factorCor(d.mlr.estimates);
  const z = (i: number, j: number) => d.resid_z[i][j].toFixed(1).replace('-', '−');
  const std = Object.fromEntries(loadings(d.mlr.estimates).map(l => [l.rhs, f2(l.std)]));
  const mf = d.mod.fit;

  return (
    <article className="script">
      <nav className="sec-rail" aria-label="Sections">
        <a href="#/day/2#start" title="Start">0</a>
        {SECTIONS.map((t, i) => <a key={i} href={`#/day/2#s${i + 1}`} title={t.title}>{i + 1}</a>)}
        <a href="#/day/2#yourturn" title="Your turn">✎</a>
      </nav>

      <div className="card sc-intro">
        <Eta size={56} mood="explaining" />
        <div>
          <p><b>This script:</b> how a model is estimated — and how we decide whether it fits. On Day 1 universalism ended with df = 0: just identified, untestable. Here it joins tradition/conformity in one model, and suddenly there is something to test: 28 observed variances and covariances, 15 parameters, <b>13 degrees of freedom</b>.</p>
          <p><b>How to work:</b> continue in your project with a new script <code>day2.R</code> — packages and data as on Day 1 — and run each code block as you go. The studio task and “Your turn” practise it; the stations under “Go deeper” are optional.</p>
        </div>
      </div>

      <section id="start" className="sc-step">
        <header><span className="sc-n">Start</span><h2>The model of this script</h2></header>
        <p className="sc-goal"><b>After this part</b> the two-factor model is estimated in R.</p>
        <p>The packages and the data are the same as on Day 1 (<a href="#/day/1#data">the setup</a>). The model has two correlated factors — two lines of lavaan syntax. We estimate it right away; section 3 explains the estimator.</p>
        <Code code={MODEL} />
        <p className="hint">lavaan warns that “some cases are empty”: 20 respondents answered none of the seven items. Normal with FIML.</p>
        <Check label="nobs(trco_univ_fit)" expect={d.n} tol={0} unit={`${d.n.toLocaleString('en')} respondents — the model is estimated`} hint="run nobs(trco_univ_fit)" />
        <div className="fig-solo"><TwoFactorDiagram items={d.items} labels={std} corLabel={f2(r)} /></div>
        <p>This code draws the diagram with semPlot, as on Day 1:</p>
        <Code code={`trco_univ_plot <- trco_univ_fit %>% \n  semPaths(\n    whatLabels = "std", \n    style = "mx", \n    layout = "tree", \n    edge.color = "black", \n    intercepts = F,\n    sizeMan = 8, \n    sizeLat = 10, \n    edge.label.cex = .65,\n    nCharNodes = 50\n  )\n\ntrco_univ_plot %>% \n  mark_sig(trco_univ_fit) %>% \n  plot()`} />
        <p className="hint">These are the standardized estimates you have just produced, as <code>semPaths(whatLabels = "std")</code> would draw them (the code is above). One more thing you will see in the output: lavaan reports <b>22</b> parameters, not 15. With FIML it also estimates the 7 item intercepts from the 7 item means (Day 1, step 8); for df only the 28 variances and covariances and the 15 parameters count.</p>
      </section>

      <Sec n={1}>
        <p>A CFA states a measurement theory as equations. The original slides write them in Latin letters — X for an indicator, A for the latent variable, f for a loading, e for the error: <Tex>{'X_1 = f_1 \\cdot A + e_1'}</Tex>. Day 1 and lavaan use Greek letters: <Tex>{'y_1 = \\lambda_1 \\eta + \\varepsilon_1'}</Tex>. Both say the same. Two assumptions come with every such equation: the latent variable and the errors are uncorrelated, <Tex>{'\\mathrm{Cov}(\\eta, \\varepsilon_i) = 0'}</Tex>, and the errors have a mean of zero, <Tex>{'E(\\varepsilon_i) = 0'}</Tex>.</p>
        <p><b>In the graphical input, everything that you see or do not see is an explicit assumption.</b> An arrow you draw is a parameter to estimate; an arrow you leave out is a parameter fixed to zero.</p>
        <AssumptionDiagram d={d} />
        <Transfer answer={<p>With two indicators, one factor has p = 3 pieces of information but q = 4 parameters (1 loading, 2 error variances, 1 factor variance): df = −1. You need an extra assumption — for example equal loadings — or a second factor that correlates with the first and lends it information. If the latent variable and an error were correlated, part of what the model calls the construct would be error: the loadings would be biased.</p>}>
          <ul>
            <li>Draw a measurement model with only two indicators. What would you have to assume to estimate it?</li>
            <li>What would it mean for the model if the latent variable and an error were correlated?</li>
          </ul>
        </Transfer>
        <h3>Why not simply add up the items?</h3>
        <p>Indices and sum scores are the everyday alternative to a CFA. They make strong assumptions without testing them:</p>
        <ul>
          <li><b>equal weights</b> for all items,</li>
          <li><b>equal measurement errors</b>,</li>
          <li><b>unidimensionality</b> — the items measure one thing.</li>
        </ul>
        <p>And their measurement error stays in the score, so correlations with other variables are <b>attenuated</b>.</p>
        <SumScoreVsFactor d={d} />
        <p>Where the difference comes from, in people: the same simulated respondents, once with their latent values, once with their sum scores.</p>
        <LatentVsSumCloud d={d} />
        <Transfer><p>Do you use indices or sum scores in your research? Which of the assumptions above would you be willing to defend?</p></Transfer>
      </Sec>

      <Sec n={2}>
        <p>The raw input for a CFA is a normal data file: N respondents (rows) by k variables (columns). The CFA itself works with less: the <b>covariance matrix S</b> of the k variables — k(k + 1)/2 variances and covariances — or, standardized, the correlation matrix R. With missing values, FIML estimates S from all available answers; lavaan calls it the sample statistics (“sampstat”).</p>
        <p>The model implies its own covariance matrix <Tex>{'\\Sigma(\\theta)'}</Tex>. Estimation chooses the parameters θ so that the implied matrix comes as close as possible to the observed one; the χ² test asks whether the remaining difference is larger than chance. A recap from Day 1, step 5:</p>
        <div className="sc-formula"><Tex block>{'F_{ML} = \\ln|\\Sigma(\\theta)| - \\ln|S| + tr[S\\,\\Sigma(\\theta)^{-1}] - k \\qquad \\chi^2 = F_{ML}\\,(n-1)'}</Tex></div>
        <p className="hint">k is the number of items (here 7); p = k(k + 1)/2 = 28 is the number of variances and covariances. (lavaan multiplies by N instead of n − 1 — invisible with 1,861 respondents.)</p>
        <Apply>
          <Code code={`# observed (FIML) and model-implied covariance matrix\nlavInspect(trco_univ_fit, what = "sampstat")$cov\nfitted(trco_univ_fit)$cov\n\n# residuals as correlations, and standardized\nlavResiduals(trco_univ_fit, type = "cor")`} />
          <MatrixPanel d={d} />
          <Check label="standardized residual impenv–imptrad" expect={d.resid_z[6][1]} tol={0.01} unit="the largest of all — the place where the model strains most" hint={'in lavResiduals(trco_univ_fit)$cov.z, row impenv, column imptrad — not the type = "cor" table'} />
          <p>Three findings, block by block:</p>
          <ul>
            <li><b>Within tradition/conformity:</b> all standardized residuals are small — the block is reproduced.</li>
            <li><b>Between the two factors:</b> one factor correlation of {f2(r)} has to explain all twelve covariances. <code>imptrad</code> and <code>impenv</code> covary more than that (z = {z(6, 1)}), <code>imptrad</code> and <code>ipeqopt</code> less (z = {z(4, 1)}).</li>
            <li><b>Within universalism:</b> no longer exact, because the three loadings now also have to serve the twelve covariances between the blocks: <code>ipudrst</code> and <code>impenv</code> covary less than implied (z = {z(6, 5)}). On Day 1, with df = 0, that could not happen.</li>
          </ul>
        </Apply>
      </Sec>

      <Sec n={3}>
        <p>On Day 1 we chose MLR because <code>mvn()</code> rejected normality. What does it actually change — and which estimator fits which data?</p>
        <table className="rp-table left">
          <thead><tr><th>Estimator</th><th>For</th><th>What it does</th><th>lavaan</th></tr></thead>
          <tbody>
            <tr><td><b>ML</b></td><td>continuous, multivariate normal items</td><td>maximum likelihood: the default</td><td><code>estimator = "ML"</code></td></tr>
            <tr><td><b>MLR</b></td><td>continuous items that are not normal; missing values</td><td>the same estimates as ML; robust standard errors and a corrected (scaled) χ²</td><td><code>estimator = "MLR"</code></td></tr>
            <tr><td><b>WLSMV</b></td><td>ordinal items with few categories</td><td>models the answers as ordered categories (section 9)</td><td><code>estimator = "WLSMV", ordered = T</code></td></tr>
          </tbody>
        </table>
        <Apply>
          <p>On Day 1, all tests rejected normality for the four tradition/conformity items; the three universalism items are even more skewed. So we estimate the model with ML as well and compare:</p>
          <Code code={`trco_univ_fit_ml <- cfa(\n  model = trco_univ_model,\n  data = NL2,\n  estimator = "ML",\n  missing = "fiml.x"\n)\n\n# the same model, ML against MLR: the same estimates, a different test\ntrco_univ_fit_ml %>% fitMeasures(c("chisq", "df"))\ntrco_univ_fit %>% fitMeasures(c("chisq.scaled", "chisq.scaling.factor"))\n\nsummary(\n  object = trco_univ_fit,\n  fit.measures = T,\n  standardized = T\n)`} />
          <EstimatorCompare d={d} />
          <ROut title="R output · summary(trco_univ_fit)"><pre className="syntax"><code>{d.mlr.summary}</code></pre></ROut>
          <p>In the output, the column <i>Standard</i> is the ML test, the column <i>Scaled</i> the robust one: χ²({f.df}) = {f['chisq.scaled'].toFixed(2)} with a scaling correction factor of {f['chisq.scaling.factor'].toFixed(3)}. For MLR, report the scaled χ² and the robust CFI, TLI and RMSEA.</p>
          <Check label="Scaled test statistic" expect={f['chisq.scaled']} unit={`χ²(${f.df}) = ${f['chisq.scaled'].toFixed(2)}`} hint="look for “Test Statistic”, column “Scaled”" />
        </Apply>
        <h3>Why MLR? What non-normal data do to ML</h3>
        <p>MLR gives the same estimates as ML — so why bother? A simulation answers it: thousands of samples from the example model, with normal and with non-normal data, each estimated with ML and with MLR. Guess first:</p>
        <Predict question="Severely non-normal data, n = 500, and the model is TRUE. How often does ML’s χ² test reject it at α = .05? (It should be 5 %.)" min={0} max={60} step={1} start={10} truth={47} format={v => `${v} %`}
          explain={() => <>About 47 % of the time — almost every other sample. The scaled χ² of MLR rejects about 21 %: much better, though not perfect. Look at the simulation below for the standard errors too.</>} />
        {m && <MlrSimulation mc={mc} scaling={m.est.course.scaling} />}
        <h3>Missing answers: FIML</h3>
        <p>The code here writes <code>missing = "fiml.x"</code> into every model. What does full-information ML do with a respondent who skipped a question — and when would simply dropping them go wrong?</p>
        {m && <FimlWidget d={m.est} mc={mc} />}
        {m && (
          <details className="deeper">
            <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>Why ML is the default: it does not care about units</span></summary>
            <div className="deeper-body"><ScaleSwitch d={m.est} /></div>
          </details>
        )}
      </Sec>

      <Sec n={4}>
        <p>Global fit, index by index:</p>
        <ul>
          <li><b>χ²</b> measures the distance between S and Σ(θ). <b>df</b> measures how much the model risks — its falsifiability. <b>χ²/df</b> relates the two: ≤ 2 good, ≤ 3 satisfactory (original slides). Above 3 the model is called <i>underfitted</i> (it misses something); below 1 <i>overfitted</i> (more parameters than the data justify). Like χ², it grows with n.</li>
          <li><b>CFI</b> ≥ .95 good, ≥ .90 acceptable; <b>TLI</b> the same, with a penalty for extra parameters.</li>
          <li><b>RMSEA</b> ≤ .05 good, ≤ .08 moderate; <b>SRMR</b> ≤ .05 good, ≤ .08 moderate.</li>
          <li><b>AIC</b> and <b>BIC</b> have no cut-off: smaller is better, but only in comparison with another model of the same data (section 6).</li>
        </ul>
        <p className="hint">Cut-offs: {CUTOFF_SOURCE}. They differ in their sensitivity to n and in their penalty for complexity (West, Taylor & Wu, 2012) — conventions, not laws.</p>
        <Apply>
          <Code code={`trco_univ_fit %>% \n  fitMeasures(c("chisq.scaled", "df.scaled", "pvalue.scaled",\n                "cfi.robust", "tli.robust", "rmsea.robust", "srmr", "aic", "bic"))`} />
          <FitRulers d={d} />
          <Check label="robust CFI" expect={f['cfi.robust']} tol={0.0005} unit={`CFI ${f3(f['cfi.robust'])} — the robust version, as everywhere with MLR`} hint="cfi.robust, not cfi or cfi.scaled" />
          <p>The χ² test rejects exact fit — χ²({f.df}) = {f['chisq.scaled'].toFixed(2)}, p &lt; .001 — as expected with {d.n.toLocaleString('en')} respondents (Day 1, step 6). CFI ({f3(f['cfi.robust'])}) and SRMR ({f3(f.srmr)}) indicate a good fit, RMSEA ({f3(f['rmsea.robust'])}) a moderate one. TLI ({f3(f['tli.robust'])}) is below .95: it penalizes complexity more. χ²/df ({(f['chisq.scaled'] / f.df).toFixed(1)}) is too high. A usable model — but something in the data is not reproduced. The next sections look for it.</p>
        </Apply>
      </Sec>

      <Sec n={5}>
        <p><b>Modification indices</b> (Lagrange multiplier tests) estimate how much χ² would drop if one fixed parameter were freed — you know them from Day 1, step 7. An MI above 3.84 is significant for one df; here we look at MIs above 10 first — and free nothing without a reason. Free parameters <b>stepwise</b>, one at a time, and only <b>theory-driven</b>: every freed parameter makes the model fit this sample better — and generalize worse (section 8).</p>
        <Apply>
          <Code code={`trco_univ_fit %>% \n  modificationindices(standardized = T, sort. = T) %>% \n  head(8)`} />
          <ROut title="R output · modificationindices()"><pre className="syntax"><code>{d.mi_text}</code></pre></ROut>
          <p><b>Your turn:</b> click the top row below. Read both item texts and write one sentence for yourself: what could the two share beyond their factor? Then compare rows 2 and 3 — marked ≡ — and read the note.</p>
          <MiExplorer d={d} labels={LABELS} />
          <p>The <b>Wald test</b> asks the opposite question: could a free parameter be fixed to zero? Its z value is the estimate divided by its standard error (z² is the Wald χ² with one df); with |z| &lt; 1.96 the parameter is not significant and could be dropped — again, only if theory allows it.</p>
          <Code code={`parameterEstimates(trco_univ_fit, standardized = T) %>% \n  filter(op %in% c("=~", "~~"), lhs != rhs)`} />
          <WaldTable d={d} />
          <p>All loadings and the factor correlation are far from zero. Nothing to drop — the question here is what to add.</p>
        </Apply>
        <h3>Where standard errors and tests come from</h3>
        <p className="hint">The small model, as in Day 1, step 5: TRCO measured by ipfrule and ipbhprp, UNIV by ipeqopt and ipudrst. λ₂₁ is the loading of ipbhprp (item 2 on factor 1), λ₄₂ that of ipudrst (item 4 on factor 2).</p>
        <p>The z of the Wald test, the modification index and the χ² difference test of section 6 all look at one thing: the valley of F<sub>ML</sub> around the estimate. Its width is the standard error. Explore it on the small model of the map of SEM — two factors with two items each:</p>
        {m && <ValleyWidth d={m.est} />}
      </Sec>

      <Sec n={6}>
        <p>Two models are hierarchical or <b>nested</b> if one is a proper subset of the other: if a free parameter of model A is replaced by a fixed value (for example zero) to form model B, model B is nested in model A. Examples: congeneric vs. tau-equivalent models (Day 3), metric vs. scalar invariance (Day 4), partial vs. full mediation (Day 7).</p>
        <p>Nested models are compared with a χ² difference test. With MLR, the difference of two scaled χ² values is not χ²-distributed and needs the <b>Satorra–Bentler</b> correction. Models that are not nested are compared with AIC and BIC.</p>
        <Apply>
          <p><b>One factor instead of two?</b> A single values factor is the two-factor model with the factor correlation fixed to 1 — so it is nested, with one degree of freedom more.</p>
          <Code code={`values_fit <- cfa(\n  model = "VALUES =~ ipmodst + imptrad + ipfrule + ipbhprp + ipeqopt + ipudrst + impenv",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)\n\ncompareFit(\n  values_fit, trco_univ_fit,\n  argsLRT = list(method = "satorra.bentler.2001")\n) %>% \n  summary()`} />
          <NestedCompare d={d} />
          <Check label="Δχ²_SB, one factor against two" expect={d.lrt_1v2[1].dchisq ?? 0} tol={0.05} unit={`Δχ²(${d.lrt_1v2[1].ddf}) = ${(d.lrt_1v2[1].dchisq ?? 0).toFixed(2)} — the column “Chisq diff”`} hint="“Chisq diff” is already the Satorra–Bentler difference; the column “Chisq” holds the standard values" />
          <ROut title="R output · compareFit(values_fit, trco_univ_fit)"><pre className="syntax"><code>{d.cmp_1v2_text}</code></pre></ROut>
          <p className="hint">lavaan adds a NOTE: the column “Chisq” holds the standard (not robust) χ² values. Do not report that column; “Chisq diff” is already the scaled Satorra–Bentler difference. compareFit also sorts the models by df.</p>
          <p><b>The largest modification index, freed.</b> The model with <code>{d.freed}</code> is the example model plus one parameter:</p>
          <Code code={`trco_univ_fit_mod <- cfa(\n  model = "\n    TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp\n    UNIV =~ ipeqopt + ipudrst + impenv\n    imptrad ~~ impenv\n  ",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)\n\ncompareFit(\n  trco_univ_fit, trco_univ_fit_mod,\n  argsLRT = list(method = "satorra.bentler.2001")\n) %>% \n  summary()`} />
          <ROut title="R output · compareFit(trco_univ_fit, trco_univ_fit_mod)"><pre className="syntax"><code>{d.cmp_mod_text}</code></pre></ROut>
          <p>Why is Δχ²<sub>SB</sub> = {d.lrt_mod.find(x => x.dchisq !== null)!.dchisq!.toFixed(1)} smaller than the MI of {d.mi[0].mi.toFixed(1)}? The MI estimates the drop in the standard ML χ²; the Satorra–Bentler test corrects for the non-normal data.</p>
          <p><b>What follows?</b> The modified model fits better — χ²({mf.df}) = {mf['chisq.scaled'].toFixed(1)}, p = {f3(mf['pvalue.scaled'])}, CFI {f3(mf['cfi.robust'])} — but it is still rejected by χ², and the freed parameter came from the data, not from theory. Whether to keep it is a question of content: what do “following traditions and customs” and “caring for nature and the environment” share beyond their values? That decision is the studio task of this day. Changing a model on the same data because an index said so is <b>model generating</b> (section 8).</p>
        </Apply>
      </Sec>

      <Sec n={7}>
        <p>Before a model is interpreted, it passes a checklist. Now that you know global fit, local fit and model comparison, check the example model point by point:</p>
        <EvalChecklist d={d} />
      </Sec>

      <Sec n={8}>
        <p>Linear causal modeling runs in a loop:</p>
        <ol className="loop-flow">
          <li>starting hypotheses</li><li>data collection and preprocessing (reliability)</li><li>model specification as a path diagram (identification?)</li><li>model estimation</li><li>model evaluation</li>
        </ol>
        <p>If the model does not fit, it is modified and estimated again; if it fits, it goes back to the hypotheses. Jöreskog (1993) distinguishes three situations:</p>
        <div className="tt-types">
          <div className="card"><b>Strictly confirmatory (SC)</b><p>One single model, empirical data to test it. The model is either accepted or rejected.</p></div>
          <div className="card"><b>Alternative models (AM)</b><p>Several competing models; on the basis of one data set, one of them is selected.</p></div>
          <div className="card"><b>Model generating (MG)</b><p>A tentative initial model; if it does not fit, it is modified — theory- or data-driven — and tested again on the same data. The goal: a model that fits and whose every parameter has a substantive meaning. Although a model is tested in each round, the whole approach is model generating, not model testing.</p></div>
        </div>
        <TestingTypes />
        <Transfer><p>Which type of model testing do you have in your research — strictly confirmatory, alternative models, or model generating? Note it in your project step below, in the field “which changes would you accept”.</p></Transfer>
      </Sec>

      <Sec n={9}>
        <p>The value questions are measured on a 6-point scale: 1 — not like me at all, to 6 — very much like me. This is typical in survey research. So far we have treated these answers as continuous. What else could we do?</p>
        <p>A CFA with <b>ordinal</b> indicators assumes a continuous <b>latent response variable</b> y* behind each item. The loadings λ now connect the factor with y*. In lavaan’s default parametrization the intercepts of y* are fixed to 0; instead the model estimates <b>thresholds</b>. With six response categories there are five thresholds. They cut the latent response variable into six parts: if y* exceeds a threshold, the observed answer moves to the next category.</p>
        <div className="sc-formula"><Tex block>{'y^*_i = \\lambda_i\\,\\eta + \\varepsilon_i \\qquad y_i = c \\iff \\nu_{i,c-1} < y^*_i \\le \\nu_{i,c}'}</Tex></div>
        <p className="hint">Notation: we write the thresholds ν (nu), because on Day 1 τ was the intercept. lavaan prints them as <code>ipmodst|t1</code> … <code>|t5</code>, and many texts call them τ.</p>
        <Apply>
          <Code code={`trco_univ_fit_ord <- cfa(\n  model = trco_univ_model,\n  data = NL2,\n  estimator = "WLSMV",\n  ordered = T,\n  missing = "pairwise"\n)\n\nsummary(\n  object = trco_univ_fit_ord,\n  fit.measures = T,\n  standardized = T\n)\n\nlavInspect(trco_univ_fit_ord, what = "th")   # the thresholds`} />
          <p className="hint">WLSMV cannot use FIML. <code>missing = "pairwise"</code> uses every pair of answers; without it, lavaan would drop every respondent with a missing answer.</p>
          <Thresholds d={d} labels={LABELS} />
          <p>Treating ordinal items as continuous has three consequences:</p>
          <ol>
            <li>the relationships between the indicators are attenuated;</li>
            <li>pseudo-factors may appear — artifacts of item difficulty or extremeness;</li>
            <li>tests and standard errors may be wrong.</li>
          </ol>
          <p>The first is easy to see in our data:</p>
          <PearsonVsPolychoric d={d} />
          <Check label="WLSMV: scaled χ²" expect={d.ord.fit['chisq.scaled']} tol={0.05} unit={`χ²(${d.ord.fit.df}) = ${d.ord.fit['chisq.scaled'].toFixed(1)} — n = ${d.n_ord.toLocaleString('en')}, pairwise`} hint={'did you set ordered = T and missing = "pairwise"? Without pairwise, lavaan drops every respondent with a missing answer'} />
          {m && (
            <details className="deeper">
              <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>WLSMV step by step: thresholds, polychoric correlations, weighted least squares</span></summary>
              <div className="deeper-body"><WlsmvPipeline d={m.est} /></div>
            </details>
          )}
          <p>How robust is the continuous treatment? Simulation studies (Liu et al., 2017) show:</p>
          <ul>
            <li>dichotomous items with extreme skewness — especially in opposite directions — bias factor loadings strongly (e.g. by .3);</li>
            <li>the more categories, the less bias;</li>
            <li>from five categories on, ordinal items may be treated as continuous, with a robust estimator such as MLR. Four categories are a grey zone (Brown, 2015, accepts them); with skewed answers, use WLSMV.</li>
          </ul>
          <p>Six categories, as here, with at most 30 % of the answers in an end category, are on the safe side; the differences above are the remaining price. The rule used here, in one place: {ESTIMATOR_RULE}</p>
          <ROut title={`R output · summary(trco_univ_fit_ord) · n = ${d.n_ord}, pairwise`}><pre className="syntax"><code>{d.ord.summary}</code></pre></ROut>
        </Apply>
        <h3>Which estimator for your data?</h3>
        <p>Three questions about your own items — and the lavaan call that follows from the rules above:</p>
        <EstimatorChooser />
        <Transfer answer={<p>{ESTIMATOR_RULE}</p>}>
          <p>How many categories do the scales you are using have: 2, 3, 4, 5, 6, 7 or more? Do you treat them as ordinal or interval scales — and from which number of categories on is a metric procedure legitimate according to simulation results?</p>
        </Transfer>
      </Sec>

      <section id="studio" className="sc-step">
        <header><span className="sc-n">Studio</span><h2>Why the studio’s numbers differ</h2></header>
        <p>The same two-factor model, five numbers for χ² — all correct, each for a different sample or estimator:</p>
        <table className="rp-table left">
          <thead><tr><th>where</th><th>respondents</th><th>estimator, missing answers</th><th>χ²(13)</th></tr></thead>
          <tbody>
            <tr><td>this script, the test to report</td><td>{d.n.toLocaleString('en')}</td><td>MLR, FIML — the scaled χ²</td><td>{f['chisq.scaled'].toFixed(2)}</td></tr>
            <tr><td>this script, the column “Standard”</td><td>{d.n.toLocaleString('en')}</td><td>ML, FIML</td><td>{f.chisq.toFixed(2)}</td></tr>
            <tr><td>Day 1, step 5 (the likelihood fold)</td><td>1,830</td><td>ML, listwise</td><td>103.02</td></tr>
            <tr><td>the studio and its task</td><td>1,690</td><td>ML, only respondents with all variables used in η Lab</td><td>103.94</td></tr>
          </tbody>
        </table>
        <p>To get the studio’s numbers in R:</p>
        <Code code={STUDIO_SAMPLE} />
        <p><a className="btn primary" href="#/model?task=d2-strain">Start the studio task →</a></p>
      </section>

      <section id="yourturn" className="sc-step">
        <header><span className="sc-n">✎</span><h2>Your turn: alternative identifications</h2></header>
        <p className="sc-goal"><b>After this part</b> you have shown yourself that scaling changes the unit, not the model — a repetition of Day 1, step 3.</p>
        <p>Estimate a one-factor CFA of tradition/conformity three times: with the first loading fixed (lavaan’s default), with the loading of the <i>fourth</i> indicator fixed instead, and with the factor variance fixed. Fill the gaps — then compare the three outputs.</p>
        <Code code={`tradition_conformity_fit <- cfa(\n  model = "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)\n\ntradition_conformity_fit2 <- cfa(\n  model = "TRCO =~ ____*ipmodst + imptrad + ipfrule + ____*ipbhprp",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)\n\ntradition_conformity_fit3 <- cfa(\n  model = "\n  TRCO =~ ____*ipmodst + imptrad + ipfrule + ipbhprp\n  TRCO ~~ ____*TRCO\n  ",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)\n\nsummary(object = tradition_conformity_fit2, fit.measures = T, standardized = T)`} />
        <button className="btn" onClick={() => setSolution(v => !v)} aria-expanded={solution}>{solution ? 'Hide the solution' : 'Show the solution'}</button>
        {solution && <div className="sc-solution"><Code code={`tradition_conformity_fit2 <- cfa(\n  model = "TRCO =~ NA*ipmodst + imptrad + ipfrule + 1*ipbhprp",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)\n\ntradition_conformity_fit3 <- cfa(\n  model = "\n  TRCO =~ NA*ipmodst + imptrad + ipfrule + ipbhprp\n  TRCO ~~ 1*TRCO\n  ",\n  data = NL2,\n  estimator = "MLR",\n  missing = "fiml.x"\n)\n\n# the third variant in one argument: std.lv = T fixes every factor variance to 1\ncfa(model = "TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp",\n    data = NL2, estimator = "MLR", missing = "fiml.x", std.lv = T)`} /></div>}
        <IdentHomework d={d} />
      </section>
    </article>
  );
}
