import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeModel, encodeModel, validShared } from './share.ts';
import { example } from '../model/diagram.ts';
import { NO_GROUPS } from '../model/invariance.ts';
import type { YourModel } from '../state.ts';

const model: YourModel = {
  question: 'Do values shape attitudes?', n: 1500, diagram: example(),
  groups: { ...NO_GROUPS, on: true, variable: 'cntry', names: ['BE', 'NL'], level: 'scalar', free: ['x'] },
  data: { source: 'course', round: 'ess2004', sample: 'pooled', grouping: 'country' }, snapshots: [], r: { estimator: 'MLR', missing: 'fiml' }, reasons: {},
};

test('a model survives the trip through a link', async () => {
  const code = await encodeModel(model);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.ok(code.length < 2000, `link code is ${code.length} characters`);
  const back = await decodeModel(code);
  assert.ok(back);
  assert.equal(back.question, model.question);
  assert.deepEqual(back.groups, model.groups);
  assert.deepEqual(back.r, model.r);
  assert.deepEqual(back.data, model.data);
  assert.equal(back.diagram.nodes.length, model.diagram.nodes.length);
  assert.deepEqual(back.diagram.edges, model.diagram.edges);
});

test('own data files never travel with a link', async () => {
  const back = await decodeModel(await encodeModel({ ...model, data: { source: 'own', name: 'secret.csv', grouping: null } }));
  assert.equal(back?.data, null);
});

test('broken links and files are refused or repaired', async () => {
  assert.equal(await decodeModel('not-a-model'), null);
  assert.equal(validShared({ diagram: { nodes: 'x' } }), null);
  const fixed = validShared({ diagram: { nodes: [{ id: 'a', kind: 'latent', label: 'F', x: 'oops', y: 3 }], edges: [{ id: 'e', kind: 'path', from: 'a', to: 'gone' }] } });
  assert.equal(fixed?.diagram.nodes[0].x, 0);
  assert.equal(fixed?.diagram.edges.length, 0);
  assert.equal(fixed?.r.estimator, 'ML');
});
