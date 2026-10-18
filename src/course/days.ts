// The learning path in ten days. Each day is a playlist of moves:
//   understand  the interactive script, stations (full, 20–30 min) and mini-stations (one Wonder + one Play)
//   try         a task card on the course model in the studio
//   project     one small step in the learner's own project (a parallel track, never blocked)
//   in R        the same model in lavaan, with the numbers to expect
// plus reference cards, a self-check and the reading. η Lab works on its own: it holds no
// timetable and no live-session logic — courses that use it plan those themselves.
// Items marked 'planned' show what is coming. The topics follow the outline of the Essex SEM course.

export type Status = 'ready' | 'planned';
export type Move = 'understand' | 'try' | 'project' | 'r' | 'check' | 'read';

export interface Item {
  move: Move;
  title: string;
  blurb: string;
  status: Status;
  station?: string;            // a station id (route #/<id>)
  mini?: boolean;              // a mini-station
  task?: string;               // a task id (studio/tasks.ts)
  template?: string;           // a course model in the studio (Data → course models), by title
  minutes?: number;
}

export interface Day {
  n: number; week: 0 | 1 | 2;
  title: string; subtitle: string;
  theory: string; practice: string;
  items: Item[];
  reading: { essential: string[]; additional: string[] };
  /** the project step of the day: a checklist line, done in the parallel project track */
  project: { title: string; noData: string };
}

export const DAYS: Day[] = [
  {
    n: 0, week: 0, title: 'Before you start', subtitle: 'Setup, data and the basics Day 1 builds on',
    theory: 'Variance, covariance and correlation; the covariance matrix a SEM explains; regression; Schwartz’s values and the ESS.',
    practice: 'Install R, RStudio and the course packages; prepare the ESS round 2 data; the course’s R idioms; a first project question.',
    items: [
      { move: 'understand', title: 'Before you start', blurb: 'Setup with a check, the ESS data, the R and the statistics the course builds on, the values it measures, and a self-test.', status: 'ready', minutes: 200 },
    ],
    reading: { essential: [], additional: ['Brown (2015), chapters 1–2', 'Schwartz (2012), An overview of the Schwartz theory of basic values'] },
    project: { title: 'Write down a first question, and what you know about your data', noData: 'No data yet? The ESS works for every project.' },
  },
  {
    n: 1, week: 1, title: 'Models, data and one factor', subtitle: 'From a construct to a first CFA',
    theory: 'Hypothetical constructs and classic test theory; the CFA procedure in eight steps: measurement model, reflective vs. formative, scaling, assumptions, identification and estimation, fit, misspecification, mean structure. AI-drafted syntax is always checked against the path diagram and the theory.',
    practice: 'CFA with one construct and four indicators: tradition and conformity in the Netherlands.',
    items: [
      { move: 'understand', title: 'The CFA procedure in eight steps', blurb: 'From the classic test theory to an estimated, checked measurement model — the course script, interactive.', status: 'ready', minutes: 200 },
      { move: 'understand', title: 'Noise hides relationships', blurb: 'Measurement error dilutes every correlation; several items get it back.', status: 'ready', station: 's4', minutes: 20 },
      { move: 'understand', title: 'The measurement machine', blurb: 'One factor produces the correlations of four items — turn the dials yourself.', status: 'ready', station: 's5', minutes: 25 },
      { move: 'understand', title: 'The knowledge budget', blurb: 'Knowns minus unknowns: when a model can be estimated, and when it can be tested.', status: 'ready', station: 's6', minutes: 20 },
      { move: 'try', title: 'One value or two?', blurb: 'Tradition and conformity as two factors: predict df, read their correlation, decide — and switch the scaling.', status: 'ready', task: 'd1-one-or-two', minutes: 25 },
      { move: 'r', title: 'First steps in lavaan', blurb: 'read_spss, rec, mvn, check_itemscale, cfa with MLR and FIML — in the script.', status: 'ready' },
      { move: 'check', title: 'Check it', blurb: 'Three questions on degrees of freedom, scaling and the estimator.', status: 'ready' },
    ],
    reading: { essential: ['Brown (2015), chapter 3'], additional: ['Davidov & Schmidt (2007)', 'Davidov, Schmidt & Schwartz (2008)', 'Rosseel (2012)', 'Karch (2025)'] },
    project: { title: 'Name your question, your construct and its items', noData: 'No data yet? Pick a construct from the ESS variable list in the studio.' },
  },
  {
    n: 2, week: 1, title: 'Estimation and fit', subtitle: 'How a model is estimated — and how we decide whether it fits',
    theory: 'The model as a set of assumptions; CFA vs. sum scores; observed and implied matrices; ML, MLR and WLSMV; ordinal indicators and thresholds; global and local fit; nested models; Jöreskog’s three ways to test a model.',
    practice: 'Two value constructs in the Netherlands: estimate the two-factor model, read global and detailed fit, decide about a modification — with ML and MLR.',
    items: [
      { move: 'understand', title: 'Estimation and fit, step by step', blurb: 'Tradition/conformity and universalism in one model: assumptions, matrices, estimators, fit and model comparison — the course script, interactive.', status: 'ready', minutes: 270 },
      { move: 'understand', title: 'Rolling downhill', blurb: 'Estimation is a search across a landscape; the valley’s shape gives the standard errors.', status: 'ready', station: 's7', minutes: 20 },
      { move: 'understand', title: 'How close is close enough?', blurb: 'χ², RMSEA, CFI and SRMR ask four different questions — and n changes the answer of one.', status: 'ready', station: 's8', minutes: 25 },
      { move: 'understand', title: 'Data as they are', blurb: 'Six boxes, piled up at one end: what that does to correlations, and what MLR and WLSMV change.', status: 'ready', station: 's9', mini: true, minutes: 10 },
      { move: 'try', title: 'Where does the two-factor model strain?', blurb: 'Universalism and tradition/conformity in one model, on the Dutch data. Find where it strains and decide — with a reason.', status: 'ready', task: 'd2-strain', minutes: 30 },
      { move: 'r', title: 'ML, MLR and WLSMV in lavaan', blurb: 'cfa with three estimators, lavResiduals, modificationindices, compareFit — in the script.', status: 'ready' },
      { move: 'check', title: 'Check it', blurb: 'A checklist for any CFA — your own or one an AI drafted — and three quick questions.', status: 'ready' },
    ],
    reading: { essential: ['Brown (2015), chapters 4 and 5 (pp. 88–185)'], additional: ['Hu & Bentler (1999)', 'West, Taylor & Wu (2012)', 'Jöreskog (1993)', 'Liu et al. (2017) on ordinal items treated as continuous', 'Davidov, Datler, Schmidt & Schwartz (2010)', 'Schmidt & Herrmann (2011)', 'Rhemtulla, Brosseau-Liard & Savalei (2012) on when to treat Likert items as ordinal'] },
    project: { title: 'Choose your estimator — and decide in advance which changes you would accept', noData: 'No data yet? Decide from the answer format your items will have.' },
  },
  {
    n: 3, week: 1, title: 'Restrictions and simultaneous CFA', subtitle: 'Equal loadings, several constructs, and fair comparisons of fit',
    theory: 'Equality constraints, restrictions and identification; simultaneous vs. separate CFA; cross-loadings and correlated errors; comparing fit measures and cut-offs.',
    practice: 'Tau-equivalent, parallel and strictly parallel models; a simultaneous CFA of tradition/conformity, universalism and attitudes toward immigration.',
    items: [
      { move: 'understand', title: 'Restrictions, identification and the simultaneous CFA', blurb: 'The restriction ladder for tradition/conformity and universalism, identification by hand, alpha and omega, and three constructs in one model — the course script, interactive.', status: 'ready', minutes: 240 },
      { move: 'try', title: 'Three constructs at once', blurb: 'Tradition/conformity, universalism and openness to immigration in one model: count df, read the factor correlations, decide between a cross-loading and an error covariance.', status: 'ready', task: 'd3-scfa', minutes: 30 },
      { move: 'r', title: 'Restrictions in lavaan', blurb: '1*, labels and NA*, compareFit with Satorra–Bentler, compRelSEM and := for omega, lavTestScore — in the script.', status: 'ready' },
      { move: 'check', title: 'Check it', blurb: 'Three questions on tau-equivalence, two-item factors and cross-loadings.', status: 'ready' },
    ],
    reading: { essential: ['Brown (2015), chapter 7, pp. 206–221 (equality constraints)'], additional: ['Davidov, Schmidt & Schwartz (2008)', 'Knoppen & Saris (2009)', 'Podsakoff et al. (2003) on method effects'] },
    project: { title: 'Draw the full measurement model of all your constructs and check df', noData: 'No data yet? The studio counts df without data.' },
  },
  {
    n: 4, week: 1, title: 'Two rulers', subtitle: 'Multi-group CFA and measurement invariance',
    theory: 'Multiple-group CFA; configural, metric and scalar invariance in cross-cultural research; classical and new fit measures; partial invariance and alignment.',
    practice: 'MGCFA across the Benelux countries, bottom-up and top-down; lavaan’s convenience functions; partial invariance.',
    items: [
      { move: 'understand', title: 'Measurement invariance, step by step', blurb: 'Tradition and conformity across the Benelux: baseline, configural, metric, scalar, partial — the course script, interactive.', status: 'ready', minutes: 210 },
      { move: 'understand', title: 'Two rulers', blurb: 'Bend one item in one country — then see on the Benelux data how the anchor items decide the comparison.', status: 'ready', station: 's11', minutes: 30 },
      { move: 'try', title: 'The ladder across the Benelux', blurb: 'Climb configural → metric → scalar, find the intercept that breaks it, release it with a reason — and see what the anchors do to the Dutch mean.', status: 'ready', task: 'd4-ladder', minutes: 35 },
      { move: 'r', title: 'group.equal and group.partial', blurb: 'The ladder in lavaan with MLR and FIML: compareFit, lavTestScore, parTable — in the script.', status: 'ready' },
      { move: 'check', title: 'Check it', blurb: 'Which comparisons does each rung allow — and what do you report?', status: 'ready' },
    ],
    reading: { essential: ['Brown (2015), chapter 7 (pp. 241–284)', 'Chen (2007)'], additional: ['Byrne, Shavelson & Muthén (1989)', 'Little, Slegers & Card (2006)', 'Asparouhov & Muthén (2014)', 'Sterner, De Roover & Goretzko (2025)'] },
    project: { title: 'Groups in your question? Plan the invariance test — or argue why it is not needed', noData: 'No data yet? Name the groups you will compare.' },
  },
  {
    n: 5, week: 1, title: 'Latent means and beyond one factor', subtitle: 'Comparing means; higher-order, bifactor and MTMM models',
    theory: 'Scalar invariance as the condition for comparing means; latent vs. observed means and the t-test; alignment for many groups; higher-order and bifactor models; how to report CFA results.',
    practice: 'CFA with latent means; consolidation of week 1. Optional: alignment and bifactor models.',
    items: [
      { move: 'understand', title: 'Latent means and beyond one factor', blurb: 'Latent means against mean scores, the modification cascade, alignment, second-order and bifactor models, MTMM, reporting — and the week-1 probe. The course script, interactive.', status: 'ready', minutes: 210 },
      { move: 'try', title: 'Traits and methods', blurb: 'Trust in three institutions, asked in three formats: find the method variance, model it, and see what it did to the trait correlations.', status: 'ready', task: 'd5-mtmm', minutes: 30 },
      { move: 'r', title: 'Latent means, alignment and special models in lavaan', blurb: 'std.lv and effect coding, sirt::invariance.alignment, second-order, bifactor and MTMM models — in the script.', status: 'ready' },
      { move: 'check', title: 'Week 1 in one page', blurb: 'Three questions on means, second-order factors and modification cascades — and the strategy for measurement models.', status: 'ready' },
    ],
    reading: { essential: ['Brown (2015), chapter 8 (higher-order models), pp. 200–202 (MTMM) and pp. 127–129 (reporting)', 'Asparouhov & Muthén (2014) on alignment'], additional: ['Campbell & Fiske (1959)', 'Little, Slegers & Card (2006)', 'Reise et al. (2017)', 'Rudnev et al. (2018)', 'Seddig et al. (2020)', 'Zercher et al. (2015)'] },
    project: { title: 'Will you compare means? Then check the scalar level', noData: 'No data yet? Decide whether your question needs mean comparisons.' },
  },
  {
    n: 6, week: 2, title: 'The full structural model', subtitle: 'Paths between latent variables',
    theory: 'Path analysis fundamentals; models with latent variables and multiple indicators: identification, specification, estimation, interpretation; model fit revisited; the two-step approach.',
    practice: 'Values and attitudes toward immigration with control variables, compared across the three countries.',
    items: [
      { move: 'understand', title: 'From measurement to structure', blurb: 'Paths make covariances: tracing rules, and why measurement comes first.', status: 'planned', minutes: 25 },
      { move: 'try', title: 'Values → attitudes toward immigration', blurb: 'The full SEM with age, gender and education; then the same in three countries.', status: 'planned', template: 'Full SEM: values → attitudes toward immigration' },
      { move: 'r', title: 'sem() and the two-step approach', blurb: 'Measurement model first, then the structure.', status: 'planned' },
      { move: 'check', title: 'Check it', blurb: 'Equivalent models and what fit cannot tell you.', status: 'planned' },
    ],
    reading: { essential: ['Kline (2023), chapters 7, 9 (pp. 131–147) and 15'], additional: ['Davidov et al. (2008b)', 'Saris et al. (2009)', 'Schmidt & Herrmann (2011)'] },
    project: { title: 'Draw the structural paths and the control variables', noData: 'No data yet? The studio counts df and writes the code without data.' },
  },
  {
    n: 7, week: 2, title: 'MIMIC, mediation and effects', subtitle: 'Decomposing an effect into its roads',
    theory: 'MIMIC and mediation models, decomposition of effects, bootstrapping indirect and total effects; structural after measurement (SAM).',
    practice: 'Full SEM with direct, indirect and total effects — Sobel test and bootstrap.',
    items: [
      { move: 'understand', title: 'Mediation', blurb: 'Direct, indirect, total — and why the product needs bootstrap intervals.', status: 'ready', station: 's13', minutes: 25 },
      { move: 'understand', title: 'Causes of a factor', blurb: 'MIMIC: covariates that point at a latent variable.', status: 'planned', mini: true, minutes: 10 },
      { move: 'try', title: 'Universalism → effects → allow', blurb: 'Decompose the effect, then argue the causal order.', status: 'planned', template: 'Mediation: universalism → effects → allow' },
      { move: 'r', title: ':= and the bootstrap', blurb: 'Defined parameters, percentile intervals, SAM.', status: 'planned' },
      { move: 'check', title: 'Check it', blurb: 'What mediation claims, and what it needs to be causal.', status: 'planned' },
    ],
    reading: { essential: ['Kline (2023), topic boxes 6.1, 7.1 and 8.1'], additional: ['Gonzalez et al. (2023)', 'Rosseel & Loh (2024)'] },
    project: { title: 'Indirect effects in your model? Write one sentence on the causal order', noData: 'No data yet? The order is an argument before it is a number.' },
  },
  {
    n: 8, week: 2, title: 'Moderation', subtitle: 'Multiple-group SEM and latent interactions',
    theory: 'Moderation with multiple-group SEM; latent interactions with product indicators, LMS and QML (modsem).',
    practice: 'Age as a moderator of the effect of values on attitudes toward immigration, with several approaches.',
    items: [
      { move: 'understand', title: 'Moderation', blurb: 'When an effect depends on a third variable: groups, products, and what the studio cannot estimate.', status: 'planned', minutes: 25 },
      { move: 'try', title: 'Age as a moderator', blurb: 'Multiple groups by age, then the latent interaction in modsem.', status: 'planned', template: 'Moderation by age group (multiple groups)' },
      { move: 'r', title: 'modsem: LMS and QML', blurb: 'The latent interaction in R.', status: 'planned' },
      { move: 'check', title: 'Check it', blurb: 'Groups or products — which question does each answer?', status: 'planned' },
    ],
    reading: { essential: ['Kline (2023), chapter 12'], additional: ['Kelava & Brandt (2023)', 'Rosseel et al. (2025)', 'Steinmetz, Davidov & Schmidt (2011)'] },
    project: { title: 'A moderator in your question? Yes or no — with a reason', noData: 'No data yet? Name the moderator you would test.' },
  },
  {
    n: 9, week: 2, title: 'Categories and time', subtitle: 'Categorical data and longitudinal SEM',
    theory: 'Categorical data in lavaan; the basic ideas of longitudinal SEM; CLPM vs. RI-CLPM — separating between- and within-person effects.',
    practice: 'Bringing the project together: the report and a short presentation.',
    items: [
      { move: 'understand', title: 'Data as they are (revisited)', blurb: 'Ordinal items, thresholds and WLSMV — station 2.4 in depth.', status: 'ready', station: 's9', mini: true, minutes: 10 },
      { move: 'understand', title: 'Within or between?', blurb: 'CLPM vs. RI-CLPM: which one finds the true within-person effect?', status: 'planned', mini: true, minutes: 10 },
      { move: 'try', title: 'A panel, two models', blurb: 'Fit the CLPM and the RI-CLPM on the simulated panel and compare the cross-lagged paths.', status: 'planned', template: 'Random-intercept CLPM (RI-CLPM)' },
      { move: 'r', title: 'ordered = and the RI-CLPM', blurb: 'Categorical estimation and panel models in R.', status: 'planned' },
    ],
    reading: { essential: ['Kline (2023), chapter 18', 'Edwards et al. (2012)', 'Usami et al. (2019)'], additional: ['Enders (2025)', 'Lucas (2023)'] },
    project: { title: 'Data type and missing values → the final estimator options', noData: 'No data yet? Plan for the data you will collect.' },
  },
  {
    n: 10, week: 2, title: 'Your model, reported', subtitle: 'The model, the estimates and every change, defended',
    theory: 'Bringing it together: the model, the estimates, every change and its reason — in a report and a short presentation that a reviewer can follow.',
    practice: 'Presenting the project: the model, the estimates, every change and its reason.',
    items: [
      { move: 'try', title: 'Your report', blurb: 'The studio writes a Quarto report with the drawing, the estimates, the R code and your logbook.', status: 'ready' },
      { move: 'check', title: 'Before you report', blurb: 'The checklist from Day 2, grown over ten days.', status: 'planned' },
    ],
    reading: { essential: [], additional: [] },
    project: { title: 'Export the report with your logbook', noData: 'No data yet? Report the model, the plan and the code.' },
  },
];

export const dayOf = (n: number) => DAYS.find(d => d.n === n) ?? null;

/** Stations numbered by course day: s7 → "2.1". The first day that lists a station owns its number. */
export const STATION_PLACE: Record<string, { day: number; label: string }> = (() => {
  const out: Record<string, { day: number; label: string }> = {};
  DAYS.forEach(d => {
    let k = 0;
    d.items.filter(i => i.move === 'understand').forEach(i => {
      k++;
      if (i.station && !out[i.station]) out[i.station] = { day: d.n, label: `${d.n}.${k}` };
    });
  });
  return out;
})();

/** The built stations in course order, for "previous / next". */
export const STATION_ORDER = Object.entries(STATION_PLACE).sort((a, b) => a[1].day - b[1].day || a[1].label.localeCompare(b[1].label, 'en', { numeric: true })).map(([id]) => id);

/** How much of a day is built. */
export function readiness(d: Day) {
  const ready = d.items.filter(i => i.status === 'ready').length;
  return { ready, total: d.items.length, state: ready === d.items.length ? 'ready' as const : ready ? 'partly' as const : 'planned' as const };
}
