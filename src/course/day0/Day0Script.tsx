// Day 0 · before you start (about 3–4 hours at your own pace). Everything Day 1 assumes: R and the course packages (checked against a number
// R must print), the ESS data (checked the same way), the values the course measures, the
// course's R idioms, the statistics a CFA builds on, a first project question, and a self-test.
// Every part ends with something to do and a right answer, not with a self-declared tick.
// Setup and data steps follow the course's own instructions, revised after a didactic review.
import { useEffect, useState, type ReactNode } from 'react';
import { Eta } from '../../eta/Eta.tsx';
import { groupsFor, loadCourseData, type CourseData } from '../../data/course.ts';
import { markDone, type YourModel } from '../../state.ts';
import { Code } from '../day2.tsx';
import { f2 } from '../day1/data.ts';
import { CovarianceExplainer, MiniTask, NumberCheck, PipelineToy, ReverseItem, SelfTest, SymbolCard, ValuesCircle, WhatSEMSees, type QuizItem } from './widgets.tsx';

const INSTALL = `install.packages(c(
  "tidyverse",                        # data manipulation
  "sjmisc", "sjlabelled", "sjPlot",   # labelled survey data: read_spss, rec, frq, view_df
  "MVN", "easystats",                 # checking the data
  "lavaan", "semTools",               # building and checking the models
  "semPlot", "semptools",             # model visualization
  "sirt",                             # alignment (Day 5)
  "modsem"                            # latent interactions (Day 8)
))`;

const CHECK = `# η Lab setup check
library(tidyverse)
library(sjmisc)
library(sjlabelled)
library(sjPlot)
library(MVN)
library(easystats)
library(lavaan)
library(semTools)
library(semPlot)
library(semptools)

R.version.string                  # R 4.5 or newer
packageVersion("lavaan")          # 0.6-19 or newer

check <- cfa(
  model = "
    visual  =~ x1 + x2 + x3
    textual =~ x4 + x5 + x6
    speed   =~ x7 + x8 + x9
  ",
  data = HolzingerSwineford1939   # a classic data set that comes with lavaan
)

fitMeasures(check, "chisq")       # type this number into η Lab`;

const DATA = `library(tidyverse)
library(sjlabelled)
library(sjmisc)

# the whole ESS round 2 file (this takes a moment)
ESS2 <- read_spss(
  path = "ESS2.sav",                # the file you downloaded, renamed to ESS2.sav
  convert.factors = F,
  drop.labels = T
  )

# the course data, one file per country:
# the Netherlands (Days 1–3), with Belgium and Luxembourg (Days 4–5)
NL2 <- ESS2 %>% filter(cntry == "NL")
BE2 <- ESS2 %>% filter(cntry == "BE")
LU2 <- ESS2 %>% filter(cntry == "LU")

# saved with the original ESS coding; every course day reverses the items after reading
write_spss(NL2, "NL2.sav")
write_spss(BE2, "BE2.sav")
write_spss(LU2, "LU2.sav")

# three numbers for η Lab
nrow(NL2)
nrow(BE2) + nrow(LU2)

NL2 %>%
  # ipcrtiv:impfun = all 21 value items, from ipcrtiv to impfun;
  # \\(x) is a short function: "for each column x, reverse x"
  mutate(across(ipcrtiv:impfun, \\(x) rec(x, rec = "rev"))) %>%
  pull(ipfrule) %>%
  mean(na.rm = T)`;

const IDIOMS: [string, string, string][] = [
  ['read_spss(path, convert.factors = F, drop.labels = T)', 'sjlabelled', 'read an SPSS file, keep variable labels (F = FALSE, T = TRUE)'],
  ['view_df(data)', 'sjPlot', 'browse the variables with their labels and codes'],
  ['frq(x)', 'sjmisc', 'frequency table of an item'],
  ['rec(x, rec = "rev")', 'sjmisc', 'reverse a scale (also: rec = "1:3=0; 4:5=1")'],
  ['%>%', 'tidyverse', '“and then”: pass the data to the next step'],
  ['select(), filter(), mutate(across())', 'dplyr', 'columns, rows, new or recoded variables'],
  ['describe_distribution(), correlation(), principal_components(), check_itemscale()', 'easystats', 'descriptives, correlations, item statistics'],
  ['mvn()', 'MVN', 'tests of (multivariate) normality'],
  ['cfa(), sem(), summary(), fitMeasures(), modindices()', 'lavaan', 'estimate and inspect the models'],
];

const QUIZ: QuizItem[] = [
  { q: 'R prints 85.306 for the setup check. What does that tell you?', options: ['The installation works: lavaan estimated a model.', 'The model fits badly.', 'Nothing — any number is fine.'], answer: 0, why: 'The number is the χ² of a known model; if R prints it, lavaan and its dependencies work.', review: '#/day/0#setup' },
  { q: 'In the ESS file, before reversing, imptrad = 1 means …', options: ['a missing answer', '“not like me at all”', '“very much like me”'], answer: 2, why: 'The PVQ items run from 1 “very much like me” to 6 “not like me at all” — the course reverses them with rec(rec = "rev").', review: '#/day/0#values' },
  { q: 'What does NL2 %>% select(imptrad, ipfrule) %>% frq(imptrad) do?', options: ['Takes NL2, keeps two columns, and then counts the answers to imptrad.', 'Selects respondents who answered imptrad.', 'Recodes imptrad.'], answer: 0, why: 'The pipe reads “and then”: select keeps columns, frq counts.', review: '#/day/0#r' },
  { q: 'Two items have a covariance of 0.40 and variances of 1.00 and 1.60. Their correlation is …', options: ['.40', '.25', '.32'], answer: 2, why: <>r = cov / (SD of x · SD of y) = 0.40 / (√1.00 · √1.60) = 0.40 / 1.265 = .32.</>, review: '#/day/0#stats' },
  { q: 'You multiply all answers of y by 2. What changes?', options: ['The correlation with x', 'The covariance with x and the regression slope b', 'Nothing'], answer: 1, why: 'Covariance and unstandardized slope are in the units of y; correlation and β have no units.', review: '#/day/0#stats' },
  { q: 'A CFA of four items has to reproduce …', options: ['the 10 variances and covariances of the items (and their means)', 'the answer of every single respondent', 'the four item means only'], answer: 0, why: 'What the model explains is the covariance matrix (and the means). With missing answers, FIML (Day 1) uses every respondent’s answers to estimate it — but the target is still this matrix.', review: '#/day/0#stats' },
  { q: 'Tradition and conformity belong to which higher-order value?', options: ['Openness to change', 'Self-transcendence', 'Conservation'], answer: 2, why: 'Tradition, conformity and security form conservation — opposite openness to change.', review: '#/day/0#values' },
  { q: 'In a regression with one predictor, the standardized slope β equals …', options: ['the covariance', 'the correlation r', 'R²'], answer: 1, why: 'With one predictor, β = r; R² = r².', review: '#/day/0#stats' },
  { q: 'Your own data: what should you know before Day 2?', options: ['The answer format of the items and how many answers are missing', 'Only the sample size', 'Nothing yet'], answer: 0, why: 'Day 2 chooses the estimator from exactly these two facts.', review: '#/day/0#project' },
  { q: 'Why does the course reverse the value items with rec(rec = "rev")?', options: ['Because lavaan cannot read the original coding', 'So that higher values mean “more important” — easier to read, and the direction all course models assume', 'To remove the missing answers'], answer: 1, why: 'In the ESS, 1 means “very much like me”. Reversed, a higher number means the value is more important to the person.', review: '#/day/0#r' },
];

const TROUBLE: [string, string][] = [
  ['Red messages when the packages load', 'Messages such as “✖ dplyr::filter() masks stats::filter()”, “sjmisc masks …” or easystats’ notes about updates are normal. Only lines that begin with “Error” mean that something did not work.'],
  ['Windows asks “Would you like to use a personal library instead?”', 'Answer “yes” (and “yes” again to create it). R then installs the packages into your user folder.'],
  ['A package does not install', 'Update R first (R 4.5 or newer). When R asks “Do you want to install from sources the package which needs compilation?”, answer “no”. Install the packages one by one to see which one fails.'],
  ['read_spss(): file not found', 'Work in your RStudio project: the file must be in the project folder — the folder that contains the .Rproj file — and be called ESS2.sav (or write its real name in path = ). getwd() shows where R is looking.'],
  ['The download is a .zip file', 'Unzip it first. Inside is the SPSS file (its name starts with “ESS2”); move it into your project folder and rename it to ESS2.sav.'],
  ['could not find function “read_spss”, “frq” or “rec”', 'Load the packages first: library(sjlabelled) for read_spss, library(sjmisc) for frq and rec. library(tidyverse) does not load them. In a new R session, run the library() lines again.'],
  ['My numbers differ from η Lab', 'Check that you reversed the items with rec(rec = "rev"), and which ESS edition you downloaded — and compare your number with the one in the step.'],
  ['lavaan warns about “empty cases”', 'Normal with missing = "fiml.x" (from Day 1 on): respondents who answered none of the model’s items are left out. The warning names them.'],
];

function Sec({ id, n, title, minutes, goal, children }: { id: string; n: string; title: string; minutes?: string; goal: string; children: ReactNode }) {
  return (
    <section id={id} className="sc-step">
      <header><span className="sc-n">{n}</span><h2>{title}</h2>{minutes && <span className="hint" style={{ margin: 0 }}>about {minutes} min</span>}</header>
      <p className="sc-goal"><b>After this part</b> {goal}</p>
      {children}
    </section>
  );
}

export function Day0Script({ step, set, project, updateProject }: {
  step: Record<string, string>; set: (a: Record<string, string>) => void; project: YourModel; updateProject: (p: Partial<YourModel>) => void;
}) {
  const [data, setData] = useState<CourseData | null>(null);
  const [nText, setNText] = useState(String(project.n ?? ''));
  useEffect(() => { loadCourseData().then(setData).catch(() => setData(null)); }, []);
  const near = (v: string | undefined, x: number, tol: number) => { const n = Number((v ?? '').replace(',', '.')); return (v ?? '').trim() !== '' && Math.abs(n - x) <= tol; };
  const checks = [
    { id: 'setup', label: 'R and the course packages work', ok: near(step.chi, 85.306, 0.005) },
    { id: 'data', label: 'The ESS data are prepared', ok: near(step.rows, 1881, 0) && near(step.rowsbl, 3413, 0) && near(step.mean2, 4.159, 0.005) },
    { id: 'values', label: 'The values the course measures', ok: step.values === 'yes' },
    { id: 'r', label: 'The R you need', ok: near(step.validn, 1851, 0) },
    { id: 'stats', label: 'Variance, covariance, correlation', ok: step.stats === 'yes' },
    { id: 'project', label: 'A first project question', ok: (project.question ?? '').trim().length > 10 },
    { id: 'selftest', label: 'Self-test: 8 of 10', ok: Number(step.score ?? 0) >= 8 },
  ];
  const ready = checks.filter(c => c.ok).length;
  useEffect(() => { if (ready === checks.length) markDone('d0'); }, [ready, checks.length]);
  const nl = data ? groupsFor(data, 'ess2004', 'NL', 'none')[0] : null;
  const ITEMS4 = ['ipmodst', 'imptrad', 'ipfrule', 'ipbhprp'];
  const pairs = nl ? ITEMS4.flatMap((a, i) => ITEMS4.slice(i + 1).map(b => {
    const ia = nl.names.indexOf(a), ib = nl.names.indexOf(b);
    return { a, b, r: nl.cov[ia][ib] / Math.sqrt(nl.cov[ia][ia] * nl.cov[ib][ib]) };
  })) : [];
  const strongest = pairs.length ? pairs.reduce((m, x) => (x.r > m.r ? x : m)) : null;
  const weakest = pairs.length ? pairs.reduce((m, x) => (x.r < m.r ? x : m)) : null;
  const pairOptions = strongest && weakest ? [weakest, strongest, pairs.find(x => x !== strongest && x !== weakest)!] : [];

  return (
    <article className="script">
      <div id="welcome" className="card sc-intro">
        <Eta size={60} mood="curious" />
        <div>
          <p><b>Before the course.</b> About three to four hours, at your own pace, in the two weeks before Day 1 — most of it in parts 1 and 2. You will install R and the course packages, prepare the ESS data, meet the values we will measure, refresh the R and the statistics the course builds on, and write down a first question for your own project.</p>
          <p>Once the setup is done, read <a href="#/map">the map of SEM</a> (about ninety minutes): why structural equation models exist, what they can model, and how they work inside — the big picture before Day 1.</p>
          <p>Along the way, R prints a few numbers. Type them into the boxes: then you — and η Lab — know that everything works.</p>
          <p className="hint">Stuck? The <a href="#/day/0#problems">common problems</a> at the end of this page cover most setups. Your progress, models and logbook are saved in this browser only: another browser, a private window or deleting your browsing data starts from zero. They leave the browser only through a link or a file you share.</p>
        </div>
      </div>

      <div className="card d0-check">
        <p className="st-h" style={{ marginTop: 0 }}>Ready for Day 1? {ready} of {checks.length}</p>
        <ol>{checks.map(c => <li key={c.id} className={c.ok ? 'ok' : ''}><a href={`#/day/0#${c.id}`}>{c.ok ? '✓' : '○'} {c.label}</a></li>)}</ol>
      </div>

      <Sec id="setup" n="1" title="R, RStudio and the course packages" minutes="30–60" goal="R, RStudio and all course packages run on your computer — proven by one number.">
        <ol className="d0-steps">
          <li><b>Install R</b> from <a href="https://cran.r-project.org" target="_blank" rel="noreferrer">cran.r-project.org</a> — the current version (4.5 or newer). Already have R? RStudio prints the version in the console when it starts; if it is older than 4.5, install the new one. Windows: choose “base”. Mac: choose the installer for your processor — Apple silicon (M1, M2, …) → “arm64”, Intel → “x86_64”.</li>
          <li><b>Install RStudio Desktop</b> from <a href="https://posit.co/download/rstudio-desktop/" target="_blank" rel="noreferrer">posit.co</a>.</li>
          <li><b>Create a project</b> in RStudio: File → New Project → New Directory → New Project, e.g. <code>sem-course</code>. RStudio creates a folder with a file <code>sem-course.Rproj</code>. <b>All course files go into this folder.</b> You know it worked when <i>sem-course</i> appears at the top right of RStudio. Next time, open the project by double-clicking <code>sem-course.Rproj</code>: R then finds the files without long paths.</li>
          <li><b>Install the packages</b> the course uses — once. Copy the code below, click into the console (the window with the <code>&gt;</code> prompt), paste it (Ctrl+V, on a Mac Cmd+V) and press Enter. This takes several minutes; it is finished when the prompt <code>&gt;</code> appears again.
            <ul>
              <li>Windows asks about a “personal library”? Answer “yes”.</li>
              <li>R asks whether to install packages “from sources” that need compilation? Answer “no”.</li>
              <li>You see “had non-zero exit status”? One package failed — see <a href="#/day/0#problems">common problems</a>.</li>
            </ul>
          </li>
        </ol>
        <Code code={INSTALL} />
        <ol className="d0-steps" start={5}>
          <li><b>Run the setup check.</b> Open a new script (File → New File → R Script), paste the code, select all lines (Ctrl+A, on a Mac Cmd+A) and run them (Ctrl+Enter, on a Mac Cmd+Enter). Then type the number R prints at the very end. If R prints a line beginning with <b>Error</b> instead of a number, find the first such line and look it up under <a href="#/day/0#problems">common problems</a>.</li>
        </ol>
        <Code code={CHECK} />
        <p className="hint">While the packages load, R prints many messages, some in red — for example that a function “masks” another one, or that a package could be updated. That is normal. Only a line that begins with <b>Error</b> means that something did not work.</p>
        <NumberCheck label={'fitMeasures(check, "chisq")'} expect={85.306} tol={0.005} value={step.chi ?? ''} onChange={v => set({ chi: v })} unit="lavaan works" />
        <p className="hint">Optional: lavaangui is a graphical interface for lavaan that runs in the browser at <a href="https://lavaangui.org" target="_blank" rel="noreferrer">lavaangui.org</a>. In the course you will mostly draw models in η Lab itself.</p>
      </Sec>

      <Sec id="data" n="2" title="The ESS data" minutes="20–30" goal="the course files NL2.sav, BE2.sav and LU2.sav are in your project folder — proven by three numbers.">
        <ol className="d0-steps">
          <li><b>Register</b> at the <a href="https://ess.sikt.no" target="_blank" rel="noreferrer">ESS Data Portal</a> — free for non-commercial use. You get an email: confirm it, then log in.</li>
          <li><b>Get the file</b>, step by step:
            <ol type="a">
              <li>In the portal, open <b>ESS round 2 (2004)</b> and download the <b>integrated file</b> in <b>SPSS format</b>. You get a .zip file.</li>
              <li><b>Unzip</b> it (double-click on a Mac; on Windows right-click → “Extract all”). Inside is a .sav file whose name starts with “ESS2”.</li>
              <li><b>Move</b> the .sav file into your project folder.</li>
              <li><b>Rename</b> it to <code>ESS2.sav</code>. Windows hides file endings: if you see no “.sav” at the end of the name, rename it to <code>ESS2</code> only — otherwise it becomes “ESS2.sav.sav”.</li>
            </ol>
            Check it: run <code>list.files()</code> in the console. You should see <code>ESS2.sav</code> in the list.
          </li>
          <li><b>Prepare the course files.</b> Paste this code into a new script and run it as before (Ctrl/Cmd+A, then Ctrl/Cmd+Enter). Reading the big file takes a minute. Afterwards <code>NL2.sav</code>, <code>BE2.sav</code> and <code>LU2.sav</code> appear in the Files pane (lower right). Type the three numbers R prints at the end:</li>
        </ol>
        <Code code={DATA} />
        <div className="ncheck-row">
          <NumberCheck label="nrow(NL2)" expect={1881} tol={0} value={step.rows ?? ''} onChange={v => set({ rows: v })} unit="1,881 Dutch respondents" hint="check the country filter, and that you read the round 2 file" />
          <NumberCheck label="nrow(BE2) + nrow(LU2)" expect={3413} tol={0} value={step.rowsbl ?? ''} onChange={v => set({ rowsbl: v })} unit="1,778 Belgian and 1,635 Luxembourgish respondents" hint="check the country filters, and that you read the round 2 file" />
          <NumberCheck label="mean of ipfrule, reversed" expect={4.159} tol={0.005} value={step.mean2 ?? ''} onChange={v => set({ mean2: v })} unit="the reversal worked" />
        </div>
        <p className="hint">The three saved files keep the original ESS coding: every course day reverses the value items right after reading them. The ESS data never enter η Lab — the app holds only means, covariances and frequency tables; your analyses in R run on your own copy.</p>
      </Sec>

      <Sec id="values" n="3" title="The values the course measures" minutes="20" goal="you know how the ESS asks about values, which values the course uses, and why they are recoded.">
        <p>The course data come from the European Social Survey. Its human values module follows Schwartz’s theory of basic human values: ten values on a circle, measured with 21 short portraits of a person. Each respondent says how much this person is like them:</p>
        <div className="card pvq-item">
          <p className="q">“Tradition is important to him. He tries to follow the customs handed down by his religion or his family.”</p>
          <p className="hint" style={{ margin: '0 0 6px' }}>How much like you is this person? (Women see the same portrait with “her” and “she”.)</p>
          <ol className="pvq-scale">{['Very much like me', 'Like me', 'Somewhat like me', 'A little like me', 'Not like me', 'Not like me at all'].map((l, i) => <li key={l}><b>{i + 1}</b>{l}</li>)}</ol>
          <p className="hint" style={{ margin: '6px 0 0' }}>In the data this item is <code>imptrad</code>. Note the direction: <b>1 = very much like me</b>. That is why the course reverses all value items, so that a higher number means “more important” (part 4).</p>
        </div>
        <p>Day 1 starts with two neighbours on the circle — tradition and conformity, two items each.</p>
        <ValuesCircle />
        <p>The second block of the course measures attitudes toward immigration: whether people would <b>allow</b> immigrants of the same or a different ethnic group, or from poorer countries, to come and live in the country — and whether they see immigration as good for the economy, the cultural life and the country (<b>effects</b>). From Day 6 on, values explain these attitudes. The allow items, too, run “backwards”: 1 = allow many, 4 = allow none.</p>
        <MiniTask question="Which higher-order value lies opposite conservation on the circle?" options={['Self-transcendence', 'Openness to change', 'Self-enhancement']} answer={1}
          done={step.values === 'yes'} onRight={() => set({ values: 'yes' })}
          explain="Right: tradition, conformity and security (conservation) sit opposite self-direction, stimulation and hedonism (openness to change). People who value one usually value the other less." />
      </Sec>

      <Sec id="r" n="4" title="The R you need" minutes="30" goal="you can read the few R lines the course uses every day, and run one yourself.">
        <p>The course does not need much R — but it uses the same handful of functions every day. Here they are, first on a toy table, then on the real data.</p>
        <PipelineToy />
        <ReverseItem />
        <p className="hint">For reference — no need to learn the table now; Days 1 and 2 use each line, and you can always come back here.</p>
        <table className="rp-table left"><thead><tr><th>Function</th><th>Package</th><th>What for</th></tr></thead>
          <tbody>{IDIOMS.map(([f, p, w]) => <tr key={f}><td><code>{f}</code></td><td>{p}</td><td>{w}</td></tr>)}</tbody></table>
        <div className="card mini-task">
          <p className="q"><span className="mt-tag">Your turn</span>Run the two blocks from the toy table on the real data: read <code>NL2.sav</code> and reverse the value items, then look at the answers to <code>imptrad</code>. In the output, find the line that starts with <code># total N=…</code>: the “valid N” is how many respondents answered. Type it in.</p>
          <Code code={`library(tidyverse)\nlibrary(sjlabelled)\nlibrary(sjmisc)\n\nNL2 <- read_spss(path = "NL2.sav", convert.factors = F, drop.labels = T) %>%\n  mutate(across(ipcrtiv:impfun, \\(x) rec(x, rec = "rev")))\n\nNL2 %>% frq(imptrad)`} />
          <NumberCheck label="valid N of imptrad" expect={1851} tol={0} value={step.validn ?? ''} onChange={v => set({ validn: v })} unit="1,851 answered; 30 did not (NA)" hint="look for “valid N” in the line that starts with # total N" />
        </div>
      </Sec>

      <Sec id="stats" n="5" title="Variance, covariance, correlation — and what a CFA explains" minutes="30" goal="you can read a covariance and a correlation matrix, and you know why a CFA starts from it.">
        <p>Everything in the course is built on three quantities. The <b>variance</b> is how much one variable spreads. The <b>covariance</b> is how much two variables spread together, in their own units. The <b>correlation</b> is the covariance without units, between −1 and 1. A regression slope is the covariance divided by the predictor’s variance.</p>
        <MiniTask question="Guess first: the answers to y spread twice as much as before (every value doubled). What happens to the correlation of x and y?" options={['It doubles', 'It stays the same', 'It halves']} answer={1}
          done={step.guess === 'yes'} onRight={() => set({ guess: 'yes' })}
          explain="It stays the same: the correlation has no units. The covariance and the slope b double. Check it below with the slider “SD of y”." />
        <CovarianceExplainer />
        <p>For several items, the variances and covariances form the <b>covariance matrix S</b>. It is what every model in this course has to explain: a CFA reproduces it with a few loadings and error variances, and the matrix the model implies, Σ(θ), should come as close to S as possible.</p>
        {nl ? <WhatSEMSees stats={nl} items={ITEMS4} /> : <p className="hint">Loading the course data…</p>}
        {pairOptions.length > 0 && (
          <MiniTask question="Switch to the correlations R. Which pair of items correlates most strongly?" options={pairOptions.map(p => `${p.a} and ${p.b}`)} answer={1}
            done={step.stats === 'yes'} onRight={() => set({ stats: 'yes' })}
            explain={<>Right: {strongest!.a} and {strongest!.b}, r = {f2(strongest!.r)} — both are conformity items. The weakest pair is {weakest!.a} and {weakest!.b} (r = {f2(weakest!.r)}). Why do the four items correlate at all? Day 1’s answer: because one common factor — tradition/conformity — stands behind them.</>} />
        )}
        <h3>One more thing for Day 1: the χ² test</h3>
        <p>How close is “as close as possible”? The <b>χ² test</b> asks whether the difference between S and Σ(θ) is larger than chance. Its <b>degrees of freedom</b> (df) are the pieces of information in S minus the parameters the model estimates. A small <b>p-value</b> (below .05) says: the model does not reproduce the data exactly. Day 1 shows why that verdict depends heavily on the sample size. You have already seen one: the 85.306 of your setup check is the χ² of a model with three factors.</p>
        <SymbolCard />
      </Sec>

      <Sec id="project" n="6" title="Your project: a first question" minutes="20" goal="you have written down the starting point of your own SEM project.">
        <p>Over the two weeks you develop your own SEM project — with your data, or with the ESS. Today, only the starting point. A question of one sentence is enough: the checklist above ticks as soon as you have written it.</p>
        <div className="card project-step">
          <label className="ps-field">Your research question
            <textarea rows={2} value={project.question} onChange={e => updateProject({ question: e.target.value })} placeholder="e.g. Do people who value tradition oppose immigration — and is that the same in all countries?" />
          </label>
          <label className="ps-field">The construct(s) you want to measure, and the items
            <textarea rows={2} value={step.constructs ?? ''} onChange={e => set({ constructs: e.target.value })} placeholder="e.g. tradition: imptrad, ipmodst; perceived threat: three items on a 0–10 scale" />
          </label>
          <div className="row" style={{ gap: 12 }}>
            <label className="ps-field" style={{ flex: '1 1 180px' }}>Your data
              <select value={step.datastatus ?? ''} onChange={e => set({ datastatus: e.target.value })}>
                <option value="" disabled>Choose…</option>
                <option value="have">I have the data</option>
                <option value="collect">I am collecting them</option>
                <option value="ess">I will use the ESS</option>
                <option value="none">Not decided yet</option>
              </select>
            </label>
            <label className="ps-field" style={{ flex: '1 1 140px' }}>Expected number of respondents
              <input type="number" min={50} step={50} value={nText} onChange={e => setNText(e.target.value)}
                onBlur={() => { const n = Math.max(50, Math.round(Number(nText) || 50)); setNText(String(n)); updateProject({ n }); }} />
            </label>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>The number of respondents matters on Day 1: a model needs enough cases per parameter. Bring, if you can, the questionnaire wording of your items, their answer format, and how many answers are missing — Day 2 needs exactly that. Using the ESS? Its questionnaires and codebooks are on the <a href="https://ess.sikt.no" target="_blank" rel="noreferrer">ESS Data Portal</a>, next to the data. Your construct and items reappear in your project step on Day 1.</p>
        </div>
      </Sec>

      <Sec id="selftest" n="7" title="Self-test" minutes="10" goal="you know whether you are ready for Day 1 — and which part to look at again if not.">
        <SelfTest items={QUIZ} onScore={n => set({ score: String(n) })} />
      </Sec>

      <section id="problems" className="sc-step">
        <header><span className="sc-n">?</span><h2>Common problems</h2></header>
        <p>Whatever does not work yet — the installation, the data, a number that does not match: the answers below cover the usual cases. Keep the error message; it says more than any description.</p>
        {TROUBLE.map(([t, a]) => <details key={t} className="deeper trouble"><summary><span className="shape d" aria-hidden="true" /><span>{t}</span></summary><div className="deeper-body"><p>{a}</p></div></details>)}
      </section>
    </article>
  );
}

