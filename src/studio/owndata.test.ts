// Own data: CSV reading and group statistics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ownGroups, parseCsv } from './owndata.ts';

test('reads comma CSV with quotes and missing values', () => {
  const d = parseCsv('x1,x2,"group name",note\n1,2,a,"hi, there"\n2,NA,b,x\n3,5,a,\n4,6,b,y\n', 'mine');
  assert.deepEqual(d.columns, ['x1', 'x2', 'group name', 'note']);
  assert.deepEqual(d.numeric, [true, true, false, false]);
  assert.equal(d.cells[0][3], 'hi, there');
  assert.ok(d.groupable.includes('group name'));
});

test('reads semicolon CSV with decimal commas', () => {
  const d = parseCsv('a;b\n1,5;2\n2,5;4\n3,5;7\n', 'eu');
  assert.deepEqual(d.numeric, [true, true]);
  const [g] = ownGroups(d, ['a', 'b'], null);
  assert.deepEqual(g.means, [2.5, 13 / 3]);
});

test('statistics per group use the complete cases on the model variables', () => {
  const d = parseCsv('x,y,g\n1,2,a\n2,4,a\n3,,a\n1,1,b\n2,3,b\n3,5,b\n', 'grp');
  const gs = ownGroups(d, ['x', 'y'], 'g');
  assert.deepEqual(gs.map(s => s.n), [2, 3]);
  assert.deepEqual(gs[1].cov, [[1, 2], [2, 4]]);
});
