// A model as a link (or a small file): the drawing, the question, groups, the ESS data
// it runs on and the R options, compressed into the URL hash — #/model?m=…
// Nothing goes to a server: the link itself carries the model. Own data files are never
// part of it (they stay in the tab that opened them).
import type { Diagram } from '../model/diagram.ts';
import { ML } from '../model/diagram.ts';
import { NO_GROUPS } from '../model/invariance.ts';
import type { YourModel } from '../state.ts';

/** The logbook travels too: whoever looks at the model sees the reasons as well as the drawing. */
export type Shared = Pick<YourModel, 'question' | 'n' | 'diagram' | 'groups' | 'data' | 'r' | 'reasons'> & { base?: Diagram };
interface Wire extends Shared { v: 1 }

const round = (d: Diagram): Diagram => ({ ...d, nodes: d.nodes.map(n => ({ ...n, x: Math.round(n.x), y: Math.round(n.y) })) });

export function toShared(m: YourModel): Shared {
  return {
    question: m.question, n: m.n, diagram: round(m.diagram), groups: m.groups, data: m.data?.source === 'course' ? m.data : null, r: m.r,
    reasons: m.reasons ?? {}, ...(m.base ? { base: round(m.base) } : {}),
  };
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
const toB64 = (b: Uint8Array) => btoa(Array.from(b, c => String.fromCharCode(c)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

export async function encodeModel(m: YourModel): Promise<string> {
  const json = JSON.stringify({ v: 1, ...toShared(m) } satisfies Wire);
  return toB64(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
}

/** Check what came in from a link or a file: a damaged one must not take the studio down. */
export function validShared(x: unknown): Shared | null {
  const w = x as Partial<Wire> | null;
  if (!w || typeof w !== 'object' || !w.diagram || !Array.isArray(w.diagram.nodes) || !Array.isArray(w.diagram.edges)) return null;
  const ids = new Set(w.diagram.nodes.map(n => n?.id));
  const nodes = w.diagram.nodes.filter(n => n && typeof n.id === 'string' && (n.kind === 'latent' || n.kind === 'observed') && typeof n.label === 'string')
    .map(n => ({ ...n, x: Number(n.x) || 0, y: Number(n.y) || 0 }));
  const edges = w.diagram.edges.filter(e => e && ids.has(e.from) && ids.has(e.to) && ['loading', 'path', 'cov'].includes(e.kind));
  const groups = { ...NO_GROUPS, ...(w.groups ?? {}) };
  if (!Array.isArray(groups.names) || !Array.isArray(groups.free)) Object.assign(groups, { names: NO_GROUPS.names, free: [] });
  const data = w.data && w.data.source === 'course' && typeof w.data.round === 'string' ? w.data : null;
  const reasons: Record<string, string> = {};
  if (w.reasons && typeof w.reasons === 'object') Object.entries(w.reasons).forEach(([k, v]) => { if (typeof v === 'string') reasons[k] = v.slice(0, 2000); });
  const base = w.base && Array.isArray(w.base.nodes) && Array.isArray(w.base.edges) ? w.base : undefined;
  return {
    question: typeof w.question === 'string' ? w.question : '', n: Number(w.n) > 0 ? Number(w.n) : 1000,
    diagram: { ...w.diagram, nodes, edges }, groups, data, r: { ...ML, ...(w.r ?? {}) }, reasons, ...(base ? { base } : {}),
  };
}

export async function decodeModel(code: string): Promise<Shared | null> {
  try {
    const bytes = await pipe(fromB64(code), new DecompressionStream('deflate-raw'));
    return validShared(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export const shareLink = (code: string) => `${window.location.origin}${window.location.pathname}#/model?m=${code}`;
/** The code in the current hash, if the page was opened from a shared link. */
export const linkCode = () => /[?&]m=([A-Za-z0-9_-]+)/.exec(window.location.hash)?.[1] ?? null;

export function modelFile(m: YourModel): Blob {
  return new Blob([JSON.stringify({ v: 1, app: 'eta-lab', ...toShared(m) }, null, 1)], { type: 'application/json' });
}
