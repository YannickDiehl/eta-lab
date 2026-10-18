// The logbook: every change against the example model — and every parameter added from a
// modification index or released from an invariance equality — wants one sentence of reason.
// The reasons travel into the lavaan code, the share link and the Quarto report, so the
// model's history can be defended — to a supervisor, a reviewer or yourself.
import { varName, type DEdge, type Diagram } from '../model/diagram.ts';
import type { Lock } from '../model/invariance.ts';

export interface Change {
  key: string;                                   // stable across reloads: built from names, not ids
  sign: '+' | '−';
  text: string;                                  // in words, for the card and the report
  code: string;                                  // in lavaan notation, for the R comments
  edge?: string;                                 // the edge on the sheet (added changes)
}

const nameOf = (d: Diagram, id: string) => {
  const n = d.nodes.find(x => x.id === id);
  return n ? varName(n.label, n.kind === 'latent' ? 'F' : 'x') : id;
};
const latent = (d: Diagram, id: string) => d.nodes.find(x => x.id === id)?.kind === 'latent';

/** A name-based signature of an edge: the same arrow keeps its key after undo, reload or sharing. */
export function edgeKey(d: Diagram, e: DEdge) {
  const a = nameOf(d, e.from), b = nameOf(d, e.to);
  if (e.kind === 'cov') { const [x, y] = [a, b].sort(); return `cov:${x}~~${y}`; }
  return `${e.kind}:${a}->${b}`;
}

function describe(d: Diagram, e: DEdge, base?: Diagram): Omit<Change, 'key' | 'sign' | 'edge'> {
  const a = nameOf(d, e.from), b = nameOf(d, e.to);
  if (e.kind === 'loading') {
    const cross = !!base && base.edges.some(x => x.kind === 'loading' && nameOf(base, x.to) === b);
    return { text: `${b} ${cross ? 'also ' : ''}measures ${a}${cross ? ' (cross-loading)' : ''}`, code: `${a} =~ ${b}` };
  }
  if (e.kind === 'path') return { text: `${a} → ${b}`, code: `${b} ~ ${a}` };
  const what = latent(d, e.from) && latent(d, e.to) ? 'factor covariance' : 'residual covariance';
  return { text: `${what} ${a} ↔ ${b}`, code: `${a} ~~ ${b}` };
}

/** Changes against the example model (base). Without a base (the learner's own project), only the
 *  arrows that already carry a reason are listed — those added from a modification index. */
export function changes(d: Diagram, base: Diagram | undefined, reasons: Record<string, string>, released: { key: string; text: string; code: string }[] = []): Change[] {
  const out: Change[] = [];
  if (base) {
    const before = new Set(base.edges.map(e => edgeKey(base, e)));
    const now = new Set(d.edges.map(e => edgeKey(d, e)));
    d.edges.forEach(e => { const key = edgeKey(d, e); if (!before.has(key)) out.push({ key, sign: '+', edge: e.id, ...describe(d, e, base) }); });
    base.edges.forEach(e => { const key = edgeKey(base, e); if (!now.has(key)) { const desc = describe(base, e); out.push({ key, sign: '−', text: `removed: ${desc.text}`, code: desc.code }); } });
  } else {
    d.edges.forEach(e => { const key = edgeKey(d, e); if (reasons[key] !== undefined) out.push({ key, sign: '+', edge: e.id, ...describe(d, e) }); });
  }
  released.forEach(r => out.push({ key: `release:${r.key}`, sign: '+', text: `released equality: ${r.text}`, code: r.code }));
  return out;
}

export const MIN_REASON = 12;
export const hasReason = (reasons: Record<string, string>, key: string) => (reasons[key]?.trim().length ?? 0) >= MIN_REASON;

/** R comments for the code: what changed, and why. */
export function logComments(list: Change[], reasons: Record<string, string>): string {
  if (!list.length) return '';
  const lines = list.map(c => `#   ${c.sign} ${c.code}: ${reasons[c.key]?.trim() || 'no reason written yet'}`);
  return `# changes against the example model, and why (η Lab logbook)\n${lines.join('\n')}`;
}

/** Equalities released from the invariance ladder, as logbook entries. */
export function releases(d: Diagram, locks: Lock[], free: string[]) {
  const nm = (id?: string) => (id ? nameOf(d, id) : '');
  return locks.filter(l => free.includes(l.key)).map(l => ({
    key: l.key,
    text: l.kind === 'intercept' ? `intercept of ${nm(l.node)} free in every group`
      : l.kind === 'loading' ? `loading ${nm(l.factor)} → ${nm(l.node)} free in every group`
        : `residual variance of ${nm(l.node)} free in every group`,
    code: `group.partial = "${l.partial}"`,
  }));
}
