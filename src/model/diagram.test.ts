// Degrees of freedom of drawn models must match lavaan's defaults (values from sem() in R).
import test from 'node:test';
import assert from 'node:assert/strict';
import { addEdge, analyse, fromLavaan, toLavaan, varName, type Diagram, type DNode } from './diagram.ts';

const node = (id: string, kind: 'latent' | 'observed'): DNode => ({ id, kind, label: id, x: 0, y: 0 });

/** Build a diagram from lavaan-like spec: factors with items, paths, covariances. */
function build(f: Record<string, string[]>, paths: [string, string][] = [], covs: [string, string][] = [], covariates: string[] = []) {
  let d: Diagram = { nodes: [], edges: [] };
  for (const [lv, items] of Object.entries(f)) {
    d.nodes.push(node(lv, 'latent'));
    for (const it of items) if (!d.nodes.some(n => n.id === it)) d.nodes.push(node(it, 'observed'));
  }
  covariates.forEach(c => d.nodes.push(node(c, 'observed')));
  for (const [lv, items] of Object.entries(f)) for (const it of items) d = addEdge(d, lv, it, false);
  paths.forEach(([from, to]) => { d = addEdge(d, from, to, false); });
  covs.forEach(([a, b]) => { d = addEdge(d, a, b, true); });
  return d;
}

const cases: [string, Diagram, number][] = [
  ['one factor, three items', build({ F: ['a', 'b', 'c'] }), 0],
  ['one factor, four items', build({ F: ['a', 'b', 'c', 'd'] }), 2],
  ['two correlated factors', build({ F1: ['a', 'b', 'c'], F2: ['d', 'e', 'f'] }), 8],
  ['two factors with a regression', build({ F1: ['a', 'b', 'c'], F2: ['d', 'e', 'f'] }, [['F1', 'F2']]), 8],
  ['4 + 3 items, regression', build({ T: ['a', 'b', 'c', 'd'], V: ['e', 'f', 'g'] }, [['T', 'V']]), 13],
  ['MIMIC with one covariate', build({ F: ['a', 'b', 'c'] }, [['x', 'F']], [], ['x']), 2],
  ['residual covariance', build({ F: ['a', 'b', 'c', 'd'] }, [], [['a', 'b']]), 1],
];

for (const [name, d, df] of cases)
  test(`df: ${name} = ${df}`, () => assert.equal(analyse(d).df, df));

test('lavaan syntax lists loadings, paths and covariances', () => {
  const d = build({ T: ['a', 'b', 'c'], V: ['d', 'e', 'f'] }, [['T', 'V']], [['a', 'b']]);
  const s = toLavaan(d);
  assert.match(s, /T =~ a \+ b \+ c/);
  assert.match(s, /V ~ T/);
  assert.match(s, /a ~~ b/);
  assert.match(s, /fit <- sem\(/);
});

test('notes flag a two-item factor and an unconnected item', () => {
  const d = build({ F: ['a', 'b'] });
  d.nodes.push(node('z', 'observed'));
  const texts = analyse(d).notes.map(n => n.text).join(' ');
  assert.match(texts, /two items/);
  assert.match(texts, /not connected/);
});

// ---- cases the first version got wrong (values from lavaan 0.6-21, sem() defaults)
const lav = (syntax: string) => analyse(fromLavaan(syntax).diagram);
const more: [string, string, number][] = [
  ['two outcomes of one factor: lavaan lets their residuals covary', 'F1 =~ a+b+c\nF2 =~ d+e+f\nF3 =~ g+h+i\nF2 ~ F1\nF3 ~ F1', 24],
  ['single indicator: residual fixed to 0', 'F =~ a\nG =~ b+c+d\nG ~ F', 2],
  ['plain covariance between two boxes', 'a ~~ b', 0],
  ['higher-order factor', 'H =~ F1 + F2 + F3\nF1 =~ a+b+c\nF2 =~ d+e+f\nF3 =~ g+h+i', 24],
  ['observed outcome and MIMIC covariate', 'F1 =~ a+b+c\nF1 ~ x1\nz ~ x1', 4],
];
for (const [name, syntax, df] of more) test(`df: ${name} = ${df}`, () => assert.equal(lav(syntax).df, df));

test('lavaan refuses a covariance between a factor-tied box and a plain box — η says so first', () => {
  const a = lav('F1 =~ a+b+c\nx1 ~~ F1\nb ~~ x1');
  assert.ok(a.blocked);
  assert.equal(lav('F1 =~ a+b+c\nx1 ~~ F1').blocked, undefined);
});

test('syntax round trip keeps the model', () => {
  const src = 'Trust =~ t1 + t2 + t3 + t4\nVacc =~ v1 + v2 + v3\nVacc ~ Trust + age\nt1 ~~ t2';
  const once = fromLavaan(src).diagram;
  const twice = fromLavaan(toLavaan(once)).diagram;
  assert.equal(analyse(twice).df, analyse(once).df);
  assert.equal(toLavaan(twice), toLavaan(once));
});

test('parser reads R code with modifiers, comments and line breaks', () => {
  const { diagram, skipped } = fromLavaan(`model <- '
    # values
    Values =~ 1*imptrad + a*ipfrule +
              ipbhprp + NA*ipmodst   # four items
    Values ~~ Values
    imptrad ~ 1
    Values ~ agea; gndr ~~ agea
  '
  fit <- cfa(model, data = ess)`);
  assert.equal(diagram.nodes.filter(n => n.kind === 'latent').length, 1);
  assert.deepEqual(diagram.nodes.filter(n => n.kind === 'observed').map(n => n.label), ['imptrad', 'ipfrule', 'ipbhprp', 'ipmodst', 'agea', 'gndr']);
  assert.equal(diagram.edges.length, 6);
  assert.deepEqual(skipped, ['imptrad ~ 1']);
  const e = (to: string) => diagram.edges.find(x => diagram.nodes.find(n => n.id === x.to)!.label === to)!;
  assert.equal(e('imptrad').fix, 1);
  assert.equal(e('ipfrule').label, 'a');
  assert.equal(e('ipmodst').free, true);
});

test('constraints: tau-equivalence, parallel items, fixed values and std.lv count as lavaan does', () => {
  const df = (s: string) => analyse(fromLavaan(s).diagram).df;
  assert.equal(df('F =~ l*a + l*b + l*c + l*d'), 5);                                   // label with the marker: all fixed to 1
  assert.equal(df('fit <- cfa("F =~ l*a + l*b + l*c + l*d", std.lv = TRUE)'), 5);
  assert.equal(df('fit <- cfa("F =~ a + b + c + d", std.lv = TRUE)'), 2);
  assert.equal(df('fit <- cfa("F =~ l*a + l*b + l*c + l*d\na ~~ e*a\nb ~~ e*b\nc ~~ e*c\nd ~~ e*d", std.lv = TRUE)'), 8);
  assert.equal(df('F =~ a + b + c\nG =~ d + e + f\nF ~~ 0*G'), 9);
  assert.equal(df('F =~ a + 0.5*b + c'), 1);
  assert.equal(df('F =~ NA*a + l*a + l*b + l*c + l*d\nF ~~ 1*F'), 5);
  assert.equal(df('F =~ a + b + c + d\nb ~~ x*b\nc ~~ x*c'), 3);
});

test('modifiers survive a round trip through the syntax', () => {
  const src = 'F =~ NA*a + l*a + l*b + 0.5*c\nG =~ d + e + f\nG ~ g*F\nd ~~ 0*e\nF ~~ 1*F\nb ~~ v*b';
  const once = fromLavaan(src).diagram, twice = fromLavaan(toLavaan(once)).diagram;
  assert.equal(toLavaan(twice), toLavaan(once));
  assert.match(toLavaan(once), /F =~ NA\*a \+ l\*a \+ l\*b \+ 0\.5\*c/);
  assert.match(toLavaan(once), /F ~~ 1\*F/);
});

test('names become valid lavaan names', () => {
  assert.equal(varName('Vertrauen in Ärzte', 'F1'), 'Vertrauen_in_Aerzte');
  assert.equal(varName('café', 'x'), 'cafe');
  assert.equal(varName('2nd wave', 'x'), 'v_2nd_wave');
  assert.equal(varName('.hidden', 'x'), 'hidden');
  assert.equal(varName('###', 'x3'), 'x3');
});

test('duplicate names are flagged and made unique in the syntax', () => {
  const d = fromLavaan('F =~ a + b + c').diagram;
  d.nodes.find(n => n.label === 'b')!.label = 'a';
  assert.match(toLavaan(d), /F =~ a \+ a_2 \+ c/);
  assert.match(analyse(d).notes.map(n => n.text).join(' '), /both called “a”/);
});

test('two correlated two-item factors are identified — η does not warn', () => {
  const a = analyse(fromLavaan('A =~ a1 + a2\nB =~ b1 + b2').diagram);
  assert.equal(a.df, 1);
  assert.ok(!a.notes.some(n => n.level === 'warn'), a.notes.map(n => n.text).join(' | '));
});
