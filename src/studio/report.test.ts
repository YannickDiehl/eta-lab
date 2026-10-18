import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { quartoReport } from './report.ts';
import { TEMPLATES, templateDiagram } from './templates.ts';
import { groupsFor, type CourseData } from '../data/course.ts';
import { fitModel, type Fitted } from '../math/sem.ts';
import { modelString, toLavaan } from '../model/diagram.ts';
import { ladderSyntax, LEVELS, NO_GROUPS } from '../model/invariance.ts';

const data = JSON.parse(readFileSync(new URL('../../public/data/course-data.json', import.meta.url), 'utf8')) as CourseData;

test('the report carries question, fit, estimates, effects and runnable R code', () => {
  const d = templateDiagram(TEMPLATES.find(t => t.title.startsWith('Mediation'))!);
  const groups = groupsFor(data, 'ess2004', 'pooled', 'none');
  const main = fitModel(d, { groups }) as Fitted;
  const r = { estimator: 'MLR', missing: 'fiml' } as const;
  const q = quartoReport({ question: 'Why "open" doors?', diagram: d, r, syntax: toLavaan(d, { r }), data: { label: 'ESS 2004', own: false }, est: { main, rungs: null, groups: ['all'], level: 'configural' } });
  assert.match(q, /^---\ntitle: "Why \\"open\\" doors\?"/);
  assert.match(q, /\*\*df = 55 − 24 = 31\*\*/);
  assert.match(q, /\| 346\.44 \| 31 \|/);
  assert.match(q, /### Direct, indirect and total effects/);
  assert.match(q, /```\{r\}\n#\| label: model\n#\| eval: !expr file.exists\(params\$data\)\nmodel <- "/);
  assert.match(q, /estimator = "MLR", missing = "fiml", fixed.x = FALSE/);
  assert.doesNotMatch(q, /NaN|undefined|\[object/);
});

test('with groups the report shows the invariance ladder, per-group estimates and the Wu & Estabrook route', () => {
  const d = templateDiagram(TEMPLATES.find(t => t.day === 'Day 4')!);
  const groups = groupsFor(data, 'ess2004', 'pooled', 'country');
  const rungs = LEVELS.map(level => fitModel(d, { groups, level }));
  const r = { estimator: 'WLSMV', missing: 'listwise' } as const;
  const g = { ...NO_GROUPS, on: true, variable: 'cntry', names: groups.map(x => x.label), level: 'scalar' as const, free: [] };
  const q = quartoReport({ question: '', diagram: d, r, syntax: `${modelString(d)}\n\n${ladderSyntax(d, g, r)}`, est: { main: rungs[2] as Fitted, rungs, groups: groups.map(x => x.label), level: 'scalar' } });
  assert.match(q, /title: "My structural equation model"/);
  assert.match(q, /### Measurement invariance/);
  assert.equal((q.match(/^#### /gm) ?? []).length, 3);
  assert.match(q, /Wu, H\., & Estabrook/);
  assert.match(q, /measEq\.syntax/);
  assert.doesNotMatch(q, /NaN|undefined/);
});
