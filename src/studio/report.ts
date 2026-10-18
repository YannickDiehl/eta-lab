// A Quarto report of the model: the research question, the drawing, the numbers η Lab
// estimated, and the R code that reproduces them. The R chunks run only when the data file
// named in the header lies next to the report — without it, the report still renders
// (with η Lab's numbers), so it can be handed in or shared as it is.
import { analyse, type Diagram, type ROptions } from '../model/diagram.ts';
import { LEVELS } from '../model/invariance.ts';
import type { EstParam, Fitted, FitError } from '../math/sem.ts';
import { chisqP } from '../math/stats.ts';
import { CUTOFF_TEXT } from '../math/cutoffs.ts';

export interface ReportInput {
  question: string;
  diagram: Diagram;
  r: ROptions;
  /** The R code exactly as the lavaan tab shows it. */
  syntax: string;
  /** Where the studio's numbers come from, e.g. "ESS 2004 · Benelux pooled". */
  data?: { label: string; own: boolean };
  est?: { main: Fitted; rungs: (Fitted | FitError)[] | null; groups: string[]; level: string };
  /** The drawing as a data URL (PNG). */
  image?: string;
  /** The logbook: every change and its reason. */
  log?: { sign: string; text: string; code: string; reason: string }[];
  /** Decisions written down before looking at the results (the project steps). */
  plan?: { label: string; text: string }[];
  date?: string;
}

const n3 = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : '–');
const n2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '–');
const p3 = (p: number) => (!Number.isFinite(p) ? '–' : p < .001 ? '< .001' : p.toFixed(3));
const yaml = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const md = (s: string) => s.replace(/([|*_`<>[\]])/g, '\\$1');
const table = (head: string[], rows: string[][], align?: string) => {
  const al = align ?? head.map((_, i) => (i === 0 ? 'l' : 'r')).join('');
  return [`| ${head.join(' | ')} |`, `|${[...al].map(a => (a === 'l' ? ':---' : '---:')).join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');
};

const ESTIMATOR_TEXT: Record<ROptions['estimator'], string> = {
  ML: 'maximum likelihood (ML)',
  MLR: 'maximum likelihood with robust (Huber–White) standard errors and a Yuan–Bentler scaled χ² (MLR)',
  WLSMV: 'diagonally weighted least squares with robust standard errors and a mean- and variance-adjusted χ² (WLSMV), treating the items as ordinal',
};

export function quartoReport(i: ReportInput): string {
  const d = i.diagram, a = analyse(d), s = a.s;
  const L = (id: string) => d.nodes.find(n => n.id === id)?.label ?? id;
  const title = i.question.trim() || 'My structural equation model';
  const out: string[] = [];
  const grouped = !!i.est && i.est.main.G > 1;
  const ordinalLadder = i.r.estimator === 'WLSMV' && /measEq\.syntax/.test(i.syntax);

  out.push('---', `title: ${yaml(title)}`, 'subtitle: "A structural equation model drawn and pre-estimated in η Lab"', `date: ${i.date ? yaml(i.date) : 'today'}`,
    'format:', '  html:', '    toc: true', '    embed-resources: true', '    df-print: kable',
    'params:', '  data: "my_data.csv"   # your data file, next to this report',
    'execute:', '  echo: true', '  warning: false', '---', '');

  // ---- question and model
  out.push('## Research question', '', i.question.trim() ? md(i.question.trim()) : '*Write your research question here.*', '');
  out.push('## The model', '');
  if (i.image) out.push(`![The model as drawn in η Lab${i.est ? ' (standardized estimates)' : ''}](${i.image}){fig-align="center" width="100%"}`, '');
  const nLat = s.latent.length, nObs = s.observed.length;
  const parts = [
    nLat ? `${nLat} latent variable${nLat === 1 ? '' : 's'}` : '', `${nObs} observed variable${nObs === 1 ? '' : 's'}`,
    s.reg.length ? `${s.reg.length} regression path${s.reg.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  out.push(`The model has ${parts.join(', ')}. The ${a.p} observed variables provide ${a.knowns} ${a.knowns > a.p * (a.p + 1) / 2 ? 'variances, covariances and means' : 'variances and covariances'}; `
    + `the model estimates ${a.q} parameters, which leaves **df = ${a.knowns} − ${a.q} = ${a.df}**`
    + `${a.df > 0 ? ' degrees of freedom to test it.' : a.df === 0 ? ': the model is just identified and its fit cannot be tested.' : ': the model is not identified.'}`, '');
  const warns = a.notes.filter(n => n.level === 'warn');
  if (warns.length) out.push('::: {.callout-warning title="η noticed"}', ...warns.map(n => `- ${md(n.text)}`), ':::', '');

  // ---- η Lab's numbers
  if (i.est) {
    const m = i.est.main, G = m.G;
    out.push('## Estimates from η Lab', '');
    out.push(`Data: ${md(i.data?.label ?? 'the data chosen in η Lab')}, complete cases (N = ${m.N.toLocaleString('en')}${G > 1 ? `, ${G} groups: ${i.est.groups.map(md).join(', ')}` : ''}). `
      + `Estimator: ML, standard errors from the expected information — lavaan’s defaults for \`sem()\`.`
      + (i.r.estimator !== 'ML' || i.r.missing === 'fiml' ? ' The R code below uses the options chosen for the final analysis (see *Estimation*), so its numbers can differ slightly.' : ''), '');
    out.push('### Model fit', '');
    out.push(table(['χ²', 'df', 'p', 'CFI', 'TLI', 'RMSEA', 'SRMR', 'AIC', 'BIC'],
      [[n2(m.chisq), String(m.df), p3(m.pvalue), n3(m.cfi), n3(m.tli), n3(m.rmsea), n3(m.srmr), n2(m.aic), n2(m.bic)]], 'rrrrrrrrr'), '');
    out.push(`: Fit of the model. Rules of thumb (Hu & Bentler, 1999) — ${CUTOFF_TEXT}.`, '');
    if (!m.converged) out.push('::: {.callout-important}', 'The estimation did not fully converge — treat the numbers with care.', ':::', '');
    if (m.heywood.length) out.push('::: {.callout-important}', `Negative variance (Heywood case) for ${m.heywood.map(L).map(md).join(', ')}.`, ':::', '');

    if (i.est.rungs) {
      out.push('### Measurement invariance', '');
      const rows = i.est.rungs.map((r, k) => {
        const name = LEVELS[k][0].toUpperCase() + LEVELS[k].slice(1);
        if (!r.ok) return [name, '–', '–', '–', '–', '–', '–'];
        const prev = k > 0 ? i.est!.rungs![k - 1] : null;
        const ok = prev?.ok;
        const dch = ok ? r.chisq - (prev as Fitted).chisq : NaN, ddf = ok ? r.df - (prev as Fitted).df : NaN;
        return [name, n2(r.chisq), String(r.df), n3(r.cfi), n3(r.rmsea),
          ok ? `${n2(dch)} (${ddf}), p ${p3(chisqP(dch, ddf))}` : '–', ok ? n3(r.cfi - (prev as Fitted).cfi) : '–'];
      });
      out.push(table(['Level', 'χ²', 'df', 'CFI', 'RMSEA', 'Δχ² (Δdf)', 'ΔCFI'], rows), '');
      out.push(`: The invariance ladder across ${i.est.groups.map(md).join(', ')}. A drop in CFI of more than .01 signals that the added equalities do not hold (Cheung & Rensvold, 2002). The model above is estimated at the ${i.est.level} level.`, '');
    }

    const SECTIONS: [string, (q: EstParam) => boolean][] = [
      ['Loadings', q => q.op === '=~'], ['Regressions', q => q.op === '~'], ['Covariances', q => q.op === '~~' && q.lhs !== q.rhs],
      ['Variances', q => q.op === '~~' && q.lhs === q.rhs], ['Intercepts and means', q => q.op === '~1'],
    ];
    const rel = (q: EstParam) => q.op === '=~' ? `${L(q.lhs)} → ${L(q.rhs)}` : q.op === '~' ? `${L(q.rhs)} → ${L(q.lhs)}`
      : q.op === '~1' ? L(q.lhs) : q.lhs === q.rhs ? L(q.lhs) : `${L(q.lhs)} ↔ ${L(q.rhs)}`;
    out.push('### Parameter estimates', '');
    for (let g = 0; g < G; g++) {
      if (G > 1) out.push(`#### ${md(i.est.groups[g] ?? `Group ${g + 1}`)}`, '');
      const rows: string[][] = [];
      SECTIONS.forEach(([name, f]) => {
        const sec = m.params.filter(q => q.group === g && f(q));
        if (!sec.length) return;
        rows.push([`**${name}**`, '', '', '', '']);
        sec.forEach(q => rows.push([md(rel(q)) + (q.equal ? ' (=)' : ''), n3(q.est), q.free ? n3(q.se) : 'fixed', q.free ? p3(q.p) : '', q.op === '~1' ? '' : n3(q.std)]));
      });
      out.push(table(['Parameter', 'Estimate', 'SE', 'p', 'Std.'], rows), '');
      const r2 = Object.entries(m.r2[g] ?? {});
      if (r2.length) out.push(table(['Explained variance', 'R²'], r2.map(([id, v]) => [md(L(id)), n3(v)])), '');
    }
    if (G > 1) out.push('(=) held equal across groups.', '');

    if (m.effects.length) {
      out.push('### Direct, indirect and total effects', '');
      for (let g = 0; g < G; g++) {
        const sets = m.effects.filter(e => e.group === g);
        if (!sets.length) continue;
        if (G > 1) out.push(`#### ${md(i.est.groups[g] ?? `Group ${g + 1}`)}`, '');
        const rows: string[][] = [];
        sets.forEach(e => {
          rows.push([`**${md(L(e.from))} → ${md(L(e.to))}**`, '', '', '', '']);
          const row = (name: string, x: { est: number; se: number; p: number; std: number }) => rows.push([name, n3(x.est), n3(x.se), p3(x.p), n3(x.std)]);
          if (e.direct) row('Direct', e.direct);
          e.specific.forEach(sp => row(`via ${sp.path.slice(1, -1).map(L).map(md).join(' → ')}`, sp));
          if (e.specific.length > 1) row('Indirect, all paths', e.indirect);
          row('Total', e.total);
        });
        out.push(table(['Effect', 'Estimate', 'SE', 'p', 'Std.'], rows), '');
      }
      out.push(': Indirect effects are products of paths, with delta-method (Sobel) standard errors. Report the bootstrap intervals from the R code below.', '');
    }
  }

  // ---- decisions and changes, with their reasons
  if (i.plan?.length) {
    out.push('## Decided in advance', '');
    i.plan.forEach(p => out.push(`**${md(p.label)}** ${md(p.text)}`, ''));
  }
  if (i.log?.length) {
    out.push('## Changes and reasons', '');
    out.push(table(['Change', 'lavaan', 'Reason'], i.log.map(l => [`${l.sign} ${md(l.text)}`, `\`${l.code}\``, l.reason.trim() ? md(l.reason.trim()) : '*no reason written*']), 'lll'), '');
    out.push(': Every change against the example model or added from a modification index, with the reason recorded in η Lab.', '');
  }

  // ---- R
  out.push('## Estimation', '');
  out.push(`The final analysis uses ${ESTIMATOR_TEXT[i.r.estimator]}`
    + (i.r.missing === 'fiml' ? (i.r.estimator === 'WLSMV' ? ', with pairwise deletion of missing values' : ', with full information maximum likelihood (FIML) for missing values') : ', with listwise deletion of incomplete cases')
    + ` in the R package lavaan (Rosseel, 2012)${ordinalLadder ? ' and semTools, identifying the ordinal invariance models as Wu & Estabrook (2016) propose' : ''}.`, '');
  out.push('::: {.callout-note}', `The chunks below run when the data file \`my_data.csv\` lies next to this report (change \`params: data\` in the header for another file). Without it, the report shows η Lab’s numbers only.${i.data && !i.data.own ? ' The ESS data come from the European Social Survey; η Lab only holds their correlations, so use your own copy of the ESS file.' : ''}`, ':::', '');
  out.push('```{r}', '#| label: data', '#| eval: !expr file.exists(params$data)', 'library(lavaan)', 'my_data <- read.csv(params$data)', '```', '');
  out.push('```{r}', '#| label: model', '#| eval: !expr file.exists(params$data)', i.syntax.trim(), '```', '');

  // ---- references
  out.push('## References', '');
  const refs = [
    'Rosseel, Y. (2012). lavaan: An R package for structural equation modeling. *Journal of Statistical Software, 48*(2), 1–36. https://doi.org/10.18637/jss.v048.i02',
    'Hu, L., & Bentler, P. M. (1999). Cutoff criteria for fit indexes in covariance structure analysis. *Structural Equation Modeling, 6*(1), 1–55. https://doi.org/10.1080/10705519909540118',
  ];
  if (grouped || /group.equal/.test(i.syntax)) refs.push('Cheung, G. W., & Rensvold, R. B. (2002). Evaluating goodness-of-fit indexes for testing measurement invariance. *Structural Equation Modeling, 9*(2), 233–255. https://doi.org/10.1207/S15328007SEM0902_5');
  if (ordinalLadder) refs.push('Wu, H., & Estabrook, R. (2016). Identification of confirmatory factor analysis models of different levels of invariance for ordered categorical outcomes. *Psychometrika, 81*(4), 1014–1045. https://doi.org/10.1007/s11336-016-9506-0');
  if (/modsem/.test(i.syntax)) refs.push('Slupphaug, K. S., Mehmetoglu, M., & Mittner, M. (2025). modsem: An R package for estimating latent interactions and quadratic effects. *Structural Equation Modeling, 32*(4), 717–729. https://doi.org/10.1080/10705511.2024.2417409');
  out.push(...refs.sort().map(r => `- ${r}`), '');
  out.push('---', '', '*Drawn in η Lab — a sandbox for structural equation modeling. η Lab’s estimates are checked against lavaan.*', '');
  return out.join('\n');
}
