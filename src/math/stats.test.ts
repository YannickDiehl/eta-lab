import test from 'node:test';
import assert from 'node:assert/strict';
import { attenuated, chisqP, correlation, normals, rng, spearmanBrown } from './stats.ts';

test('χ² p-values match R (pchisq(x, df, lower.tail = FALSE))', () => {
  // reference values from R
  assert.ok(Math.abs(chisqP(12.947, 2) - 0.001544) < 2e-5);
  assert.ok(Math.abs(chisqP(3.84, 1) - 0.05004) < 2e-5);
  assert.ok(Math.abs(chisqP(20, 10) - 0.02925) < 2e-5);
});

test('attenuation: a large simulated sample reproduces ρ·√(relX·relY)', () => {
  const u = rng(42), n = 40000, rho = 0.6, relX = 0.5, relY = 0.7;
  const z1 = normals(u, n), z2 = normals(u, n), e1 = normals(u, n), e2 = normals(u, n);
  const tx = z1, ty = z1.map((v, i) => rho * v + Math.sqrt(1 - rho * rho) * z2[i]);
  const x = tx.map((v, i) => Math.sqrt(relX) * v + Math.sqrt(1 - relX) * e1[i]);
  const y = ty.map((v, i) => Math.sqrt(relY) * v + Math.sqrt(1 - relY) * e2[i]);
  assert.ok(Math.abs(correlation(x, y) - attenuated(rho, relX, relY)) < 0.015);
});

test('Spearman–Brown', () => {
  assert.ok(Math.abs(spearmanBrown(0.5, 4) - 0.8) < 1e-12);
  assert.equal(spearmanBrown(0.5, 1), 0.5);
});
