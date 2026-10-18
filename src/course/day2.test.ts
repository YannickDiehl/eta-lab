// Day 2 as built: the task's story must hold on the ESS data, the logbook must see changes,
// and the task's strict checks must open and close as the learner works.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupsFor, type CourseData } from '../data/course.ts';
import { fitModel, type Fitted } from '../math/sem.ts';
import { analyse, fromLavaan, uid } from '../model/diagram.ts';
import { changes, edgeKey, logComments } from '../studio/logbook.ts';
import { currentStep, taskById, type TaskContext } from '../studio/tasks.ts';
import { DAYS, STATION_ORDER, STATION_PLACE, readiness } from './days.ts';
import { fitVerdict } from '../math/cutoffs.ts';

const data = JSON.parse(readFileSync(new URL('../../public/data/course-data.json', import.meta.url), 'utf8')) as CourseData;
const task = taskById('d2-strain')!;
const groups = groupsFor(data, task.data.round, task.data.sample, task.data.grouping);
const base = fromLavaan(task.syntax).diagram;
const baseFit = fitModel(base, { groups }) as Fitted;
const name = (id: string) => baseFit.names.get(id);

test('the Day 2 model is borderline on the Dutch data, as the R page says', () => {
  assert.equal(groups[0].n, 1690);
  assert.equal(baseFit.df, 13);
  assert.ok(Math.abs(baseFit.chisq - 103.94) < 0.01, `χ² ${baseFit.chisq}`);
  assert.ok(Math.abs(baseFit.cfi - 0.950) < 0.0005);
  assert.ok(Math.abs(baseFit.rmsea - 0.064) < 0.0005);
  assert.equal(fitVerdict(baseFit), 'fair');
  const top = baseFit.mi[0];
  assert.equal(top.op, '~~');
  assert.deepEqual([name(top.lhs), name(top.rhs)].sort(), ['impenv', 'imptrad']);
});

function ctx(d = base, answers: Record<string, string> = {}, reasons: Record<string, string> = {}, snapshots = 0): TaskContext {
  const fit = fitModel(d, { groups }) as Fitted;
  return { a: analyse(d), d, base, fit, baseFit, changes: changes(d, base, reasons), reasons, answers, snapshots, label: n => n };
}

test('the task walks forward only when its strict checks pass', () => {
  assert.equal(currentStep(task, ctx()), 0);                                   // the guess first
  assert.equal(currentStep(task, ctx(base, { predict: '1' })), 1);
  assert.equal(currentStep(task, ctx(base, { predict: '1', judge: '1' })), 2);
  assert.equal(currentStep(task, ctx(base, { predict: '1', judge: '1', find: '1' })), 3);   // decide: no reason yet
  // add the residual covariance the index points to
  const env = base.nodes.find(n => n.label === 'impenv')!, trad = base.nodes.find(n => n.label === 'imptrad')!;
  const edge = { id: uid('e'), kind: 'cov' as const, from: env.id, to: trad.id };
  const d = { ...base, edges: [...base.edges, edge] };
  const a = { predict: '1', judge: '1', find: '1' };
  assert.equal(currentStep(task, ctx(d, a)), 3);
  const key = edgeKey(d, edge);
  const c = ctx(d, a, { [key]: 'Both items ask about preserving what is given: nature and tradition.' });
  assert.equal(c.changes.length, 1);
  assert.match(c.changes[0].code, /impenv ~~ imptrad|imptrad ~~ impenv/);
  assert.equal(currentStep(task, c), 4);                                       // compare
  assert.equal(currentStep(task, ctx(d, a, { [key]: 'Both items ask about preserving what is given.' }, 1)), 5);
  assert.equal(currentStep(task, ctx(d, { ...a, r: 'done' }, { [key]: 'Both items ask about preserving what is given.' }, 1)), task.steps.length);
  assert.match(logComments(c.changes, c.reasons), /# changes against the example model[\s\S]*nature and tradition/);
  // keeping the model is valid too — with a reason
  assert.equal(currentStep(task, ctx(base, { ...a, keep: 'No shared wording; the index alone is not a reason.' })), 4);
});

test('the course map: Day 0 and ten course days, Day 2 complete, stations numbered by day', () => {
  assert.equal(DAYS.length, 11);
  assert.equal(DAYS[0].n, 0);
  assert.equal(readiness(DAYS.find(d => d.n === 2)!).state, 'ready');
  assert.equal(STATION_PLACE.s7.label, '2.2');
  assert.equal(STATION_PLACE.s9.label, '2.4');
  assert.equal(STATION_PLACE.s4.label, '1.2');
  assert.equal(STATION_PLACE.s11.label, '4.2');
  assert.deepEqual(STATION_ORDER.slice(0, 6), ['s4', 's5', 's6', 's7', 's8', 's9']);
  DAYS.flatMap(d => d.items).filter(i => i.task).forEach(i => assert.ok(taskById(i.task), String(i.task)));
});
