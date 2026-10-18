// The example models, day by day: ready to load onto the sheet, with the data they belong to
// and a layout that shows their idea (waves side by side, methods under traits, …).
import { fromLavaan, type Diagram } from '../model/diagram.ts';
import type { Grouping } from '../data/course.ts';

export interface Template {
  day: string; title: string; syntax: string;
  round?: string; sample?: string; grouping?: Grouping; stdlv?: boolean;
  layout?: 'panel' | 'clpm' | 'mtmm' | 'bifactor';
  note?: string;
}

const RICLPM = `RIx =~ 1*x1 + 1*x2 + 1*x3 + 1*x4
RIy =~ 1*y1 + 1*y2 + 1*y3 + 1*y4
wx1 =~ 1*x1
wx2 =~ 1*x2
wx3 =~ 1*x3
wx4 =~ 1*x4
wy1 =~ 1*y1
wy2 =~ 1*y2
wy3 =~ 1*y3
wy4 =~ 1*y4
wx2 ~ wx1 + wy1
wy2 ~ wx1 + wy1
wx3 ~ wx2 + wy2
wy3 ~ wx2 + wy2
wx4 ~ wx3 + wy3
wy4 ~ wx3 + wy3
wx1 ~~ wy1
wx2 ~~ wy2
wx3 ~~ wy3
wx4 ~~ wy4
RIx ~~ RIy
RIx ~~ 0*wx1 + 0*wy1
RIy ~~ 0*wx1 + 0*wy1
x1 ~~ 0*x1
x2 ~~ 0*x2
x3 ~~ 0*x3
x4 ~~ 0*x4
y1 ~~ 0*y1
y2 ~~ 0*y2
y3 ~~ 0*y3
y4 ~~ 0*y4`;

export const TEMPLATES: Template[] = [
  { day: 'Day 1', title: 'One factor: tradition and conformity', syntax: 'TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp' },
  { day: 'Day 2', title: 'Two factors: tradition and conformity', syntax: 'Tradition =~ imptrad + ipmodst\nConformity =~ ipfrule + ipbhprp' },
  { day: 'Day 3', title: 'Three constructs: values and immigration', syntax: 'TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp\nUNIV =~ ipeqopt + ipudrst + impenv\nALLOW =~ imsmetn + imdfetn + impcntr' },
  { day: 'Day 4', title: 'Invariance across the Benelux countries', syntax: 'TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp', grouping: 'country', round: 'ess2004' },
  { day: 'Day 5', title: 'Higher order: conservation (Belgium)', round: 'ess2004', sample: 'BE', syntax: 'Conservation =~ Tradition + Conformity + Security\nTradition =~ imptrad + ipmodst\nConformity =~ ipfrule + ipbhprp\nSecurity =~ impsafe + ipstrgv' },
  { day: 'Day 5', title: 'Bifactor: a general factor (Netherlands)', stdlv: true, layout: 'bifactor', round: 'ess2004', sample: 'NL',
    syntax: 'GENERAL =~ ipeqopt + ipudrst + impenv + imsmetn + imdfetn + impcntr + imbgeco + imueclt + imwbcnt\nUNIV =~ ipeqopt + ipudrst + impenv\nALLOW =~ imsmetn + imdfetn + impcntr\nEFFECTS =~ imbgeco + imueclt + imwbcnt\nGENERAL ~~ 0*UNIV + 0*ALLOW + 0*EFFECTS\nUNIV ~~ 0*ALLOW + 0*EFFECTS\nALLOW ~~ 0*EFFECTS',
    note: 'Every item measures the general factor and its own facet; all factors are uncorrelated.' },
  { day: 'Day 5', title: 'MTMM: traits and method factors (CT-UM)', stdlv: true, layout: 'mtmm', round: 'mtmm',
    syntax: 'Parl =~ parl_a + parl_b + parl_c\nLegal =~ legal_a + legal_b + legal_c\nPolice =~ police_a + police_b + police_c\nScale11 =~ parl_a + legal_a + police_a\nAgree4 =~ parl_b + legal_b + police_b\nScale5 =~ parl_c + legal_c + police_c\nScale11 ~~ 0*Parl + 0*Legal + 0*Police + 0*Agree4 + 0*Scale5\nAgree4 ~~ 0*Parl + 0*Legal + 0*Police + 0*Scale5\nScale5 ~~ 0*Parl + 0*Legal + 0*Police',
    note: 'Correlated traits, uncorrelated method factors. Simulated data.' },
  { day: 'Day 5', title: 'MTMM: correlated uniqueness', stdlv: true, layout: 'mtmm', round: 'mtmm',
    syntax: 'Parl =~ parl_a + parl_b + parl_c\nLegal =~ legal_a + legal_b + legal_c\nPolice =~ police_a + police_b + police_c\nparl_a ~~ legal_a + police_a\nlegal_a ~~ police_a\nparl_b ~~ legal_b + police_b\nlegal_b ~~ police_b\nparl_c ~~ legal_c + police_c\nlegal_c ~~ police_c',
    note: 'Method effects as covariances between items of the same format. Simulated data.' },
  { day: 'Day 6', title: 'Full SEM: values → attitudes toward immigration', syntax: 'TRCO =~ ipmodst + imptrad + ipfrule + ipbhprp\nUNIV =~ ipeqopt + ipudrst + impenv\nALLOW =~ imsmetn + imdfetn + impcntr\nALLOW ~ TRCO + UNIV + agea + female + eduyrs' },
  { day: 'Day 7', title: 'MIMIC: who sees immigration as good?', syntax: 'Effects =~ imbgeco + imueclt + imwbcnt\nEffects ~ agea + female + eduyrs' },
  { day: 'Day 7', title: 'Mediation: universalism → effects → allow', round: 'ess2004',
    syntax: 'Universalism =~ ipeqopt + ipudrst + impenv\nEffects =~ imbgeco + imueclt + imwbcnt\nAllow =~ imsmetn + imdfetn + impcntr\nEffects ~ Universalism + agea\nAllow ~ Effects + Universalism + agea',
    note: 'Results → Effects splits each effect into direct and indirect parts.' },
  { day: 'Day 8', title: 'Moderation by age group (multiple groups)', syntax: 'Universalism =~ ipeqopt + ipudrst + impenv\nEffects =~ imbgeco + imueclt + imwbcnt\nEffects ~ Universalism + eduyrs', grouping: 'age' },
  { day: 'Day 8', title: 'Latent interaction: universalism × age', round: 'ess2004',
    syntax: 'Universalism =~ ipeqopt + ipudrst + impenv\nEffects =~ imbgeco + imueclt + imwbcnt\nEffects ~ Universalism + agea + Universalism:agea',
    note: 'The interaction is estimated in R with modsem; the studio estimates the model without it.' },
  { day: 'Day 9', title: 'Cross-lagged panel model (CLPM)', round: 'panel', layout: 'clpm',
    syntax: 'x2 ~ x1 + y1\ny2 ~ x1 + y1\nx3 ~ x2 + y2\ny3 ~ x2 + y2\nx4 ~ x3 + y3\ny4 ~ x3 + y3\nx1 ~~ y1\nx2 ~~ y2\nx3 ~~ y3\nx4 ~~ y4',
    note: 'Simulated panel. Compare with the RI-CLPM: which one finds the true within-person effect?' },
  { day: 'Day 9', title: 'Random-intercept CLPM (RI-CLPM)', round: 'panel', layout: 'panel', syntax: RICLPM,
    note: 'Random intercepts take the stable differences between people; the w-factors carry the within-person dynamics (Hamaker, Kuiper & Grasman, 2015).' },
];

/** Place the shapes so that the template's idea is visible. */
export function layout(d: Diagram, kind: NonNullable<Template['layout']>): Diagram {
  const at = new Map<string, { x: number; y: number }>();
  const put = (label: string, x: number, y: number) => { const n = d.nodes.find(q => q.label === label); if (n) at.set(n.id, { x, y }); };
  if (kind === 'panel' || kind === 'clpm') {
    const col = (t: number) => 160 + (t - 1) * 230;
    for (let t = 1; t <= 4; t++) {
      if (kind === 'panel') {
        put(`wx${t}`, col(t), 200); put(`x${t}`, col(t), 330); put(`y${t}`, col(t), 450); put(`wy${t}`, col(t), 580);
      } else { put(`x${t}`, col(t), 140); put(`y${t}`, col(t), 380); }
    }
    put('RIx', col(2.5), 60); put('RIy', col(2.5), 720);
  }
  if (kind === 'mtmm') {
    const items = ['parl_a', 'legal_a', 'police_a', 'parl_b', 'legal_b', 'police_b', 'parl_c', 'legal_c', 'police_c'];
    items.forEach((v, i) => put(v, 110 + i * 132 + Math.floor(i / 3) * 40, 330));
    ['Parl', 'Legal', 'Police'].forEach((v, i) => put(v, 300 + i * 430, 90));
    ['Scale11', 'Agree4', 'Scale5'].forEach((v, i) => put(v, 242 + i * 436, 570));
  }
  if (kind === 'bifactor') {
    const items = ['ipeqopt', 'ipudrst', 'impenv', 'imsmetn', 'imdfetn', 'impcntr', 'imbgeco', 'imueclt', 'imwbcnt'];
    items.forEach((v, i) => put(v, 110 + i * 132 + Math.floor(i / 3) * 40, 330));
    put('GENERAL', 110 + 4 * 132 + 40, 90);
    ['UNIV', 'ALLOW', 'EFFECTS'].forEach((v, i) => put(v, 242 + i * 436, 570));
  }
  return { ...d, nodes: d.nodes.map(n => ({ ...n, ...(at.get(n.id) ?? {}) })) };
}

export function templateDiagram(t: Template): Diagram {
  let d = fromLavaan(t.syntax).diagram;
  if (t.layout) d = layout(d, t.layout);
  if (t.stdlv) d = { ...d, stdlv: true };
  return d;
}
