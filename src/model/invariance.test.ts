// df of the invariance ladder must match lavaan (fitted models, lavaan 0.6-21, sem() defaults).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fromLavaan } from './diagram.ts';
import { ladder, locks, ladderSyntax, NO_GROUPS } from './invariance.ts';

const dfs = (syntax: string, G = 2, free: string[] = []) => ladder(fromLavaan(syntax).diagram, G, free).rungs.map(r => r.df);

test('one factor, four items: 4 → 7 → 10 → 14', () => assert.deepEqual(dfs('F =~ a+b+c+d'), [4, 7, 10, 14]));
test('three groups, strict: 26', () => assert.equal(dfs('F =~ a+b+c+d', 3)[3], 26));
test('SEM with a covariate: 26 → 30 → 34 → 40', () => assert.deepEqual(dfs('F1 =~ a+b+c\nF2 =~ d+e+f\nF2 ~ F1 + x'), [26, 30, 34, 40]));
test('single indicator, observed outcome, residual covariance: 6 → 8 → 11 → 15', () =>
  assert.deepEqual(dfs('F =~ a+b+c\nG =~ d\ny ~ F + G\na ~~ b'), [6, 8, 11, 15]));

test('partial invariance: releasing a loading and an intercept', () => {
  const d = fromLavaan('F =~ a+b+c+d').diagram;
  const s = ladder(d, 2).s;
  const keys = locks(s).filter(l => l.partial === 'F=~c' || l.partial === 'c~1').map(l => l.key);
  assert.equal(keys.length, 2);
  assert.equal(ladder(d, 2, keys).rungs[2].df, 8);
  const res = locks(s).find(l => l.partial === 'd~~d')!.key;
  assert.equal(ladder(d, 3, [...keys, res]).rungs[3].df, 20);
});

test('η warns when a factor keeps no equal intercept', () => {
  const d = fromLavaan('F =~ a+b+c').diagram;
  const ints = locks(ladder(d, 2).s).filter(l => l.kind === 'intercept').map(l => l.key);
  assert.match(ladder(d, 2, ints, 'scalar').notes.map(n => n.text).join(' '), /not identified/);
});

test('syntax lists the nested fits with group.equal and group.partial', () => {
  const d = fromLavaan('F =~ a+b+c+d').diagram;
  const k = locks(ladder(d, 2).s).find(l => l.partial === 'c~1')!.key;
  const r = ladderSyntax(d, { ...NO_GROUPS, on: true, free: [k] });
  assert.match(r, /fit_metric\s+<- cfa\(model, data = my_data, group = "cntry",\s+group.equal = "loadings"\)/);
  assert.match(r, /group.equal = c\("loadings", "intercepts"\),\s+group.partial = c\("c~1"\)/);
  assert.match(r, /lavTestLRT\(fit_configural, fit_metric, fit_scalar\)/);
});

test('estimator options reach every call of the ladder', () => {
  const d = fromLavaan('F =~ a + b + c + d\nF ~ age').diagram;
  const g = { ...NO_GROUPS, on: true, variable: 'cntry', names: ['A', 'B'], level: 'strict' as const, free: [] };
  const mlr = ladderSyntax(d, g, { estimator: 'MLR', missing: 'fiml' });
  assert.equal((mlr.match(/estimator = "MLR", missing = "fiml", fixed.x = FALSE/g) ?? []).length, 4);
  assert.match(mlr, /cfi\.robust/);
  const wl = ladderSyntax(d, g, { estimator: 'WLSMV', missing: 'listwise' });
  assert.match(wl, /ordered_items <- c\("a", "b", "c", "d"\)/);           // the covariate stays continuous
  assert.match(wl, /fit_metric +<- measEq\.syntax\([\s\S]*?group\.equal = "loadings"/);
  assert.match(wl, /fit_scalar +<- measEq\.syntax\([\s\S]*?group\.equal = c\("thresholds", "loadings"\)/);
  assert.match(wl, /ID\.cat = "Wu\.Estabrook\.2016"/);
  assert.match(wl, /cfi\.scaled/);
});
