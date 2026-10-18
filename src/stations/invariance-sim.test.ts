import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAIR, naiveMean, RELEASE, runLadder } from './invariance-sim.ts';

test('a fair ruler: every rung fits and the factor mean is found', () => {
  const r = runLadder(FAIR);
  assert.equal(r.rungs.length, 4);
  r.rungs.forEach(x => assert.ok(x.chisq < 1e-4, `χ² ${x.chisq}`));
  assert.ok(Math.abs(r.mean! - 0.3) < 1e-3, `mean ${r.mean}`);
  assert.ok(Math.abs(naiveMean(FAIR) - 0.3) < 0.02);
});

test('a biased intercept breaks the scalar rung and the mean — releasing it repairs the mean', () => {
  const w = { ...FAIR, bias: 0.5 };
  const r = runLadder(w);
  assert.ok(r.rungs[1].chisq < 1e-4, 'metric still holds');
  assert.ok(r.rungs[2].cfi < r.rungs[1].cfi - 0.01, 'scalar fails');
  assert.ok(r.mean! > 0.35, `biased mean ${r.mean}`);
  const p = runLadder(w, [RELEASE.intercept]);
  assert.ok(p.rungs[2].chisq < 1e-4);
  assert.ok(Math.abs(p.mean! - 0.3) < 1e-3, `partial mean ${p.mean}`);
});

test('a different loading breaks the metric rung', () => {
  const r = runLadder({ ...FAIR, loadB: 1.2 });
  assert.ok(r.rungs[0].chisq < 1e-4);
  assert.ok(r.rungs[1].chisq > 10);
  const p = runLadder({ ...FAIR, loadB: 1.2 }, [RELEASE.loading, RELEASE.intercept]);
  assert.ok(p.rungs[2].chisq < 1e-3, `χ² ${p.rungs[2].chisq}`);
});
