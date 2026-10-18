// Day 3 as built: the script's numbers are lavaan's, the studio task's model gives on the course
// data what the R page says, and the task walks forward only when its checks pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupsFor, type CourseData } from '../data/course.ts';
import { fitModel, type Fitted } from '../math/sem.ts';
import { analyse, fromLavaan } from '../model/diagram.ts';
import { changes } from '../studio/logbook.ts';
import { currentStep, taskById, type TaskContext } from '../studio/tasks.ts';
import type { Day3 } from './day3/data.ts';
import { DAYS, readiness } from './days.ts';

const d3 = JSON.parse(readFileSync(new URL('../../public/data/day3.json', import.meta.url), 'utf8')) as Day3;
const data = JSON.parse(readFileSync(new URL('../../public/data/course-data.json', import.meta.url), 'utf8')) as CourseData;
const task = taskById('d3-scfa')!;
const groups = groupsFor(data, task.data.round, task.data.sample, task.data.grouping);
const base = fromLavaan(task.syntax).diagram;
const baseFit = fitModel(base, { groups }) as Fitted;

test('the restriction ladder reproduces the course solutions (Mplus 2022, MLR)', () => {
  const chi = (L: Day3['trco'] | Day3['univ']) => ['congeneric', 'tau', 'parallel', 'strict'].map(l => L.fits[l as 'tau']['chisq.scaled']);
  chi(d3.trco).forEach((v, i) => assert.ok(Math.abs(v - [2.387, 28.694, 138.143, 434.845][i]) < 0.01, `TRCO ${i}: ${v}`));
  chi(d3.univ).forEach((v, i) => assert.ok(Math.abs(v - [0, 0.639, 1.924, 103.256][i]) < 0.01, `UNIV ${i}: ${v}`));
  assert.deepEqual(['congeneric', 'tau', 'parallel', 'strict'].map(l => d3.trco.fits[l as 'tau'].df), [2, 5, 8, 11]);
  assert.ok(d3.trco.tau2_same, 'the two ways of writing tau-equivalence give the same χ²');
  d3.by_hand.lambda.forEach((l, i) => assert.ok(Math.abs(l - d3.by_hand.lavaan[i]) < 1e-3, 'identification by hand = lavaan'));
});

test('the studio task model fits as the Day 3 page says', () => {
  assert.equal(groups[0].n, d3.studio.n);
  assert.equal(baseFit.df, d3.studio.fit.df);
  assert.ok(Math.abs(baseFit.chisq - d3.studio.fit.chisq) < 0.05, `χ² ${baseFit.chisq} vs ${d3.studio.fit.chisq}`);
  assert.ok(Math.abs(baseFit.cfi - d3.studio.fit.cfi) < 0.001);
  const name = (id: string) => baseFit.names.get(id);
  assert.deepEqual([name(baseFit.mi[0].lhs), name(baseFit.mi[0].rhs)].sort(), ['impenv', 'imptrad']);
});

function ctx(answers: Record<string, string> = {}, reasons: Record<string, string> = {}, snapshots = 0): TaskContext {
  return { a: analyse(base), d: base, base, fit: baseFit, baseFit, changes: changes(base, base, reasons), reasons, answers, snapshots, label: n => n };
}

test('the Day 3 task walks forward, and keeping the model needs a reason', () => {
  assert.equal(currentStep(task, ctx()), 0);
  const a = { predict: '1', judge: '1', relate: '0', find: '1', predict2: '1' };
  const at = (id: string) => task.steps.findIndex(x => x.id === id);
  assert.equal(currentStep(task, ctx(a)), at('decide'));
  assert.equal(currentStep(task, ctx({ ...a, keep: 'No shared wording; one index is not a reason.' })), at('r'));   // keeping both versions is optional now
  assert.equal(currentStep(task, ctx({ ...a, keep: 'No shared wording; one index is not a reason.', r: 'done' })), task.steps.length);
  const relate = task.steps.find(s => s.id === 'relate')!.choice!(ctx())!;
  assert.match(relate.explain(ctx(), 0), /TRCO–UNIV \.\d\d, UNIV–ALLOW \.\d\d, TRCO–ALLOW −\.\d\d/);
});

test('days 1 to 4 are complete', () => {
  for (const n of [1, 2, 3, 4]) {
    const day = DAYS.find(x => x.n === n)!;
    assert.equal(readiness(day).state, 'ready', `day ${n}`);
  }
});

test('η Lab works without the course: no live-session items in the days', () => {
  for (const d of DAYS) assert.ok(!d.items.some(i => (i.move as string) === 'live'), `day ${d.n}`);
});
