// Day 4 as built: the ladder task's story must hold on the Benelux data, and its checks must
// follow the learner — releases need reasons and at least two anchors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupsFor, type CourseData } from '../data/course.ts';
import { fitModel, type Fitted } from '../math/sem.ts';
import { analyse, fromLavaan } from '../model/diagram.ts';
import { LEVELS, ladder, type Groups, type Level } from '../model/invariance.ts';
import { changes, releases } from '../studio/logbook.ts';
import { currentStep, taskById, type TaskContext } from '../studio/tasks.ts';

const data = JSON.parse(readFileSync(new URL('../../public/data/course-data.json', import.meta.url), 'utf8')) as CourseData;
const task = taskById('d4-ladder')!;
const stats = groupsFor(data, task.data.round, task.data.sample, task.data.grouping);
const d = fromLavaan(task.syntax).diagram;
const locks = ladder(d, 3).locks;
const key = (item: string) => locks.find(l => l.kind === 'intercept' && d.nodes.find(n => n.id === l.node)?.label === item)!.key;

function ctx(level: Level, free: string[], answers: Record<string, string> = {}, reasons: Record<string, string> = {}): TaskContext {
  const g: Groups = { ...task.groups!, level, free };
  const rungs = LEVELS.map(l => fitModel(d, { groups: stats, level: l, free }));
  const rel = releases(d, locks, free);
  return {
    a: analyse(d), d, base: d, fit: rungs[LEVELS.indexOf(level)] as Fitted, baseFit: null,
    changes: changes(d, d, reasons, rel), reasons, answers, snapshots: 0, label: n => n,
    g, locks, rungs, refit: (lv, fr, stdlv) => { const r = fitModel(stdlv ? { ...d, stdlv: true } : d, { groups: stats, level: lv, free: fr }); return r.ok ? r : null; },
  };
}

test('the ladder breaks at the scalar rung, and “rules” is the intercept that breaks it', () => {
  const c = ctx('scalar', []);
  const r = c.rungs as Fitted[];
  assert.ok(Math.abs(r[0].chisq - 13.646) < 0.01 && Math.abs(r[2].chisq - 629.362) < 0.01, 'same numbers as lavaan (exact sample)');
  const judge = task.steps.find(s => s.id === 'judge')!.choice!(c)!;
  assert.equal(judge.answer, 1);                                                // metric
  const find = task.steps.find(s => s.id === 'find')!.choice!(c)!;
  assert.equal(find.options[find.answer!], 'ipfrule');
  const anchors = task.steps.find(s => s.id === 'anchors')!.choice!(c)!;
  assert.match(anchors.question, /0\.53 SD below Belgium; freeing “rules” and “modest”, 0\.31 SD/);
});

test('the task walks with the learner', () => {
  const a = { predict: '1', judge: '1', find: '2' };
  assert.equal(currentStep(task, ctx('configural', [], { predict: '1' })), 1);   // climb: level still configural
  assert.equal(currentStep(task, ctx('scalar', [], a)), 4);                       // release: nothing yet
  const rules = key('ipfrule');
  assert.equal(currentStep(task, ctx('scalar', [rules], a)), 4);                  // no reason yet
  const why = { [`release:${rules}`]: '“Following rules” reads differently in Dutch and French versions.' };
  assert.equal(currentStep(task, ctx('scalar', [rules], a, why)), 5);
  // three releases leave one anchor: refused
  const three = [rules, key('ipmodst'), key('imptrad')];
  const reasons3 = Object.fromEntries(three.map(k => [`release:${k}`, 'a reason that is long enough']));
  assert.equal(currentStep(task, ctx('scalar', three, a, reasons3)), 4);
  assert.match(String(task.steps.find(s => s.id === 'release')!.check!(ctx('scalar', three, a, reasons3))), /two intercepts/);
});
