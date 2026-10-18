// Shared drawing parts of the path-diagram editors (classic workbench and studio):
// shapes, arrow geometry, what lavaan adds, invariance locks, image export.
import { type JSX, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react';
import { type DEdge, type Diagram, type DNode, type Structure } from './diagram.ts';
import { EQUAL, type Level, type Lock } from './invariance.ts';

export const VIEW = { w: 900, h: 500 };
export const LAT = { rx: 80, ry: 34 }, OBS = { w: 116, h: 46 };
export const GRID = 10;
export const MIN_SCALE = 0.62;            // below this, labels get too small to read: scroll instead
export type Mode = 'move' | 'arrow' | 'cov';
export interface Sel { nodes: string[]; edges: string[] }
export const NONE: Sel = { nodes: [], edges: [] };
export type Pt = { x: number; y: number };

/** Canvas size: at least the default view, growing with the drawing. */
export function extent(d: Diagram) {
  const xs = d.nodes.map(n => n.x), ys = d.nodes.map(n => n.y);
  return { w: Math.max(VIEW.w, ...xs.map(x => x + 100)), h: Math.max(VIEW.h, ...ys.map(y => y + 70)) };
}

export function boundary(n: DNode, tx: number, ty: number) {
  const dx = tx - n.x, dy = ty - n.y;
  if (dx === 0 && dy === 0) return { x: n.x, y: n.y };
  const t = n.kind === 'latent'
    ? 1 / Math.sqrt((dx / LAT.rx) ** 2 + (dy / LAT.ry) ** 2)
    : Math.min(OBS.w / 2 / Math.abs(dx || 1e-9), OBS.h / 2 / Math.abs(dy || 1e-9));
  return { x: n.x + dx * t, y: n.y + dy * t };
}

/** Geometry of an edge: its path and a point for a label. */
export function geometry(kind: 'cov' | 'line', a: DNode, b: DNode) {
  if (kind === 'cov') {
    const down = a.kind === 'observed' && b.kind === 'observed';   // item pairs curve below, factors above
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let nx = -(b.y - a.y) / dist, ny = (b.x - a.x) / dist;
    if ((down && ny < 0) || (!down && ny > 0)) { nx = -nx; ny = -ny; }
    const bulge = Math.min(120, 55 + dist * 0.25);
    const cx = mx + nx * bulge, cy = my + ny * bulge;
    const p1 = boundary(a, cx, cy), p2 = boundary(b, cx, cy);
    return { d: `M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`, mid: { x: (p1.x + 2 * cx + p2.x) / 4, y: (p1.y + 2 * cy + p2.y) / 4 } };
  }
  const p1 = boundary(a, b.x, b.y), p2 = boundary(b, a.x, a.y);
  return { d: `M${p1.x},${p1.y} L${p2.x},${p2.y}`, mid: { x: p1.x + (p2.x - p1.x) * 0.45, y: p1.y + (p2.y - p1.y) * 0.45 } };
}

export function EdgeShape({ e, a, b, selected, faded, onPointerDown, onContext }: {
  e: DEdge; a: DNode; b: DNode; selected?: boolean; faded?: boolean;
  onPointerDown?: (ev: RPointerEvent) => void; onContext?: (ev: RMouseEvent) => void;
}) {
  const g = geometry(e.kind === 'cov' ? 'cov' : 'line', a, b);
  const color = selected ? 'var(--link)' : faded ? 'var(--muted)' : 'var(--ink)';
  const marker = selected ? 'ah-sel' : faded ? 'ah-auto' : 'ah';
  return (
    <g data-edge={onPointerDown ? e.id : undefined} onPointerDown={onPointerDown} onContextMenu={onContext} style={{ cursor: onPointerDown ? 'pointer' : undefined }}>
      {onPointerDown && <path d={g.d} fill="none" stroke="transparent" strokeWidth="16" data-ui="1" />}
      <path d={g.d} fill="none" stroke={color} strokeWidth={selected ? 3.5 : faded ? 1.8 : 2.5} strokeDasharray={faded ? '5 4' : undefined}
        markerEnd={`url(#${marker})`} markerStart={e.kind === 'cov' ? `url(#${marker})` : undefined} />
    </g>
  );
}

export function NodeShape({ n, selected, pending, sub }: { n: DNode; selected?: boolean; pending?: boolean; sub?: string }) {
  const label = n.label.length > 18 ? n.label.slice(0, 17) + '…' : n.label || (n.kind === 'latent' ? 'factor' : 'item');
  const stroke = selected || pending ? 'var(--link)' : 'var(--ink)', sw = selected || pending ? 3.5 : 2.5;
  return (
    <>
      {n.kind === 'latent'
        ? <ellipse cx={n.x} cy={n.y} rx={LAT.rx} ry={LAT.ry} fill="var(--latent)" stroke={stroke} strokeWidth={sw} strokeDasharray={pending ? '6 4' : undefined} />
        : <rect x={n.x - OBS.w / 2} y={n.y - OBS.h / 2} width={OBS.w} height={OBS.h} rx="9" fill="var(--obs)" stroke={stroke} strokeWidth={sw} strokeDasharray={pending ? '6 4' : undefined} />}
      <text x={n.x} y={n.y + (sub ? -1 : 5)} textAnchor="middle" className={n.kind === 'latent' ? 'lbl-d' : 'lbl'} style={{ pointerEvents: 'none', fontSize: n.kind === 'latent' ? 15 : 13 }}>{label}</text>
      {sub && <text x={n.x} y={n.y + 15} textAnchor="middle" className="lbl-sub" style={{ pointerEvents: 'none' }}>{sub}</text>}
    </>
  );
}

export function Markers() {
  return (
    <defs>
      {[['ah', 'var(--ink)'], ['ah-sel', 'var(--link)'], ['ah-auto', 'var(--muted)']].map(([id, c]) => (
        <marker key={id} id={id} viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M0,1 L11,6 L0,11 z" fill={c} />
        </marker>
      ))}
    </defs>
  );
}

/** What lavaan adds without being asked: variances, automatic covariances, fixed values. */
export function Defaults({ d, s }: { d: Diagram; s: Structure }) {
  const byId = new Map(d.nodes.map(n => [n.id, n]));
  const tag = (p: Pt, text: string, key: string) => (
    <g key={key} style={{ pointerEvents: 'none' }}>
      <rect x={p.x - 16} y={p.y - 12} width="32" height="24" rx="12" fill="var(--sun)" stroke="var(--ink)" strokeWidth="2" />
      <text x={p.x} y={p.y + 5} textAnchor="middle" className="lbl-s" style={{ fontSize: 15, fontWeight: 800, fill: 'var(--ink)' }}>{text}</text>
    </g>
  );
  const out: JSX.Element[] = [];
  s.params.forEach((p, i) => {
    const a = byId.get(p.lhs), b = byId.get(p.rhs);
    if (!a || !b) return;
    if (p.role === 'loading' && p.fixed === 1) out.push(tag(geometry('line', a, b).mid, '1', `l${i}`));
    if (p.role === 'variance') {
      // a small two-headed loop: above factors, below boxes
      const up = a.kind === 'latent', s1 = up ? -1 : 1;
      const y0 = a.y + s1 * (up ? LAT.ry : OBS.h / 2), y1 = y0 + s1 * 34;
      const path = `M${a.x - 18},${y0} C${a.x - 30},${y1} ${a.x + 30},${y1} ${a.x + 18},${y0}`;
      out.push(<path key={`v${i}`} d={path} fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeDasharray="4 3" markerStart="url(#ah-auto)" markerEnd="url(#ah-auto)" style={{ pointerEvents: 'none' }} />);
      if (p.fixed === 0) out.push(tag({ x: a.x + 40, y: y1 - s1 * 8 }, '0', `v0${i}`));
      if (p.fixed === 'data') out.push(tag({ x: a.x + 40, y: y1 - s1 * 8 }, 'x', `vx${i}`));
    }
    if (p.role === 'covariance' && p.auto)
      out.push(<g key={`c${i}`} style={{ pointerEvents: 'none' }}><EdgeShape e={{ id: `auto${i}`, kind: 'cov', from: a.id, to: b.id }} a={a} b={b} faded /></g>);
  });
  return <g data-defaults="1">{out}</g>;
}

/** Across groups: which numbers the chosen rung of the invariance ladder holds equal. Click a lock to release it. */
export interface LockView { level: Level; locks: Lock[]; free: Set<string>; onToggle: (key: string) => void }
export const GREEK: Record<Lock['kind'], string> = { loading: 'λ', intercept: 'τ', residual: 'θ' };
export const WHAT: Record<Lock['kind'], string> = { loading: 'loading', intercept: 'intercept', residual: 'residual variance' };

export function LockLayer({ d, s, v }: { d: Diagram; s: Structure; v: LockView }) {
  const byId = new Map(d.nodes.map(n => [n.id, n]));
  const kinds = EQUAL[v.level];
  if (!kinds.length) return null;
  const chips: JSX.Element[] = [];
  if (kinds.includes('loading'))
    s.params.filter(p => p.role === 'loading' && p.fixed === 1).forEach((p, i) => {
      const a = byId.get(p.lhs), b = byId.get(p.rhs);
      if (!a || !b) return;
      const m = geometry('line', a, b).mid;
      chips.push(<g key={`m${i}`} style={{ pointerEvents: 'none' }}>
        <title>Marker loading: fixed to 1 in every group, so it is equal by construction</title>
        <rect x={m.x - 22} y={m.y - 13} width="44" height="26" rx="13" fill="var(--sun)" stroke="var(--ink)" strokeWidth="2" />
        <text x={m.x} y={m.y + 5} textAnchor="middle" className="lbl-s" style={{ fontSize: 14, fontWeight: 800, fill: 'var(--ink)' }}>λ=1</text>
      </g>);
    });
  v.locks.filter(l => kinds.includes(l.kind)).forEach(l => {
    const item = byId.get(l.node);
    if (!item) return;
    let at: Pt;
    if (l.kind === 'loading') { const f = byId.get(l.factor!); if (!f) return; at = geometry('line', f, item).mid; }
    else at = { x: item.x + (l.kind === 'intercept' ? -30 : 30), y: item.y + (item.kind === 'latent' ? LAT.ry : OBS.h / 2) + 20 };
    const released = v.free.has(l.key);
    const name = `${WHAT[l.kind]} of ${item.label}`;
    chips.push(
      <g key={l.key} className="lock" role="button" tabIndex={0} aria-pressed={!released}
        aria-label={`${name}: ${released ? 'free in every group' : 'equal across groups'}. Press to ${released ? 'hold it equal again' : 'release it'}.`}
        onPointerDown={e => { e.stopPropagation(); v.onToggle(l.key); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); v.onToggle(l.key); } }}>
        <title>{released ? `Released: the ${name} is estimated freely in each group (${l.partial})` : `Equal across groups: the ${name}. Click to release it.`}</title>
        <rect x={at.x - 22} y={at.y - 13} width="44" height="26" rx="13" fill={released ? 'var(--rose)' : 'var(--err)'}
          stroke={released ? 'var(--neg)' : 'var(--ink)'} strokeWidth="2" strokeDasharray={released ? '4 3' : undefined} />
        <text x={at.x} y={at.y + 5} textAnchor="middle" className="lbl-s" style={{ fontSize: 14, fontWeight: 800, fill: 'var(--ink)', pointerEvents: 'none' }}>
          {GREEK[l.kind]}{released ? '≠' : '='}
        </text>
      </g>,
    );
  });
  return <g data-locks="1">{chips}</g>;
}

/** Display only: the sidebar preview. */
export function Diagram({ d, height }: { d: Diagram; height?: number }) {
  const byId = new Map(d.nodes.map(n => [n.id, n]));
  const ext = extent(d);
  return (
    <svg viewBox={`0 0 ${ext.w} ${ext.h}`} width="100%" height={height} role="img" aria-label={`Your model: ${d.nodes.filter(n => n.kind === 'latent').length} latent variables, ${d.nodes.filter(n => n.kind === 'observed').length} items`}>
      <Markers />
      {d.edges.map(e => byId.get(e.from) && byId.get(e.to) && <EdgeShape key={e.id} e={e} a={byId.get(e.from)!} b={byId.get(e.to)!} />)}
      {d.nodes.map(n => <g key={n.id}><NodeShape n={n} /></g>)}
    </svg>
  );
}

/** The drawing as an SVG or PNG file, with colours resolved and editing aids removed. */
export async function renderImage(svg: SVGSVGElement, type: 'svg' | 'png', view?: { x: number; y: number; w: number; h: number }): Promise<Blob | null> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = svg.querySelectorAll('*'), dst = clone.querySelectorAll('*');
  const props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-family', 'font-size', 'font-weight', 'paint-order', 'stroke-linejoin'];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el), t = dst[i] as SVGElement;
    props.forEach(p => t.style.setProperty(p, cs.getPropertyValue(p)));
    // presentation attributes still name the app's CSS variables; other programs cannot resolve them
    ['fill', 'stroke'].forEach(a => { if (t.getAttribute(a)?.includes('var(')) t.setAttribute(a, cs.getPropertyValue(a)); });
  });
  clone.querySelectorAll('[data-ui]').forEach(n => n.remove());
  if (view) {
    // the studio draws into a panned and zoomed world: export the drawing itself, not the screen
    clone.querySelector('[data-world]')?.removeAttribute('transform');
    clone.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  }
  const vb = (clone.getAttribute('viewBox') ?? '0 0 900 500').split(' ').map(Number);
  const [x0, y0, w, h] = vb;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(w)); clone.setAttribute('height', String(h));
  clone.removeAttribute('class');
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', String(x0)); bg.setAttribute('y', String(y0));
  bg.setAttribute('width', String(w)); bg.setAttribute('height', String(h)); bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);
  const text = new XMLSerializer().serializeToString(clone);
  if (type === 'svg') return new Blob([text], { type: 'image/svg+xml' });
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w * 2; canvas.height = h * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

/** Save the drawing as SVG or PNG. */
export async function saveImage(svg: SVGSVGElement, type: 'svg' | 'png', view?: { x: number; y: number; w: number; h: number }) {
  const blob = await renderImage(svg, type, view);
  if (!blob) return;
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `my-model.${type}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Next item label for a factor: continue the numbering of its items (trust3 → trust4). */
export function nextItemLabel(d: Diagram, factor: DNode) {
  const items = d.edges.filter(e => e.from === factor.id && e.kind === 'loading').map(e => d.nodes.find(n => n.id === e.to)).filter(n => n?.kind === 'observed') as DNode[];
  const last = items[items.length - 1]?.label.match(/^(.*?)(\d+)$/);
  const taken = new Set(d.nodes.map(n => n.label));
  let base = last ? last[1] : (factor.label.trim().split(/\s+/)[0] || 'item').toLowerCase().slice(0, 8);
  let k = last ? Number(last[2]) + 1 : items.length + 1;
  if (!/^[a-z]/i.test(base)) base = 'item';
  while (taken.has(`${base}${k}`)) k++;
  return `${base}${k}`;
}

/** Pointer capture keeps a drag alive outside the shape; some pointers (pens, synthetic events) refuse it. */
export function capture(el: Element, id: number) { try { el.setPointerCapture(id); } catch { /* the drag still works inside the canvas */ } }
