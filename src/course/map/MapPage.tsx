// The map of SEM: one place to see the whole before (and while) learning the parts — why SEM,
// where it comes from, what it can model, the grammar of its diagrams, the matrices behind
// every model, how a model is estimated, the workflow, and how SEM relates to theory and
// causality. After the slides of the Essex SEM course, Day 1 (2024: history, model types, notation,
// philosophy of science, causality) and Day 2 (the process of linear causal modeling, estimators).
// Every section has a task with feedback; the parts marked "go deeper" carry the full algebra.
import type { ReactNode } from 'react';
import { Tex } from '../../components/ui.tsx';
import { Eta } from '../../eta/Eta.tsx';
import { BeOptimizer } from './estimation.tsx';
import { MatrixWorkshop } from './matrices.tsx';
import { CausalityCheck, MatrixQuiz, OmittedVariable, OneFramework, ProcessLoop, QuestionModel, ReadDiagram } from './quizzes.tsx';
import { FullModelMatrices, Grammar, ModelGallery, Timeline, useMapData, WhyLatent } from './widgets.tsx';

const SECTIONS: { id: string; title: string; goal: string }[] = [
  { id: 'why', title: 'Why structural equation models?', goal: 'you can say which problem SEM solves that a regression of sum scores cannot.' },
  { id: 'history', title: 'Where SEM comes from', goal: 'you know the two roots of SEM, how they came together, and what each step made possible.' },
  { id: 'course', title: 'What SEM can model — η Lab on one page', goal: 'you know the model types of η Lab and the question each one answers.' },
  { id: 'grammar', title: 'The grammar of path diagrams', goal: 'you can read every symbol of a path diagram — including the arrows that are missing.' },
  { id: 'matrices', title: 'Why matrices?', goal: 'you know that every arrow is a number in a matrix, and how the matrices produce the covariances a model implies.' },
  { id: 'estimate', title: 'How a model is estimated', goal: 'you know what estimating means: turning the parameters until Σ(θ) is as close to S as possible.' },
  { id: 'process', title: 'The process: from theory to a tested model', goal: 'you know the steps of every SEM analysis, and why the measurement model comes first.' },
  { id: 'theory', title: 'SEM, theory and causality', goal: 'you know what SEM adds to testing theories — and what it cannot prove.' },
];

function Sec({ n, children }: { n: number; children: ReactNode }) {
  const s = SECTIONS[n];
  return (
    <section id={s.id} className="sc-step">
      <header><span className="sc-n">{n + 1}</span><h2>{s.title}</h2></header>
      <p className="sc-goal"><b>After this part</b> {s.goal}</p>
      {children}
    </section>
  );
}
function Transfer({ children, answer }: { children: ReactNode; answer?: ReactNode }) {
  return (
    <div className="transfer"><span className="sc-tag">Transfer question</span>{children}
      {answer && <details className="deeper"><summary><span className="shape d" aria-hidden="true" /><span>One possible answer</span></summary><div className="deeper-body">{answer}</div></details>}
    </div>
  );
}

export function MapPage() {
  const d = useMapData();
  return (
    <article className="day">
      <header className="station-head day-head">
        <span className="kicker">Before Day 1 and along the way · the big picture</span>
        <h1>The map of SEM</h1>
        <p>Why structural equation models exist, what they can do, how they work inside and how they are estimated — the whole before the parts.</p>
      </header>
      <article className="script">
        <nav className="sec-rail" aria-label="Sections">{SECTIONS.map((s, i) => <a key={s.id} href={`#/map#${s.id}`} title={s.title}>{i + 1}</a>)}</nav>

        <div className="card sc-intro">
          <Eta size={56} mood="explaining" />
          <div>
            <p><b>Read this first</b> — before Day 1, after the setup of Day 0 — and come back to it while you work through the days. The first time, the matrices may feel abstract; by Part 2 they will feel like old friends.</p>
            <p>Most parts have a small task with feedback; the folds marked “go deeper” are for whoever wants to understand every number. The matrices (part 5) may stay abstract on a first reading — Day 3 comes back to them. Where a topic is taught in full, the map says on which day.</p>
          </div>
        </div>

        <Sec n={0}>
          <p>Much of what the social sciences care about cannot be observed directly: values, attitudes, trust, well-being. We observe answers to questions — and every answer is the construct <i>plus</i> measurement error. Three problems follow:</p>
          <ul>
            <li>A construct is <b>more than one item</b>: we need a model that says how several items reflect it.</li>
            <li>Every item <b>carries error</b>: relationships between measured scores are weaker than between the constructs.</li>
            <li>Our questions are about the <b>relationships between constructs</b> — often several at once, with causes, mediators and groups.</li>
          </ul>
          <WhyLatent />
          <p>Structural equation modeling answers all three in one model: it measures each construct with several items, separates the construct from the error, and estimates the relationships between the constructs themselves — several at once, with mediators and groups, and with a test of whether the whole model fits the data. And it <b>unifies</b> methods you may know: regression, path analysis and factor analysis are all special cases. Click through them:</p>
          <OneFramework />
        </Sec>

        <Sec n={1}>
          <p>SEM grew from two roots. Psychometrics asked how unobserved abilities and traits show in test scores: <b>factor analysis</b>. Genetics, economics and sociology asked how variables cause each other: <b>path analysis</b> and <b>systems of simultaneous equations</b>. In the early 1970s Karl Jöreskog brought both into one model — a measurement model and a structural model, estimated together. Click a milestone to see what it made possible:</p>
          <Timeline />
        </Sec>

        <Sec n={2}>
          <p>Every model in η Lab is a combination of the same pieces. Part 1 builds <b>measurement models</b>: how constructs show in items. Part 2 connects them into <b>structural models</b>: how constructs affect each other. Each card leads to its day.</p>
          <ModelGallery />
          <QuestionModel />
          <Transfer answer={<p>An example: “Do universalist values make people more open to immigration, in every country?” needs a measurement model for each construct (Days 1–2), invariance across countries before comparing them (Day 4), and a structural model for the effect (Day 6) — perhaps compared across groups (Day 8).</p>}>
            <p>Which of these models does your own research question need? Which type of confirmatory factor analysis, which structural model, do you intend to apply in your project or dissertation?</p>
          </Transfer>
        </Sec>

        <Sec n={3}>
          <p>A path diagram is a theory you can read at a glance. A few kinds of shapes, and a few kinds of arrows:</p>
          <Grammar />
          <ReadDiagram />
          <Transfer answer={<p>Values → attitude: a one-directional effect, if theory says values are formed earlier and are more stable (section 8 discusses whether that is enough). A latent variable and its item: the construct causes the answer — the arrow runs from the attitude to the item, never the other way round. That is the reflective measurement model used throughout η Lab.</p>}>
            <p>Which relation do you postulate between values and attitudes toward immigrants — and which relation exists between a latent variable such as an attitude and one item that measures it?</p>
          </Transfer>
        </Sec>

        <Sec n={4}>
          <p>Why do SEM books speak of matrices all the time? Because a matrix is simply a table of numbers — and a model is a set of tables. Every arrow you draw is a number in one of them; every arrow you leave out is a 0. Matrix algebra then turns these numbers into the one thing the model can be compared with: the covariance matrix of the items. One formula does it for every model of the CFA week:</p>
          <div className="sc-formula"><Tex block={true}>{'\\Sigma(\\theta) = \\Lambda\\,\\Psi\\,\\Lambda^{\\prime} + \\Theta'}</Tex></div>
          <p>Try it on a small model — two factors, four items. Follow the four steps of the guide first; then play.</p>
          <MatrixWorkshop />
          <p>What you just saw, in words:</p>
          <ul>
            <li><b>Λ</b> (Lambda): one row per item, one column per factor — the <b>loadings</b>. A drawn arrow is a number; a missing arrow is a 0; a 1 gives the factor its unit.</li>
            <li><b>Ψ</b> (Psi): the <b>variances and covariances of the factors</b>.</li>
            <li><b>Θ</b> (Theta): the <b>error variances</b> of the items on the diagonal, error covariances off it. The error ε is the variable in the diagram; θ is its variance.</li>
            <li><b>Σ(θ)</b>: the covariance matrix the model implies. The small θ in brackets is the list of all free parameters — the same Greek letter as the matrix Θ, but a different job: Σ depends on <i>all</i> parameters, not only on the errors.</li>
          </ul>
          <h3>The same matrices in lavaan</h3>
          <p>lavaan keeps exactly these tables for every model you estimate. <code>lavInspect(fit, what = "est")</code> shows them — here for the two-factor model of Day 2 and a small structural model of Part 2, estimated on the ESS data:</p>
          <FullModelMatrices d={d} />
          <MatrixQuiz d={d} />
        </Sec>

        <Sec n={5}>
          <p>The workshop went from the parameters to Σ. Estimation goes the other way: we know S, the covariance matrix of the data, and search the parameters whose Σ(θ) comes closest to it. Try it yourself — with real data:</p>
          {d ? <BeOptimizer d={d.est} /> : <p className="hint">Loading the data…</p>}
          <p>“Close” is measured by maximum likelihood: which parameters make exactly these data most probable? Its distance F<sub>ML</sub> is 0 when Σ(θ) = S, and N · F<sub>ML</sub> is the χ² of the model. The rest of the story is told where you need it:</p>
          <ul>
            <li><a href="#/day/1#step5">Day 1, step 5</a> — what the likelihood is, how lavaan searches (starting values, iterations, convergence), and the three things that can go wrong: no convergence, negative variances, a model that is not identified.</li>
            <li><a href="#/day/2#s3">Day 2, section 3</a> — what non-normal and incomplete data do to ML, and what MLR and FIML change.</li>
            <li><a href="#/day/2#s5">Day 2, section 5</a> — standard errors as the width of the valley, and the three tests that look at it: Wald, likelihood ratio, modification indices.</li>
            <li><a href="#/day/2#s9">Day 2, section 9</a> — ordinal answers: thresholds, polychoric correlations, WLSMV — and which estimator for your data.</li>
          </ul>
          <details className="deeper">
            <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>F<sub>ML</sub> term by term</span></summary>
            <div className="deeper-body">
              <div className="sc-formula"><Tex block>{'F_{ML} = \\underbrace{\\ln|\\Sigma(\\theta)| - \\ln|S|}_{\\text{size}} + \\underbrace{\\operatorname{tr}\\!\\big(S\\,\\Sigma(\\theta)^{-1}\\big) - k}_{\\text{shape}}'}</Tex></div>
              <p>|Σ| is the determinant, the “generalized variance” — the volume of the cloud of data the matrix describes. The first part compares the volumes of Σ and S. The trace term measures S in units of Σ: if Σ = S, then SΣ⁻¹ is the identity matrix, its trace is k (the number of items), and the term is 0. So F<sub>ML</sub> = 0 exactly when Σ(θ) = S, and positive otherwise.</p>
              <p>Where it comes from: the log-likelihood of N respondents under a multivariate normal model is −N/2 · [k ln 2π + ln|Σ| + tr(SΣ⁻¹)]. Subtract the same expression with Σ = S (the perfect model) and multiply by −2/N: F<sub>ML</sub>. Hence χ² = N · F<sub>ML</sub> (Day 1 writes N − 1, the older convention; lavaan uses N).</p>
              <p><b>Outlook: Bayesian estimation</b> combines the likelihood with a <i>prior</i> — what is plausible before seeing the data — and describes each parameter by a whole distribution. With samples like ours the results are close to ML; priors matter with small samples and for parameters that should be “approximately zero”, such as small cross-loadings or group differences (Muthén & Asparouhov, 2012). In R: <code>blavaan</code>. Not covered in η Lab.</p>
            </div>
          </details>
        </Sec>

        <Sec n={6}>
          <p>Every analysis in η Lab runs through the same loop (after the slides of the Essex SEM course, 2024, Day 2). Click a step:</p>
          <ProcessLoop />
          <p><b>Measurement first, structure second.</b> A structural model can only be as good as the measurement of its constructs. So η Lab spends Part 1 on measurement — one factor, several factors, restrictions, groups, means — and Part 2 on the structure. The order follows the two-step approach of Anderson and Gerbing (1988): check the measurement model, then add the paths between the constructs.</p>
        </Sec>

        <Sec n={7}>
          <p>SEM is not only a statistical technique; it is a way of stating and testing theories. It gives behavioural scientists tools for</p>
          <ul>
            <li><b>stating theories more exactly</b> — as a set of equations or a diagram;</li>
            <li><b>testing theories more precisely</b> — every arrow left out is a claim that could be wrong (Popper’s falsifiability; the degrees of freedom of Day 2);</li>
            <li><b>testing alternative theories against each other</b> — nested and non-nested models.</li>
          </ul>
          <p>And it tests the <b>measurement theory</b> (how constructs show in items) and the <b>substantive theory</b> (how constructs affect each other) at the same time.</p>
          <details className="deeper">
            <summary><span className="shape d" aria-hidden="true" /><span><small>Go deeper</small>SEM and the philosophy of science (Hempel, Lakatos, Kuhn)</span></summary>
            <div className="deeper-body">
              <table className="rp-table left">
                <thead><tr><th>Philosophy of science (e.g. Hempel, 1965)</th><th>SEM (e.g. Kline, 2023)</th></tr></thead>
                <tbody>
                  <tr><td>core theory: theoretical postulates (a → b)</td><td>structural model: causal relations between constructs</td></tr>
                  <tr><td>assumptions of the core theory</td><td>assumptions of the structural model</td></tr>
                  <tr><td>operationalization: rules of correspondence between constructs and indicators, with their assumptions (linearity? additivity?)</td><td>measurement theory: factors related to indicators, with a set of assumptions</td></tr>
                </tbody>
              </table>
              <p>In the scheme of Lakatos and Kuhn a theory has three layers: metaphysical assumptions (not testable), propositions of the core theory, and correspondence rules that relate constructs with indicators. When a model does not fit, the failure may lie in the core theory <i>or</i> in the correspondence rules — SEM can tell which part misfits, which is why the measurement model is checked first. Day 1 comes back to it.</p>
            </div>
          </details>
          <h3>What about causality?</h3>
          <p>Arrows in a path diagram are causal claims — but estimating a model does not prove them. Three classic conditions must hold for x to cause y (Kenny, 1979; Antonakis et al., 2010):</p>
          <ol>
            <li><b>x must precede y in time.</b> Necessary, not sufficient — and with feedback loops, cause and effect can run both ways.</li>
            <li><b>x must be reliably correlated with y</b>, beyond chance. This SEM can test.</li>
            <li><b>The relation must not be explained by other causes.</b> The hardest one: x must be exogenous — not correlated with omitted causes of y.</li>
          </ol>
          <CausalityCheck />
          <p>What a forgotten common cause does to an estimated effect:</p>
          <OmittedVariable />
          <p>The first and third conditions come from the design and from theory, not from the fit of a model. A well-fitting model is consistent with a causal theory; it does not show that the theory is the only one that fits (Part 2 meets equivalent models).</p>
          <Transfer answer={<p>Construct “importance of tradition” (TRCO), indicator <code>imptrad</code>, “It is important to him to follow traditions”. Correspondence rule: the more important tradition is to a person, the more they see themselves in this portrait. Its equation: <Tex>{'imptrad = \\tau + \\lambda \\cdot TRCO + \\varepsilon'}</Tex>.</p>}>
            <p><b>1.</b> Select a theory you work with and one construct from it. Draw a measurement model with its indicators, formulate one correspondence rule as an example, and write the equation for one item.</p>
          </Transfer>
          <Transfer answer={<p>Universalism → openness: x precedes y only by theory (one survey); the association is testable; other explanations (education, urban residence, contact with immigrants) must be in the model or ruled out by design.</p>}>
            <p><b>2.</b> Take your main hypothesis. Which of the three conditions of causality does your design meet, and which rest on theory alone?</p>
          </Transfer>
          <Transfer answer={<p>Universalist values make the welfare of all people a goal; immigrants are seen as part of that group, not as competitors — so the threat that drives rejection is weaker. The mechanism links a value (macro to micro: socialization), a perception (micro: threat) and an attitude (micro to macro: public opinion).</p>}>
            <p><b>3.</b> What is the mechanism behind your main hypothesis — in the sense of social mechanisms and analytical sociology (Hedström & Ylikoski, 2010; Gërxhani, de Graaf & Raub, 2022)?</p>
          </Transfer>
          <p className="hint">Day 1 comes back to these questions: types of models, causality and theory testing.</p>
        </Sec>

        <div className="next">
          <a className="btn" href="#/day/0">← Day 0 · Before you start</a>
          <a className="btn primary" href="#/day/1">Day 1 · Models, data and one factor →</a>
        </div>
      </article>
    </article>
  );
}
