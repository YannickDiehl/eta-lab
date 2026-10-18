// The map of SEM, estimation part: what the browser computes must be what lavaan computed
// (public/data/map.json, written by scripts/map-outputs.R).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cellProbs, fitToy, logLik, rescale, rescaleStart, stdLoadings, thresholdsFromCounts, threeTests, toySE } from './map/estimate.ts';
import type { EstData } from './map/estimation.tsx';

const d = (JSON.parse(readFileSync(new URL('../../public/data/map.json', import.meta.url), 'utf8')) as { est: EstData }).est;
const free = (v: number[]) => v.filter((_, i) => i !== 0 && i !== 2);
const near = (a: number, b: number, tol: number, what: string) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

test('the browser finds lavaan’s ML estimates, χ² and standard errors', () => {
  const r = fitToy(d.toy.S, free(d.toy.start));
  assert.ok(r.converged);
  free(d.toy.est).forEach((e, i) => near(r.x[i], e, 1e-3, `parameter ${i}`));
  near(d.toy.n * r.value, d.toy.chisq, 1e-3, 'χ² = N·F');
  near(r.value, 2 * d.toy.fmin, 1e-7, 'F_ML = 2·fmin');
  toySE(d.toy.S, r.x, d.toy.n).forEach((s, i) => near(s, d.toy.se_expected[i], 1e-3, `SE ${i}`));
});

test('Wald, likelihood-ratio and score test of λ₄₂ = 1 match lavaan', () => {
  const r = fitToy(d.toy.S, free(d.toy.start));
  const t = threeTests(d.toy.S, r.x, 1, 1, d.toy.n);
  near(t.wald, 3.462, 0.01, 'lavTestWald');
  near(t.lr, 4.830, 0.01, 'anova');
  near(t.score, 4.736, 0.01, 'lavTestScore');
});

test('ML is scale invariant, least squares is not', () => {
  const s0 = free(d.toy.start), S10 = rescale(d.toy.S, 0, 10), s10 = rescaleStart(s0, 0, 10);
  const ml = [fitToy(d.toy.S, s0), fitToy(S10, s10)].map(r => stdLoadings(r.x));
  const uls = [fitToy(d.toy.S, s0, { est: 'ULS' }), fitToy(S10, s10, { est: 'ULS' })].map(r => stdLoadings(r.x));
  ml[0].forEach((v, i) => near(v, ml[1][i], 1e-3, `ML std loading ${i}`));
  assert.ok(uls[0].some((v, i) => Math.abs(v - uls[1][i]) > 0.005), 'ULS should change');
});

test('a start too short, or a bad start, does not converge', () => {
  assert.equal(fitToy(d.toy.S, free(d.toy.start), { maxIter: 5 }).converged, false);
  assert.equal(fitToy(d.toy.S, [-1, -1, 0.7, 0.6, 0.4, 0.5, 0.05, 0.05, 0]).converged, false);
});

test('thresholds are qnorm of the cumulative shares, as lavaan', () => {
  thresholdsFromCounts(d.ord.counts[0]).forEach((t, i) => near(t, d.ord.thresholds[0][i], 1e-4, `threshold ${i + 1}`));
  // the likelihood of a table is highest at the correlation it was generated with
  const P = cellProbs(d.ord.thresholds[0], d.ord.thresholds[1], d.ord.poly);
  const T = P.map(r => r.map(p => p * 1000));
  const at = (rho: number) => logLik(T, cellProbs(d.ord.thresholds[0], d.ord.thresholds[1], rho));
  assert.ok(at(d.ord.poly) > at(d.ord.poly - 0.05) && at(d.ord.poly) > at(d.ord.poly + 0.05));
});
