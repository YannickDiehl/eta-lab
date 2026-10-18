// Every example template reads cleanly, is estimable in lavaan's terms, and keeps its special features.
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyse, fromLavaan, interactions, toLavaan } from '../model/diagram.ts';
import { TEMPLATES, templateDiagram } from './templates.ts';

for (const t of TEMPLATES) {
  test(`template: ${t.day} · ${t.title}`, () => {
    const { skipped, modifiers } = fromLavaan(t.syntax);
    assert.deepEqual(skipped, []);
    assert.deepEqual(modifiers, []);
    const d = templateDiagram(t);
    const a = analyse(d);
    assert.equal(a.blocked, undefined);
    assert.ok(a.df >= 0, `df ${a.df}`);
    assert.equal(!!d.stdlv, !!t.stdlv);
  });
}

test('the RI-CLPM template has lavaan’s df (9) and fixed measurement errors', () => {
  const d = templateDiagram(TEMPLATES.find(t => t.title.startsWith('Random-intercept'))!);
  assert.equal(analyse(d).df, 9);
  assert.equal(d.nodes.filter(n => n.varFix === 0).length, 8);
});

test('the latent interaction becomes a moderated path and modsem code', () => {
  const d = templateDiagram(TEMPLATES.find(t => t.title.startsWith('Latent interaction'))!);
  const x = interactions(d);
  assert.equal(x.length, 1);
  const code = toLavaan(d);
  assert.match(code, /Effects ~ Universalism \+ agea \+ Universalism:agea/);
  assert.match(code, /modsem\(model, data = my_data, method = "lms"\)/);
  assert.deepEqual(interactions(fromLavaan(code).diagram).length, 1);
});

test('mediation code defines indirect and total effects', () => {
  const d = templateDiagram(TEMPLATES.find(t => t.title.startsWith('Mediation'))!);
  const code = toLavaan(d);
  assert.match(code, /ind_Universalism_Allow := p1\*p3/);
  assert.match(code, /total_Universalism_Allow := p4 \+ p1\*p3/);
  assert.match(code, /se = "bootstrap"/);
});
