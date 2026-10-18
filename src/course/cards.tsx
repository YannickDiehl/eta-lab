// Reference cards: what has an answer, on one page each — to look up while working, to print
// for the desk. They replace the worksheets of earlier years (Essex 2022, "Worksheet Day 2/4")
// and are written anew; numbers that the app also uses come from the same source (cutoffs.ts).
import type { ReactNode } from 'react';
import { CUTOFF_SOURCE, CUTOFFS } from '../math/cutoffs.ts';

export interface Card { id: string; day: number; title: string; body: ReactNode; source?: string }

const d2 = (v: number) => v.toFixed(2).replace(/^0/, '');

function DecisionTree() {
  return (
    <ol className="tree" aria-label="Decision tree for measurement invariance">
      <li className="t-q"><b>Test full invariance</b><span>configural → metric → scalar, each step against the one below</span></li>
      <li className="t-split">
        <div className="t-yes"><i>holds</i><b>Compare</b><span>relations (metric) or means (scalar); report the ladder</span></div>
        <div className="t-no"><i>fails</i><b>Find the cause</b><span>score tests and modification indices point to equalities — then read the items</span></div>
      </li>
      <li className="t-q"><b>Partial invariance</b><span>release only what you can explain; keep at least two anchors per factor (Byrne, Shavelson & Muthén, 1989)</span></li>
      <li className="t-split">
        <div className="t-yes"><i>holds</i><b>Compare, carefully</b><span>name the anchors; show how the means change with other anchors</span></div>
        <div className="t-no"><i>fails</i><b>Look at instrument and theory</b><span>is the model right, are the items translated alike?</span></div>
      </li>
      <li className="t-three">
        <div><b>Improve</b><span>the model or the instrument — and test again</span></div>
        <div><b>Report the difference</b><span>non-invariance is a finding: the item means something else</span></div>
        <div><b>Approximate</b><span>many groups: alignment or Bayesian approximate invariance (Asparouhov & Muthén, 2014)</span></div>
      </li>
    </ol>
  );
}

export const CARDS: Card[] = [
  {
    id: 'cfa-steps', day: 1, title: 'A CFA in eight steps', source: 'after the script of Day 1',
    body: (
      <>
        <ol className="card-steps">
          <li><b>Theory → measurement model:</b> which items reflect which construct?</li>
          <li><b>Reflective or formative?</b> Do the items follow from the construct, or make it up?</li>
          <li><b>A scale for the factor:</b> fix one loading to 1 (lavaan’s default) or the factor variance to 1.</li>
          <li><b>Assumptions:</b> enough cases (N:q 20:1, at least 10:1), distributions → MLR, correlations, item statistics.</li>
          <li><b>Identification and estimation:</b> df = p − q ≥ 0; <span className="mono">cfa()</span> and <span className="mono">summary()</span>.</li>
          <li><b>Global fit:</b> χ², CFI, TLI, RMSEA, SRMR — read together.</li>
          <li><b>Local fit:</b> loadings ≥ .40, residuals, modification indices — change only with a reason.</li>
          <li><b>Mean structure</b> (optional): intercepts and latent means.</li>
        </ol>
        <table className="rp-table">
          <thead><tr><th>lavaan</th><th>means</th></tr></thead>
          <tbody>
            <tr><td className="mono">=~</td><td>is measured by</td></tr>
            <tr><td className="mono">~</td><td>is regressed on</td></tr>
            <tr><td className="mono">~~</td><td>(residual) variance or covariance</td></tr>
            <tr><td className="mono">~1</td><td>intercept or mean</td></tr>
            <tr><td className="mono">NA*x · 1*x</td><td>free a parameter · fix it to 1</td></tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: 'fit', day: 2, title: 'Fit indices at a glance', source: `cut-offs: ${CUTOFF_SOURCE}; χ²/df: Essex SEM course slides, Day 2`,
    body: (
      <>
        <table className="rp-table">
          <thead><tr><th>Index</th><th>Asks</th><th>Good</th><th>Acceptable</th><th>Grows with n?</th></tr></thead>
          <tbody>
            <tr><td>χ² (df), p</td><td>Is the model exactly right?</td><td colSpan={2}>p &gt; .05 — rarely with large n</td><td>yes</td></tr>
            <tr><td>χ²/df</td><td>How large is χ² for the df the model risks?</td><td>≤ {CUTOFFS.chiDf.good}</td><td>≤ {CUTOFFS.chiDf.fair}</td><td>yes</td></tr>
            <tr><td>CFI, TLI</td><td>How much better than a model where nothing correlates?</td><td>≥ {d2(CUTOFFS.cfi.good)}</td><td>≥ {d2(CUTOFFS.cfi.fair)}</td><td>no</td></tr>
            <tr><td>RMSEA</td><td>How much misfit per df and person?</td><td>≤ {d2(CUTOFFS.rmsea.good)}</td><td>≤ {d2(CUTOFFS.rmsea.fair)}</td><td>small n inflates it</td></tr>
            <tr><td>SRMR</td><td>How big is the average leftover correlation?</td><td>≤ {d2(CUTOFFS.srmr.good)}</td><td>≤ {d2(CUTOFFS.srmr.fair)}</td><td>small n inflates it</td></tr>
          </tbody>
        </table>
        <p>Read the indices <b>together</b>, then look at <b>where</b> the model strains: correlation residuals above ±.10, standardized residuals above 1.96, modification indices, negative variances. Cut-offs come from simulations — conventions, not laws. With MLR, report the scaled χ² and the robust CFI, TLI and RMSEA.</p>
        <p className="mono">fitMeasures(fit, c("chisq.scaled", "df.scaled", "pvalue.scaled", "cfi.robust", "tli.robust", "rmsea.robust", "srmr"))<br />lavResiduals(fit, type = "cor") · modificationindices(fit, standardized = T, sort. = T)</p>
      </>
    ),
  },
  {
    id: 'estimators', day: 2, title: 'Which estimator?',
    body: (
      <>
        <table className="rp-table">
          <thead><tr><th>Your items</th><th>Estimator</th><th>lavaan</th></tr></thead>
          <tbody>
            <tr><td>continuous, roughly normal</td><td>ML</td><td className="mono">estimator = "ML"</td></tr>
            <tr><td>5 or more ordered categories, skewed (most Likert items)</td><td>MLR</td><td className="mono">estimator = "MLR"</td></tr>
            <tr><td>2–3 categories; 4 categories with skewed answers</td><td>WLSMV</td><td className="mono">estimator = "WLSMV", ordered = T</td></tr>
            <tr><td>missing answers (MAR)</td><td>FIML (with ML/MLR)</td><td className="mono">missing = "fiml.x"</td></tr>
          </tbody>
        </table>
        <p>Four categories are a grey zone: treated as continuous by many (Brown, 2015), but simulations favour five or more (Rhemtulla, Brosseau-Liard & Savalei, 2012; Liu et al., 2017). MLR keeps ML’s estimates and corrects χ² and the standard errors. WLSMV fits polychoric correlations; it cannot use FIML — η Lab sets <span className="mono">missing = "pairwise"</span> (lavaan’s default would drop every incomplete respondent).</p>
      </>
    ),
  },
  {
    id: 'ladder', day: 4, title: 'The invariance ladder', source: 'after the Day 4 worksheet',
    body: (
      <table className="rp-table">
        <thead><tr><th>Level</th><th>Equal across groups</th><th>You may compare</th><th>lavaan</th></tr></thead>
        <tbody>
          <tr><td>Configural</td><td>the pattern: same items on the same factors</td><td>nothing yet — the construct exists everywhere</td><td className="mono">group = "cntry"</td></tr>
          <tr><td>Metric</td><td>+ loadings (partial: at least two per factor)</td><td>covariances, correlations, unstandardized regressions</td><td className="mono">group.equal = "loadings"</td></tr>
          <tr><td>Scalar</td><td>+ intercepts (partial: at least two items with equal loading and intercept)</td><td>latent means; means of sum scores only if every item is invariant</td><td className="mono">+ "intercepts"</td></tr>
          <tr><td>Strict</td><td>+ residual variances</td><td>variances, reliabilities and standardized differences of sum scores</td><td className="mono">+ "residuals"</td></tr>
        </tbody>
      </table>
    ),
  },
  {
    id: 'chen', day: 4, title: 'Is a step acceptable?', source: 'Chen (2007); the Day 4 worksheet',
    body: (
      <>
        <p>Compare each rung with the one below. χ² difference tests (<span className="mono">lavTestLRT</span>, scaled under MLR) reject almost every equality in large samples; Chen (2007) proposes changes in fit instead — a step is acceptable when</p>
        <table className="rp-table">
          <thead><tr><th>Change</th><th>n ≤ 300: metric</th><th>scalar</th><th>n &gt; 300: metric</th><th>scalar</th></tr></thead>
          <tbody>
            <tr><td>ΔCFI</td><td>≥ −.005</td><td>≥ −.005</td><td>≥ −.010</td><td>≥ −.010</td></tr>
            <tr><td>ΔRMSEA</td><td>≤ .010</td><td>≤ .010</td><td>≤ .015</td><td>≤ .015</td></tr>
            <tr><td>ΔSRMR</td><td>≤ .025</td><td>≤ .005</td><td>≤ .030</td><td>≤ .010</td></tr>
          </tbody>
        </table>
        <p>Chen’s rule: a step indicates non-invariance when CFI drops by more than .010 <b>and</b> RMSEA rises by more than .015 <b>or</b> SRMR by more than the value above. Note: −.010, not −.10. With MLR, use the robust (or scaled) indices consistently and say which. Absolute fit is a different question: a partial model can fit well (CFI ≥ .95) and still fail the ΔCFI criterion against the metric model.</p>
      </>
    ),
  },
  {
    id: 'tree', day: 4, title: 'When full invariance fails', source: 'redrawn from the decision tree in the Essex SEM course slides (Day 4)',
    body: <DecisionTree />,
  },
  {
    id: 'lavaan-groups', day: 4, title: 'lavaan for groups',
    body: (
      <pre className="syntax"><code>{`# the first group in the data is the reference group (or set group.label)
fit_config <- cfa(model = model, data = ESS, estimator = "MLR", missing = "fiml.x",
                  group = "cntry", group.label = c("BE", "LU", "NL"))
fit_metric <- cfa(model = model, data = ESS, estimator = "MLR", missing = "fiml.x",
                  group = "cntry", group.label = c("BE", "LU", "NL"),
                  group.equal = "loadings")
fit_scalar <- cfa(model = model, data = ESS, estimator = "MLR", missing = "fiml.x",
                  group = "cntry", group.label = c("BE", "LU", "NL"),
                  group.equal = c("loadings", "intercepts"))
compareFit(scalar = fit_scalar, metric = fit_metric, config = fit_config,
           argsLRT = list(method = "satorra.bentler.2001")) %>% summary()

fit_scalar %>% lavTestScore()                      # which equality costs most?
fit_scalar %>% parTable() %>%                      # translates .p12. into a parameter
  filter(plabel %in% c(".p12.", ".p40."))

fit_partial <- cfa(model = model, data = ESS, estimator = "MLR", missing = "fiml.x",
                   group = "cntry", group.label = c("BE", "LU", "NL"),
                   group.equal = c("loadings", "intercepts"),
                   group.partial = c("ipfrule~1"))  # release one intercept

# latent means in SD of the first group
fit_partial %>% update(std.lv = T) %>% parameterEstimates() %>%
  filter(op == "~1", lhs == "TRCO")

# ordinal items: semTools::measEq.syntax(..., ID.cat = "Wu.Estabrook.2016")`}</code></pre>
    ),
  },
];

export const cardsFor = (day: number) => CARDS.filter(c => c.day === day);

export function RefCard({ card }: { card: Card }) {
  return (
    <section className="refcard card" id={`card-${card.id}`}>
      <header><small>Reference card · Day {card.day}</small><h3>{card.title}</h3></header>
      <div className="refcard-body">{card.body}</div>
      {card.source && <p className="refcard-src">{card.source}</p>}
    </section>
  );
}

/** #/cards and #/cards/N: all cards, or one day's, ready to print. */
export function CardsPage({ day }: { day?: number }) {
  const list = day ? cardsFor(day) : CARDS;
  const days = [...new Set(list.map(c => c.day))];
  return (
    <article className="cards-page">
      <header className="station-head">
        <span className="kicker">Reference cards{day ? ` · Day ${day}` : ''}</span>
        <h1>Look it up, don’t memorise it</h1>
        <p>Everything that has one right answer, on one card each. <button className="linkish" onClick={() => window.print()}>Print these cards</button>{day ? <> · <a href="#/cards">all cards</a></> : null}</p>
      </header>
      {days.map(dn => (
        <section key={dn} className="cards-day">
          <h2>Day {dn} <a className="hint" href={`#/day/${dn}`}>· the day →</a></h2>
          <div className="cards-grid">{list.filter(c => c.day === dn).map(c => <RefCard key={c.id} card={c} />)}</div>
        </section>
      ))}
    </article>
  );
}
