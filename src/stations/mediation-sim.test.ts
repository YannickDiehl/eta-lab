import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effects, monteCarlo, possible } from './mediation-sim.ts';

test('total = direct + indirect, and the Sobel interval is symmetric', () => {
  const e = effects({ a: 0.4, b: 0.5, c: 0.1, n: 500 });
  assert.ok(Math.abs(e.total - 0.3) < 1e-12);
  assert.ok(Math.abs(e.sobel[0] + e.sobel[1] - 2 * e.ab) < 1e-12);
});

test('small samples: the product is skewed, the Monte Carlo interval is not symmetric', () => {
  const p = { a: 0.2, b: 0.2, c: 0, n: 80 };
  const mc = monteCarlo(p), e = effects(p);
  const lower = e.ab - mc.ci[0], upper = mc.ci[1] - e.ab;
  assert.ok(upper > lower * 1.2, `upper ${upper}, lower ${lower}`);
  assert.ok(e.sobel[0] < 0, 'Sobel crosses zero');
});

test('impossible populations are refused', () => {
  assert.equal(possible({ a: 0.55, b: 0.55, c: 0.55, n: 100 }), true);
  assert.equal(possible({ a: 0.9, b: 0.7, c: 0.6, n: 100 }), false);
});
