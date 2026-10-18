import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pbinorm, pearsonOfCategories, qnorm, pnorm, shares } from './categories.ts';

test('normal helpers', () => {
  assert.ok(Math.abs(qnorm(0.975) - 1.959964) < 1e-5);
  assert.ok(Math.abs(pnorm(qnorm(0.3)) - 0.3) < 1e-6);
  // P(Z1 ≤ 0, Z2 ≤ 0) = 1/4 + asin(ρ)/(2π)
  assert.ok(Math.abs(pbinorm(0, 0, 0.6) - (0.25 + Math.asin(0.6) / (2 * Math.PI))) < 1e-6);
});

test('categories attenuate a correlation, more with fewer boxes and more skew', () => {
  const two = pearsonOfCategories(0.6, 2, 0);
  assert.ok(Math.abs(two - (2 / Math.PI) * Math.asin(0.6)) < 1e-4, `phi ${two}`);   // the tetrachoric relation
  const seven = pearsonOfCategories(0.6, 7, 0);
  assert.ok(seven > 0.55 && seven < 0.6);
  assert.ok(pearsonOfCategories(0.6, 4, 1.2) < pearsonOfCategories(0.6, 4, 0));
  assert.ok(Math.abs(shares(5, 0.7).reduce((a, b) => a + b, 0) - 1) < 1e-9);
});
