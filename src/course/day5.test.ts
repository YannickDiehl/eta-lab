// Day 5 as built: the studio's MTMM data are the R script's (same population and seed), the task
// walks forward, and week 1 is complete.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupsFor, type CourseData } from '../data/course.ts';
import { fitModel, type Fitted } from '../math/sem.ts';
import { analyse, fromLavaan } from '../model/diagram.ts';
import { changes } from '../studio/logbook.ts';
import { currentStep, taskById, type TaskContext } from '../studio/tasks.ts';
import type { Day5 } from './day5/data.ts';
import { DAYS, readiness } from './days.ts';

const d5 = JSON.parse(readFileSync(new URL('../../public/data/day5.json', import.meta.url), 'utf8')) as Day5;
const data = JSON.parse(readFileSync(new URL('../../public/data/course-data.json', import.meta.url), 'utf8')) as CourseData;
const task = taskById('d5-mtmm')!;
const groups = groupsFor(data, task.data.round, task.data.sample, task.data.grouping);
const base = fromLavaan(task.syntax).diagram;
const baseFit = fitModel(base, { groups }) as Fitted;

test('the studio fits the trait-only MTMM model as lavaan does in the Day 5 script', () => {
  assert.equal(groups[0].n, 1000);
  assert.equal(baseFit.df, d5.mtmm.fits.traits.df);
  assert.ok(Math.abs(baseFit.chisq - d5.mtmm.fits.traits.chisq) < 0.5, `χ² ${baseFit.chisq} vs ${d5.mtmm.fits.traits.chisq}`);
  assert.ok(Math.abs(d5.mtmm.fits.ctcm.chisq - d5.mtmm.fits.cu.chisq) < 1e-6, 'with three traits CTCM and CU are equivalent');
});

test('the Day 5 numbers tell the story the script tells', () => {
  const nl = (k: 'scalar' | 'partial') => d5.means.latent[k].means.find(m => m.group === 'NL')!.std;
  assert.ok(d5.means.t.d < 0 && nl('scalar') < d5.means.t.d && nl('partial') < nl('scalar') && d5.alignment.means[2] < nl('partial'));
  const c = d5.cascade.full;
  assert.ok(c[c.length - 1].fit['chisq.scaled'] < c[0].fit['chisq.scaled'] / 5);
  assert.equal(d5.higher.first.fit['chisq.scaled'], d5.higher.second.fit['chisq.scaled']);
  assert.ok(d5.higher.nl.cor[1][0] > 1, 'tradition and conformity collapse in the Netherlands');
  const pf = d5.probe.fits;
  assert.ok(pf.scalar['cfi.robust'] - pf.metric['cfi.robust'] < -0.01, 'probe: full scalar invariance fails');
  assert.ok(pf.partial['cfi.robust'] - pf.metric['cfi.robust'] > -0.01, 'probe: one release per factor reaches partial scalar invariance');
  assert.deepEqual([...d5.probe.released].sort(), ['imbgeco~1', 'imsmetn~1']);
  assert.ok(d5.probe.tau.lrt.p < 0.001, 'ALLOW is not tau-equivalent in the Netherlands');
  const drop = (h: 'half_a' | 'half_b') => d5.cascade[h][3].fit['chisq.scaled'] - d5.cascade[h][6].fit['chisq.scaled'];
  assert.ok(drop('half_b') < drop('half_a') / 2, 'the late steps do not replicate in half B');
});

function ctx(answers: Record<string, string> = {}, snapshots = 0): TaskContext {
  return { a: analyse(base), d: base, base, fit: baseFit, baseFit, changes: changes(base, base, {}), reasons: {}, answers, snapshots, label: n => n };
}
test('the MTMM task walks forward', () => {
  assert.equal(currentStep(task, ctx()), 0);
  assert.equal(currentStep(task, ctx({ predict: '0', judge: '2', find: '1' })), 3);
  assert.equal(currentStep(task, ctx({ predict: '0', judge: '2', find: '1', keep: 'One format only matters for the trust items.', r: 'done' }, 1)), task.steps.length);
});

test('week 1 is complete', () => {
  for (const n of [1, 2, 3, 4, 5]) {
    assert.equal(readiness(DAYS.find(x => x.n === n)!).state, 'ready', `day ${n}`);
  }
});
