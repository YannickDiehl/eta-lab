// Writes the R code the studio generates for the course models under every estimator choice
// (ML, MLR, WLSMV × listwise, FIML), one group and the invariance ladder. scripts/rcode-check.R
// runs each piece in R on the ESS 2004 Benelux microdata (with their missing values).
//
//   node --import tsx scripts/rcode-models.ts > /tmp/rcode.json
//   Rscript scripts/rcode-check.R /tmp/rcode.json
import { modelString, structure, toLavaan, type ROptions } from '../src/model/diagram.ts';
import { ladderSyntax, locks, NO_GROUPS, type Level } from '../src/model/invariance.ts';
import { TEMPLATES, templateDiagram } from '../src/studio/templates.ts';

const OPTIONS: ROptions[] = [];
for (const estimator of ['ML', 'MLR', 'WLSMV'] as const) for (const missing of ['listwise', 'fiml'] as const) OPTIONS.push({ estimator, missing });
const out: { name: string; code: string }[] = [];
for (const t of TEMPLATES) {
  if (t.round && t.round !== 'ess2004') continue;             // simulated data live only as aggregates
  if (t.syntax.includes(':')) continue;                        // modsem: checked elsewhere
  const d = templateDiagram(t);
  for (const r of OPTIONS) {
    const tag = `${r.estimator}/${r.missing}`;
    out.push({ name: `${t.title} · ${tag}`, code: toLavaan(d, { r }) });
    if (t.day === 'Day 1' || t.day === 'Day 4' || t.title.startsWith('Two factors')) {
      const level: Level = 'strict';
      const g = { ...NO_GROUPS, on: true, variable: 'cntry', names: ['BE', 'LU', 'NL'], level, free: [] };
      out.push({ name: `${t.title} · ladder · ${tag}`, code: `${modelString(d)}\n\n${ladderSyntax(d, g, r)}` });
      // partial invariance: one released equality of each kind
      const lk = locks(structure(d)), free = (['loading', 'intercept', 'residual'] as const).map(k => lk.filter(l => l.kind === k).at(-1)!.key);
      out.push({ name: `${t.title} · partial · ${tag}`, code: `${modelString(d)}\n\n${ladderSyntax(d, { ...g, free }, r)}` });
    }
  }
}
console.log(JSON.stringify(out));
