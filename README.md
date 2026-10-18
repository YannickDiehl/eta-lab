# η Lab — a sandbox for structural equation modeling

Interactive learning path and reference work for structural equation modeling with R and lavaan.
It grew out of the SEM course of the Essex Summer School, but works on its own: it holds no
timetable and no live-session logic — a course that uses it (e.g. `../live-sessions/`) links into it.
Every concept is a
small station with the same rhythm: **Wonder** (a question) → **Play** (a sandbox) → **η explains**
→ **The formula** (with the learner's own numbers) → **Your model** (applied to the learner's own
research model, which travels with them through all stations).

The app is organised as a learning path: a start page (`#/start`) with the ten days, and one page per day
(`#/day/N`) that plays four moves — **Understand** (stations), **Try it** (a task card in the
studio), **Your project** (one step in the learner's own model) and **In R** (the same model in
lavaan, with the numbers to expect) — plus a self-check and the reading. Stations are numbered by
day (2.1, 2.2, …).

Built so far: **Day 0** (self-study before the course: setup with a check number R must print, the ESS data with two check numbers, the course's R idioms, variance/covariance/correlation and the covariance matrix as all a CFA sees, Schwartz's values, a first project question, a self-test, and common setup problems); **Day 1 as an interactive script** — the course's eight-step CFA procedure (Lugano 2025 / Essex 2023 scripts, text kept close, errors corrected) with every figure made interactive, the course's own R code (tidyverse, sjlabelled/sjmisc, easystats, MVN, lavaan with MLR and FIML, semPlot/semptools) and the R outputs from `scripts/day1-outputs.R` (`public/data/day1.json`, aggregates and model output only); **Day 2 and Day 4 completely** (Day 4 from the earlier courses' material: the
Benelux ladder task with releases in the logbook, the R hand-off after the Lugano 2025 code
documentation — corrected and checked in R —, reference cards, and “Share my decision” for the studio task). Day 2:  (stations 2.1–2.3, the task “Where does the two-factor model
strain?” on the Dutch ESS 2004 data, the project step, the R hand-off checked against lavaan, the
check). Further stations: 1.2–1.4 (Day 1), 4.1 (invariance), 7.1 (mediation). Everything else is a
visible placeholder marked “coming”, often with the course model already loadable in the studio.

## Run locally

```bash
npm install
npm run dev     # http://127.0.0.1:5180
npm test        # engine vs. lavaan reference values
npm run build   # static site in dist/
```

## How it computes

- `src/math/` — a small CFA engine: implied covariance matrix, ML and ULS discrepancy, BFGS
  optimisation, standard errors from the Hessian, χ², RMSEA, CFI, TLI, SRMR.
- `src/math/cfa.test.ts` — reproduces lavaan for four ESS datasets (loadings, SEs, residual
  variances, all fit indices, ULS, a freed residual covariance).
- `scripts/reference.R` — builds `src/data/datasets.json` (correlation matrices only) and
  `src/math/reference.json` from the local ESS files. Microdata never enter the repository.
- `src/math/sem.ts` — the studio's general SEM estimator (ML, RAM form, one or several groups,
  mean structure, the invariance ladder with partial invariance, equality labels, fixed values,
  std.lv, expected-information SEs, χ², CFI, TLI, RMSEA, SRMR, std.all, R², log-likelihood, AIC,
  BIC, modification indices with EPC, residual correlations, direct/indirect/total effects with
  delta-method SEs). `src/math/sem.test.ts` checks twenty-five course models against lavaan
  (`scripts/sem-reference.R`), including mediation, bifactor, MTMM, CLPM and RI-CLPM.
- `src/studio/templates.ts` — the course models day by day; latent interactions are written as
  modsem code (the studio estimates the model without the product term).
- `scripts/course-data.R` — writes `public/data/course-data.json`: means and covariance
  matrices (complete cases) of the course variables for ESS 2004 (Benelux) and ESS 2023
  (BE, DE, FR, GB, NL), per country, pooled, and by gender and age group. Aggregates only.
  It also simulates two teaching datasets the ESS cannot provide: a four-wave panel (stable
  between-person differences plus a within-person effect of x on y) and a 3 × 3 MTMM design.
- `scripts/random-models.ts` + `scripts/crosscheck.R` — thousands of random drawings (also with
  groups and partial invariance) whose df and parameters must match lavaan's.
- `scripts/rcode-models.ts` + `scripts/rcode-check.R` — the R code the studio writes for the
  course models under every estimator choice (ML, MLR, WLSMV × listwise, FIML; one group, the
  ladder, partial invariance) is run in R on the ESS 2004 microdata, missing values included.

## The studio (`#/model`)

`src/studio/` — a full-window builder: draw (rail, dots, Tab for the next item), choose data
(course data or a CSV that stays in the browser), and see estimates on the drawing, fit in the
badge, the invariance ladder on real groups, and lavaan code that updates as you draw.
Estimation runs in a web worker (`estimate.worker.ts`).

- **Estimator in R** (lavaan tab): ML, MLR or WLSMV, listwise or FIML. The studio always estimates
  with ML on complete cases; the R code carries the choice — robust fit measures for MLR,
  `ordered =` for the factor items under WLSMV, and an ordinal invariance ladder through
  `semTools::measEq.syntax` (Wu & Estabrook, 2016: thresholds take the place of intercepts).
  With FIML and covariates, `fixed.x = FALSE` keeps cases with a missing covariate.
- **Share** (`share.ts`): *Copy link* compresses the model (drawing, question, groups, course data,
  R options) into the URL hash, `#/model?m=…`; nothing goes to a server, and own CSV files never
  travel with it. *Save file* / *Open file…* do the same with a small `.eta.json`. Opening one keeps
  the previous model one click away (“Back to my model”).
- **Report** (`report.ts`): *Report .qmd* writes a Quarto document with the research question, the
  drawing (embedded PNG), η Lab's fit, estimates, R², effects and invariance ladder, and the R code.
  Its R chunks run only when `my_data.csv` lies next to it, so it renders with or without data.

## Structure

- `src/course/` — the course: `days.ts` (ten days, their items, readiness, station numbering),
  `Home.tsx`, `DayPage.tsx`, `day2.tsx` (Day 2's project step, R hand-off and check).
- `src/stations/` — one file per station; `registry.ts` lists the built ones.
- `src/studio/tasks.ts` + `TaskCard.tsx` — task cards over the studio: strict checks for mechanics
  only, reasons for decisions, a guess before the numbers. `logbook.ts` — every change against the
  course model (or added from a modification index) with its reason, carried into the lavaan code,
  the share link and the Quarto report.
- `src/math/cutoffs.ts` — the one source for fit rules of thumb.
- `src/course/day0/` — Day 0: `Day0Script.tsx`, `widgets.tsx`.
- `src/course/day1/` — the Day 1 script: `Day1Script.tsx` (text and code), `figures1.tsx` / `figures2.tsx` (classic test theory, formal model, reflective/formative, scaling, item distributions, identification, annotated lavaan output, fit, misspecification, mean structure).
- `src/course/cards.tsx` — reference cards (`#/cards`, `#/cards/N`, printable).
- `src/course/Compare.tsx` — “Share my decision” and the tool `#/compare?task=…`: it decodes pasted
  share links, refits every model and sets the decisions side by side (for a study group, a seminar,
  or a course that uses η Lab).
- `docs/` — the learning-path concept, the inventory of all earlier course materials
  (`docs/inventar/`) and how they are integrated (`bestand-und-integration.md`).
- `src/components/ui.tsx` — the shared rhythm (Beat, Choose, Predict, Explain, Formula, Yours).
- `src/eta/Eta.tsx` — the course character η.
- `src/state.ts` — two workspaces, stored only in the browser: *My project* (the learner's own
  model, read by the stations) and *Exercises* (example models and tasks), plus the answers to
  the daily project steps.

Deployment: pushing to `main` runs `.github/workflows/pages.yml` (test, build, publish to GitHub Pages).
