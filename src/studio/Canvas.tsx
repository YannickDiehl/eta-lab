// The studio canvas: an endless, pannable, zoomable sheet on which the model is built by hand.
//
//   build     drag a factor or item from the rail onto the sheet, or click a tool and click the sheet,
//             or press F / I at the pointer, or double-click empty space
//   connect   hover a shape and pull one of its dots onto another shape (hold Alt for a covariance);
//             let go on empty space and a new item (from a factor) or a new factor (from an item) appears
//   name      new shapes open a name field at once; Tab adds the next item of the same factor
//   move      drag shapes, drag on empty space to select several, scroll to pan, pinch or ⌘-scroll to zoom
//   undo      ⌘Z / ⇧⌘Z, copy ⌘C, paste ⌘V, duplicate ⌘D, delete ⌫
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { addEdge, SLOT, structure, tidy, uid, type DEdge, type Diagram, type DNode, type Note } from '../model/diagram.ts';
import { boundary, capture, Defaults, EdgeShape, geometry, GRID, LAT, LockLayer, Markers, nextItemLabel, NodeShape, NONE, OBS, renderImage, saveImage, type LockView, type Pt, type Sel } from '../model/shapes.tsx';

export type Tool = 'select' | 'factor' | 'item' | 'arrow' | 'cov';
type Cam = { x: number; y: number; k: number };
const K_MIN = 0.2, K_MAX = 2.5;

export interface CanvasHandle { fit: () => void; exportImage: (type: 'png' | 'svg') => void; image: (type: 'png' | 'svg') => Promise<Blob | null>; focusNode: (id: string) => void; addVariable: (name: string) => void }

interface Props {
  d: Diagram;
  onChange: (d: Diagram) => void;
  notes: Note[];
  showDefaults: boolean;
  setShowDefaults: (v: boolean) => void;
  invariance?: LockView;
  highlight?: string | null;
  onNote: (nodeId: string) => void;
  handle: React.MutableRefObject<CanvasHandle | null>;
  empty?: React.ReactNode;           // what to show on an empty sheet
  estimates?: EstView;               // numbers to write on the drawing
  onSelection?: (nodeIds: string[]) => void;
}

/** Estimates to show on the sheet: per edge a number, per shape an R². */
export interface EstView { byEdge: Map<string, { text: string; weak: boolean; equal: boolean; fixed?: boolean }>; r2: Record<string, number> }

export const VAR_MIME = 'text/x-eta-variable';

/** Positions glide to their new place after tidy, undo or an import; new shapes pop in (CSS). */
function useGlide(target: Diagram, instant: React.MutableRefObject<boolean>) {
  const [shown, setShown] = useState(target);
  const last = useRef(target), raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = new Map(last.current.nodes.map(n => [n.id, n]));
    const far = target.nodes.some(n => { const o = from.get(n.id); return o && Math.hypot(o.x - n.x, o.y - n.y) > 1; });
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (instant.current || reduce || !far) { instant.current = false; last.current = target; setShown(target); return; }
    const t0 = performance.now(), T = 280;
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / T), e = 1 - (1 - u) ** 3;
      const frame = { ...target, nodes: target.nodes.map(n => { const o = from.get(n.id); return o ? { ...n, x: o.x + (n.x - o.x) * e, y: o.y + (n.y - o.y) * e } : n; }) };
      last.current = frame; setShown(frame);
      if (u < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, instant]);
  return shown;
}

/** Remove keys set to undefined (a cleared constraint leaves no trace in the saved model). */
function clean<T extends object>(o: T): T { return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T; }

/** .72 for standardized values (APA style), 0.72 otherwise. */
export const fmtNum = (v: number, std: boolean) => {
  if (!Number.isFinite(v)) return '–';
  const s = Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
  return std && Math.abs(v) < 1 ? s.replace(/^(-?)0\./, '$1.') : s;
};

const half = (n: DNode) => (n.kind === 'latent' ? { w: LAT.rx, h: LAT.ry } : { w: OBS.w / 2, h: OBS.h / 2 });
const dots = (n: DNode) => { const h = half(n); return [{ x: n.x, y: n.y - h.h }, { x: n.x + h.w, y: n.y }, { x: n.x, y: n.y + h.h }, { x: n.x - h.w, y: n.y }]; };

export function Canvas({ d, onChange, notes, showDefaults, setShowDefaults, invariance, highlight, onNote, handle, empty, estimates, onSelection }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [cam, setCam] = useState<Cam>({ x: 60, y: 40, k: 1 });
  const camRef = useRef(cam); camRef.current = cam;
  const [tool, setTool] = useState<Tool>('select');
  const [sel, setSel] = useState<Sel>(NONE);
  const [hover, setHover] = useState<string | null>(null);
  const [editing, setEditingState] = useState<string | null>(null);
  // the ref is the truth: a name field that is being removed may still report a blur for the old shape
  const editingRef = useRef<string | null>(null);
  const setEditing = (id: string | null) => { editingRef.current = id; setEditingState(id); };
  const [connect, setConnect] = useState<{ from: string; to: Pt; cov: boolean; target: string | null; moved: boolean } | null>(null);
  const [box, setBox] = useState<{ a: Pt; b: Pt; add: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ kind: 'latent' | 'observed'; screen: Pt; over: boolean } | null>(null);
  const [picker, setPicker] = useState<{ at: Pt } | null>(null);
  const [tip, setTip] = useState<{ node: string; text: string; level: Note['level'] } | null>(null);
  const [panning, setPanning] = useState(false);
  const [, force] = useState(0);

  const drag = useRef<{ start: Pt; orig: Map<string, Pt>; moved: boolean; base: Diagram } | null>(null);
  const pan = useRef<{ sx: number; sy: number; cam: Cam } | null>(null);
  const touches = useRef(new Map<number, Pt>());
  const pinch = useRef<{ dist: number; mid: Pt; cam: Cam } | null>(null);
  const space = useRef(false);
  const pointer = useRef<Pt | null>(null);
  const past = useRef<Diagram[]>([]), future = useRef<Diagram[]>([]);
  const own = useRef(new WeakSet<Diagram>([d]));
  const emitted = useRef(d);
  const instant = useRef(false);
  const renameStart = useRef<Diagram | null>(null);
  const clip = useRef<{ nodes: DNode[]; edges: DEdge[] } | null>(null);

  const shown = useGlide(d, instant);
  useEffect(() => { onSelection?.(sel.nodes); }, [sel.nodes.join('|')]);   // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(d.nodes.map(n => [n.id, n])), [d]);
  const shownById = useMemo(() => new Map(shown.nodes.map(n => [n.id, n])), [shown]);
  const s = useMemo(() => structure(d), [d]);
  const badges = useMemo(() => {
    const m = new Map<string, Note>();
    notes.forEach(n => { if (n.node && n.level !== 'ok' && (!m.has(n.node) || n.level === 'warn')) m.set(n.node, n); });
    return m;
  }, [notes]);

  // ---- size and camera
  useLayoutEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const camRaf = useRef(0);
  const glideCam = useCallback((to: Cam) => {
    cancelAnimationFrame(camRaf.current);
    const from = camRef.current, t0 = performance.now(), T = 320;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setCam(to); return; }
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / T), e = 1 - (1 - u) ** 3;
      setCam({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k + (to.k - from.k) * e });
      if (u < 1) camRaf.current = requestAnimationFrame(step);
    };
    camRaf.current = requestAnimationFrame(step);
  }, []);
  const bounds = (dd: Diagram) => {
    if (!dd.nodes.length) return null;
    const xs = dd.nodes.flatMap(n => [n.x - half(n).w, n.x + half(n).w]), ys = dd.nodes.flatMap(n => [n.y - half(n).h - 40, n.y + half(n).h + 50]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  const fitTo = useCallback((dd: Diagram, animate = true) => {
    const b = bounds(dd), el = wrap.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight, left = W < 600 ? 84 : 112, right = W < 600 ? 12 : 28, top = 76, bottom = 64;   // keep clear of the rail, the df badge and the hint
    if (!b) { const to = { x: left + 40, y: top + 30, k: 1 }; animate ? glideCam(to) : setCam(to); return; }
    const k = Math.max(K_MIN, Math.min(1.15, (W - left - right) / b.w, (H - top - bottom) / b.h));
    const to = { x: left + (W - left - right - b.w * k) / 2 - b.x * k, y: top + (H - top - bottom - b.h * k) / 2 - b.y * k, k };
    animate ? glideCam(to) : setCam(to);
  }, [glideCam]);
  useEffect(() => { fitTo(d, false); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const toWorld = (cx: number, cy: number): Pt => {
    const r = svg.current!.getBoundingClientRect(), c = camRef.current;
    return { x: (cx - r.left - c.x) / c.k, y: (cy - r.top - c.y) / c.k };
  };
  const toScreen = (p: Pt): Pt => ({ x: p.x * cam.k + cam.x, y: p.y * cam.k + cam.y });
  const zoomAt = (sx: number, sy: number, k: number) => {
    const c = camRef.current, nk = Math.max(K_MIN, Math.min(K_MAX, k));
    setCam({ k: nk, x: sx - (sx - c.x) * (nk / c.k), y: sy - (sy - c.y) * (nk / c.k) });
  };

  // wheel: scroll pans, pinch / ⌘-scroll zooms (needs a non-passive listener)
  useEffect(() => {
    const el = svg.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - r.left, e.clientY - r.top, camRef.current.k * Math.exp(-e.deltaY * 0.0045));
      else setCam(c => ({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---- history (changes from outside — example, import — are undoable too and get framed)
  useEffect(() => {
    if (!own.current.has(d)) {
      past.current.push(emitted.current); future.current = [];
      own.current.add(d);
      setSel(NONE); setEditing(null); setConnect(null);
      requestAnimationFrame(() => fitTo(d));
      force(x => x + 1);
    }
    emitted.current = d;
  }, [d, fitTo]);
  const keepFocus = () => requestAnimationFrame(() => {
    const a = document.activeElement;
    if (!a || a === document.body || !wrap.current?.contains(a)) svg.current?.focus({ preventScroll: true });
  });
  const emit = (next: Diagram, now = false) => { own.current.add(next); if (now) instant.current = true; onChange(next); keepFocus(); };
  const commit = (next: Diagram, base: Diagram = d, now = false) => {
    past.current.push(base); if (past.current.length > 150) past.current.shift();
    future.current = [];
    emit(next, now);
  };
  const undo = () => { const prev = past.current.pop(); if (prev) { future.current.push(d); emit(prev); setSel(NONE); setEditing(null); } };
  const redo = () => { const next = future.current.pop(); if (next) { past.current.push(d); emit(next); setSel(NONE); setEditing(null); } };

  // ---- building
  const snap = (v: number) => Math.round(v / GRID) * GRID;
  const freshLabel = (kind: 'latent' | 'observed', dd = d) => {
    const taken = new Set(dd.nodes.map(n => n.label));
    let k = dd.nodes.filter(n => n.kind === kind).length + 1;
    const make = () => (kind === 'latent' ? `Factor ${k}` : `item${k}`);
    while (taken.has(make())) k++;
    return make();
  };
  const viewCenter = (): Pt => toWorld(svg.current!.getBoundingClientRect().left + size.w / 2, svg.current!.getBoundingClientRect().top + size.h / 2);
  /** Bring a shape into view if it was created or moved off-screen. */
  const reveal = (p: Pt) => {
    const el = wrap.current;
    if (!el) return;
    const c = camRef.current, sx = p.x * c.k + c.x, sy = p.y * c.k + c.y;
    const W = el.clientWidth, H = el.clientHeight, mx = 120, my = 90;
    const dx = sx < 80 + mx ? 80 + mx - sx : sx > W - mx ? W - mx - sx : 0;
    const dy = sy < my ? my - sy : sy > H - my ? H - my - sy : 0;
    if (dx || dy) glideCam({ ...c, x: c.x + dx, y: c.y + dy });
  };
  const add = (kind: 'latent' | 'observed', at?: Pt, rename = true) => {
    const p = at ?? viewCenter();
    const n: DNode = { id: uid('n'), kind, label: freshLabel(kind), x: snap(p.x), y: snap(p.y) };
    commit({ ...d, nodes: [...d.nodes, n] });
    setSel({ nodes: [n.id], edges: [] }); setTool('select'); setPicker(null);
    reveal(n);
    if (rename) setEditing(n.id);
    return n;
  };
  /** A new item for a factor, placed next to its other items; returns the new diagram. */
  const withItem = (dd: Diagram, fid: string, at?: Pt): { dd: Diagram; id: string } | null => {
    const f = dd.nodes.find(n => n.id === fid);
    if (!f || f.kind !== 'latent') return null;
    const own = dd.edges.filter(e => e.from === fid && e.kind === 'loading').map(e => dd.nodes.find(n => n.id === e.to)).filter(n => n?.kind === 'observed') as DNode[];
    let x = at?.x ?? (own.length ? Math.max(...own.map(n => n.x)) + SLOT : f.x), y = at?.y ?? (own.length ? Math.max(...own.map(n => n.y)) : f.y + 200);
    if (!at) while (dd.nodes.some(n => Math.abs(n.x - x) < 120 && Math.abs(n.y - y) < 50)) x += SLOT;
    const it: DNode = { id: uid('n'), kind: 'observed', label: nextItemLabel(dd, f), x: snap(x), y: snap(y) };
    return { dd: { nodes: [...dd.nodes, it], edges: [...dd.edges, { id: uid('e'), kind: 'loading', from: fid, to: it.id }] }, id: it.id };
  };
  const addItemTo = (fid: string, at?: Pt, base: Diagram = d) => {
    const r = withItem(base, fid, at);
    if (!r) return;
    commit(r.dd);
    setSel({ nodes: [r.id], edges: [] }); setEditing(r.id);
    reveal(r.dd.nodes[r.dd.nodes.length - 1]);
  };
  const link = (from: string, to: string, cov: boolean) => {
    if (from === to) return;
    const next = addEdge(d, from, to, cov);
    if (next !== d) { commit(next); setSel({ nodes: [], edges: [next.edges[next.edges.length - 1].id] }); }
  };
  const remove = (what: Sel = sel) => {
    if (!what.nodes.length && !what.edges.length) return;
    const gone = new Set(what.nodes);
    commit({ nodes: d.nodes.filter(n => !gone.has(n.id)), edges: d.edges.filter(e => !gone.has(e.from) && !gone.has(e.to) && !what.edges.includes(e.id)) });
    setSel(NONE); setEditing(null);
  };
  // ---- constraints: fixed values and equality labels on arrows and variances
  const [consOpen, setConsOpen] = useState(false);
  useEffect(() => { setConsOpen(false); }, [sel.nodes.join('|'), sel.edges.join('|')]);   // eslint-disable-line react-hooks/exhaustive-deps
  const cleanLabel = (s: string) => { const c = s.trim().replace(/[^A-Za-z0-9_.]+/g, '_'); return c ? (/^[A-Za-z]/.test(c) ? c : `l_${c}`) : undefined; };
  const setEdge = (eid: string, patch: Partial<DEdge>) => commit({ ...d, edges: d.edges.map(e => (e.id === eid ? clean({ ...e, ...patch }) : e)) });
  const setNode = (id: string, patch: Partial<DNode>) => commit({ ...d, nodes: d.nodes.map(n => (n.id === id ? clean({ ...n, ...patch }) : n)) });
  const isMarker = (e: DEdge) => !d.stdlv && e.fix === undefined && !e.free && s.load.filter(x => x.from === e.from)[0]?.id === e.id;
  const shortOf = (id: string) => (byId.get(id)?.label ?? 'f').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 6) || 'f';
  /** Day 3: congeneric → tau-equivalent (equal loadings) → parallel (and equal residual variances). */
  const preset = (fid: string, kind: 'tau' | 'parallel' | 'clear') => {
    const items = new Set(s.load.filter(e => e.from === fid && !s.latent.includes(e.to)).map(e => e.to));
    const ls = new Set(s.load.filter(e => e.from === fid && items.has(e.to)).map(e => e.id));
    commit({
      ...d,
      edges: d.edges.map(e => (ls.has(e.id) ? clean({ ...e, label: kind === 'clear' ? undefined : `l_${shortOf(fid)}`, fix: undefined, free: undefined }) : e)),
      nodes: d.nodes.map(n => (items.has(n.id) ? clean({ ...n, varLabel: kind === 'parallel' ? `e_${shortOf(fid)}` : undefined, varFix: undefined }) : n)),
    });
  };
  const toggleKind = (eid: string) => commit({ ...d, edges: d.edges.map(e => (e.id === eid ? { ...e, kind: e.kind === 'loading' ? 'path' : 'loading' } : e)) });
  const reverse = (eid: string) => commit({ ...d, edges: d.edges.map(e => (e.id === eid ? { ...e, from: e.to, to: e.from, kind: 'path' } : e)) });
  const makeCov = (eid: string) => commit({ ...d, edges: d.edges.map(e => (e.id === eid ? { ...e, kind: e.kind === 'cov' ? (byId.get(e.from)?.kind === 'latent' && byId.get(e.to)?.kind === 'observed' ? 'loading' : 'path') : 'cov' } : e)) });
  const copy = () => {
    const ids = new Set(sel.nodes);
    if (!ids.size) return;
    clip.current = { nodes: d.nodes.filter(n => ids.has(n.id)), edges: d.edges.filter(e => ids.has(e.from) && ids.has(e.to)) };
  };
  const paste = (shift = 40) => {
    const c = clip.current;
    if (!c) return;
    const map = new Map(c.nodes.map(n => [n.id, uid('n')]));
    let dd = d;
    const taken = new Set(dd.nodes.map(n => n.label));
    const nodes = c.nodes.map(n => {
      let label = n.label;
      if (taken.has(label)) { const m = label.match(/^(.*?)(\d+)$/); let k = m ? Number(m[2]) + 1 : 2; const b = m ? m[1] : `${label} `; while (taken.has(`${b}${k}`)) k++; label = `${b}${k}`; }
      taken.add(label);
      return { ...n, id: map.get(n.id)!, label, x: n.x + shift, y: n.y + shift };
    });
    const edges = c.edges.map(e => ({ ...e, id: uid('e'), from: map.get(e.from)!, to: map.get(e.to)! }));
    dd = { nodes: [...dd.nodes, ...nodes], edges: [...dd.edges, ...edges] };
    commit(dd);
    clip.current = { nodes: nodes, edges };
    setSel({ nodes: nodes.map(n => n.id), edges: [] });
  };

  // ---- variables from the data panel: dropped on a factor they become its item, elsewhere a free box
  const placeVariable = (name: string, at?: Pt, onto?: string | null) => {
    const existing = d.nodes.find(n => n.kind === 'observed' && n.label === name);
    const factor = onto ? byId.get(onto) : sel.nodes.length === 1 && byId.get(sel.nodes[0])?.kind === 'latent' ? byId.get(sel.nodes[0]) : undefined;
    if (existing && factor?.kind === 'latent') { link(factor.id, existing.id, false); return; }
    if (existing) { handle.current?.focusNode(existing.id); return; }
    if (factor?.kind === 'latent') {
      const r = withItem(d, factor.id, onto && at ? at : undefined);
      if (!r) return;
      const dd = { ...r.dd, nodes: r.dd.nodes.map(n => (n.id === r.id ? { ...n, label: name } : n)) };
      commit(dd); setSel({ nodes: [factor.id], edges: [] });
      reveal(dd.nodes[dd.nodes.length - 1]);
      return;
    }
    const p = at ?? viewCenter();
    const n: DNode = { id: uid('n'), kind: 'observed', label: name, x: snap(p.x), y: snap(p.y) };
    commit({ ...d, nodes: [...d.nodes, n] });
    setSel({ nodes: [n.id], edges: [] }); reveal(n);
  };

  // ---- renaming in place
  const startRename = (id: string) => { setEditing(id); setSel({ nodes: [id], edges: [] }); };
  const rename = (id: string, label: string) => { if (!renameStart.current) renameStart.current = d; emit({ ...d, nodes: d.nodes.map(n => (n.id === id ? { ...n, label } : n)) }, true); };
  const endRename = (next?: 'item') => {
    const id = editingRef.current;
    if (!id) return;
    if (renameStart.current && renameStart.current !== d) { past.current.push(renameStart.current); future.current = []; }
    renameStart.current = null;
    setEditing(null);
    if (next && id) {
      // Tab: keep going — the next item of the same factor (or the first item of a factor)
      const n = byId.get(id);
      const f = n?.kind === 'latent' ? n.id : d.edges.find(e => e.to === id && e.kind === 'loading')?.from;
      if (f) { addItemTo(f); return; }
    }
    svg.current?.focus({ preventScroll: true });
  };

  // ---- pointer
  const nodeAt = (cx: number, cy: number) => (document.elementFromPoint(cx, cy)?.closest('[data-node]') as SVGGElement | null)?.dataset.node ?? null;
  const startPan = (e: RPointerEvent) => { pan.current = { sx: e.clientX, sy: e.clientY, cam: camRef.current }; setPanning(true); if (svg.current) capture(svg.current, e.pointerId); };
  const trackTouch = (e: RPointerEvent) => {
    if (e.pointerType !== 'touch') return false;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      const r = svg.current!.getBoundingClientRect();
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top }, cam: camRef.current };
      drag.current = null; setBox(null); setConnect(null); pan.current = null;
      return true;
    }
    return false;
  };
  const onCanvasDown = (e: RPointerEvent) => {
    pointer.current = toWorld(e.clientX, e.clientY);
    setPicker(null); setTip(null);
    if (trackTouch(e)) return;
    svg.current?.focus({ preventScroll: true });
    if (editing) endRename();
    if (e.button === 1 || space.current || (e.pointerType === 'touch' && tool === 'select')) { startPan(e); return; }
    if (e.button !== 0) return;
    const p = toWorld(e.clientX, e.clientY);
    if (tool === 'factor' || tool === 'item') { add(tool === 'factor' ? 'latent' : 'observed', p); return; }
    if (tool === 'arrow' || tool === 'cov') { setConnect(null); return; }
    if (svg.current) capture(svg.current, e.pointerId);
    setBox({ a: p, b: p, add: e.shiftKey || e.metaKey || e.ctrlKey });
  };
  const onNodeDown = (e: RPointerEvent, n: DNode) => {
    if (trackTouch(e)) return;
    if (e.button !== 0) return;
    e.stopPropagation(); setPicker(null); setTip(null);
    if (editing && editing !== n.id) endRename();
    if (space.current) { startPan(e); return; }
    capture(e.currentTarget as Element, e.pointerId);
    if (tool === 'arrow' || tool === 'cov') {
      if (connect && connect.from !== n.id) { link(connect.from, n.id, connect.cov); setConnect(null); return; }
      setConnect({ from: n.id, to: toWorld(e.clientX, e.clientY), cov: tool === 'cov', target: null, moved: false });
      return;
    }
    (e.currentTarget as SVGGElement).focus({ preventScroll: true });
    const multi = e.shiftKey || e.metaKey || e.ctrlKey;
    let nodes = sel.nodes;
    if (multi) nodes = nodes.includes(n.id) ? nodes.filter(x => x !== n.id) : [...nodes, n.id];
    else if (!nodes.includes(n.id)) nodes = [n.id];
    setSel({ nodes, edges: multi ? sel.edges : [] });
    if (!nodes.includes(n.id)) return;
    drag.current = { start: toWorld(e.clientX, e.clientY), orig: new Map(nodes.map(id => [id, { x: byId.get(id)!.x, y: byId.get(id)!.y }])), moved: false, base: d };
  };
  const onDotDown = (e: RPointerEvent, n: DNode) => {
    if (e.button !== 0) return;
    e.stopPropagation(); setPicker(null);
    capture(e.currentTarget as Element, e.pointerId);
    setConnect({ from: n.id, to: toWorld(e.clientX, e.clientY), cov: e.altKey || tool === 'cov', target: null, moved: false });
  };
  const onEdgeDown = (e: RPointerEvent, edge: DEdge) => {
    if (e.button !== 0 || tool !== 'select') return;
    e.stopPropagation(); setPicker(null);
    svg.current?.focus({ preventScroll: true });
    const multi = e.shiftKey || e.metaKey || e.ctrlKey;
    setSel(multi ? { nodes: sel.nodes, edges: sel.edges.includes(edge.id) ? sel.edges.filter(x => x !== edge.id) : [...sel.edges, edge.id] } : { nodes: [], edges: [edge.id] });
  };
  const onMove = (e: RPointerEvent) => {
    pointer.current = toWorld(e.clientX, e.clientY);
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pc = pinch.current;
      if (pc && touches.current.size >= 2) {
        const [a, b] = [...touches.current.values()];
        const r = svg.current!.getBoundingClientRect();
        const mid = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
        const k = Math.max(K_MIN, Math.min(K_MAX, pc.cam.k * Math.hypot(a.x - b.x, a.y - b.y) / pc.dist));
        const wx = (pc.mid.x - pc.cam.x) / pc.cam.k, wy = (pc.mid.y - pc.cam.y) / pc.cam.k;
        setCam({ k, x: mid.x - wx * k, y: mid.y - wy * k });
        return;
      }
    }
    if (pan.current) { const p = pan.current; setCam({ ...p.cam, x: p.cam.x + e.clientX - p.sx, y: p.cam.y + e.clientY - p.sy }); return; }
    const p = pointer.current;
    const g = drag.current;
    if (g) {
      const dx = p.x - g.start.x, dy = p.y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) * camRef.current.k < 4) return;
      g.moved = true;
      emit({ ...g.base, nodes: g.base.nodes.map(n => { const o = g.orig.get(n.id); return o ? { ...n, x: o.x + dx, y: o.y + dy } : n; }) }, true);
      return;
    }
    if (connect) {
      const target = nodeAt(e.clientX, e.clientY);
      const from = byId.get(connect.from);
      const moved = connect.moved || (!!from && Math.hypot(p.x - from.x, p.y - from.y) > half(from).w + 10);
      setConnect({ ...connect, to: p, target: target && target !== connect.from ? target : null, cov: connect.cov || e.altKey ? (tool === 'cov' || e.altKey) : false, moved });
    }
    if (box) setBox({ ...box, b: p });
  };
  const onUp = (e: RPointerEvent) => {
    touches.current.delete(e.pointerId);
    if (pinch.current && touches.current.size < 2) { pinch.current = null; return; }
    if (pan.current) { pan.current = null; setPanning(false); return; }
    const g = drag.current;
    drag.current = null;
    if (g?.moved) commit({ ...d, nodes: d.nodes.map(n => (g.orig.has(n.id) ? { ...n, x: snap(n.x), y: snap(n.y) } : n)) }, g.base, true);
    if (connect) {
      const target = nodeAt(e.clientX, e.clientY);
      if (target && target !== connect.from) { link(connect.from, target, connect.cov); setConnect(null); }
      else if (!target && connect.moved && !connect.cov) {
        // let go on empty space: grow the model in the direction of the pull
        const from = byId.get(connect.from)!, at = toWorld(e.clientX, e.clientY);
        if (from.kind === 'latent') addItemTo(from.id, at);
        else {
          const f: DNode = { id: uid('n'), kind: 'latent', label: freshLabel('latent'), x: snap(at.x), y: snap(at.y) };
          commit({ nodes: [...d.nodes, f], edges: [...d.edges, { id: uid('e'), kind: 'loading', from: f.id, to: from.id }] });
          setSel({ nodes: [f.id], edges: [] }); setEditing(f.id);
        }
        setConnect(null);
      } else if (connect.moved || tool === 'select') setConnect(null);   // a click on a shape in arrow mode keeps waiting for the second click
    }
    if (box) {
      const x0 = Math.min(box.a.x, box.b.x), x1 = Math.max(box.a.x, box.b.x), y0 = Math.min(box.a.y, box.b.y), y1 = Math.max(box.a.y, box.b.y);
      const tiny = (x1 - x0) * cam.k < 4 && (y1 - y0) * cam.k < 4;
      const inside = tiny ? [] : d.nodes.filter(n => n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1).map(n => n.id);
      setSel(box.add ? { nodes: [...new Set([...sel.nodes, ...inside])], edges: sel.edges } : { nodes: inside, edges: [] });
      setBox(null);
    }
  };
  const onCancel = (e: RPointerEvent) => {
    touches.current.delete(e.pointerId); pinch.current = null; pan.current = null; setPanning(false);
    if (drag.current?.moved) emit(drag.current.base, true);
    drag.current = null; setBox(null); setConnect(null);
  };

  // ---- dragging a new shape in from the rail
  const railDown = (e: RPointerEvent, kind: 'latent' | 'observed', t: Tool) => {
    if (e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
      moved = true;
      const r = svg.current!.getBoundingClientRect();
      const over = ev.clientX > r.left + 64 && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
      setGhost({ kind, screen: { x: ev.clientX - r.left, y: ev.clientY - r.top }, over });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setGhost(null);
      if (!moved) { setTool(tool === t ? 'select' : t); return; }
      const r = svg.current!.getBoundingClientRect();
      if (ev.clientX > r.left + 64 && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom) add(kind, toWorld(ev.clientX, ev.clientY));
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  // ---- keyboard
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
    if (t.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (e.key === ' ') { e.preventDefault(); if (!space.current) { space.current = true; force(x => x + 1); } return; }
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'a') { e.preventDefault(); setSel({ nodes: d.nodes.map(n => n.id), edges: d.edges.map(x => x.id) }); return; }
    if (mod && k === 'c') { copy(); return; }
    if (mod && k === 'v') { e.preventDefault(); paste(); return; }
    if (mod && k === 'd') { e.preventDefault(); copy(); paste(); return; }
    if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomAt(size.w / 2, size.h / 2, cam.k * 1.2); return; }
    if (mod && k === '-') { e.preventDefault(); zoomAt(size.w / 2, size.h / 2, cam.k / 1.2); return; }
    if (mod || e.altKey) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); return; }
    if (e.key === 'Escape') { setConnect(null); setPicker(null); setTool('select'); setSel(NONE); return; }
    if (e.key === '!' || (e.shiftKey && k === '1')) { fitTo(d); return; }
    const focusNode = (t.closest?.('[data-node]') as SVGGElement | null)?.dataset.node;
    if (e.key === 'Enter') {
      e.preventDefault();
      const id = focusNode ?? (sel.nodes.length === 1 ? sel.nodes[0] : null);
      if (!id) return;
      if (tool === 'arrow' || tool === 'cov') { if (connect && connect.from !== id) { link(connect.from, id, connect.cov); setConnect(null); } else setConnect({ from: id, to: byId.get(id)!, cov: tool === 'cov', target: null, moved: false }); }
      else startRename(id);
      return;
    }
    if (e.key === 'Tab' && d.nodes.length) {
      // move the selection through the shapes
      e.preventDefault();
      const i = d.nodes.findIndex(n => n.id === sel.nodes[0]);
      const n = d.nodes[(i + (e.shiftKey ? -1 : 1) + d.nodes.length) % d.nodes.length];
      setSel({ nodes: [n.id], edges: [] });
      (svg.current?.querySelector(`[data-node="${n.id}"]`) as SVGGElement | null)?.focus({ preventScroll: true });
      return;
    }
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dirs[e.key] && sel.nodes.length) {
      e.preventDefault();
      const step = e.shiftKey ? 50 : GRID, [dx, dy] = dirs[e.key];
      commit({ ...d, nodes: d.nodes.map(n => (sel.nodes.includes(n.id) ? { ...n, x: n.x + dx * step, y: n.y + dy * step } : n)) }, d, true);
      return;
    }
    const at = pointer.current ?? undefined;
    if (k === 'f' || k === 'l') { e.preventDefault(); add('latent', at); }
    else if (k === 'i' || k === 'o') { e.preventDefault(); add('observed', at); }
    else if (k === 'a') { setTool('arrow'); setConnect(null); }
    else if (k === 'c') { setTool('cov'); setConnect(null); }
    else if (k === 'v') { setTool('select'); setConnect(null); }
    else if (k === 't') commit(tidy(d));
    else if (k === 'd') setShowDefaults(!showDefaults);
    else if (e.key === 'F2' && sel.nodes.length === 1) startRename(sel.nodes[0]);
  };
  const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') { space.current = false; force(x => x + 1); } };

  // ---- outside handles
  handle.current = {
    addVariable: (name) => placeVariable(name),
    fit: () => fitTo(d),
    exportImage: (type) => { const b = bounds(d); if (svg.current && b) saveImage(svg.current, type, { x: b.x - 60, y: b.y - 50, w: b.w + 120, h: b.h + 100 }); },
    image: async (type) => { const b = bounds(d); return svg.current && b ? renderImage(svg.current, type, { x: b.x - 60, y: b.y - 50, w: b.w + 120, h: b.h + 100 }) : null; },
    focusNode: (id) => {
      const n = byId.get(id), el = wrap.current;
      if (!n || !el) return;
      setSel({ nodes: [id], edges: [] });
      const c = camRef.current;
      const sx = n.x * c.k + c.x, sy = n.y * c.k + c.y;
      if (sx < 90 || sx > el.clientWidth - 40 || sy < 80 || sy > el.clientHeight - 80) glideCam({ ...c, x: el.clientWidth / 2 - n.x * c.k, y: el.clientHeight / 2 - n.y * c.k });
    },
  };

  // ---- what to draw
  const selNode = sel.nodes.length === 1 && !sel.edges.length ? byId.get(sel.nodes[0]) : undefined;
  const selEdge = sel.edges.length === 1 && !sel.nodes.length ? d.edges.find(e => e.id === sel.edges[0]) : undefined;
  const nSel = sel.nodes.length + sel.edges.length;
  const showDots = (id: string) => tool === 'select' && !editing && !drag.current?.moved && !box && (hover === id || (sel.nodes.length === 1 && sel.nodes[0] === id) || connect?.from === id);
  const from = connect ? shownById.get(connect.from) : undefined;
  // the name field must exist in the very render that asks for it (a new shape is not in the gliding copy yet)
  const edit = editing ? (shownById.get(editing) ?? byId.get(editing)) : undefined;
  const hint = connect
    ? (connect.target ? `Let go to ${connect.cov ? 'let them covary' : 'draw the arrow'}.` : connect.moved && !connect.cov ? `Let go on empty space for a new ${from?.kind === 'latent' ? 'item' : 'factor'}${connect.cov ? '' : ' · hold Alt for ↔'}.` : tool === 'select' ? 'Pull onto another shape.' : 'Now click the second shape · Esc cancels.')
    : tool === 'factor' || tool === 'item' ? `Click where the ${tool === 'factor' ? 'factor' : 'item'} should go.`
      : tool === 'arrow' ? 'Click or drag from one shape to another.'
        : tool === 'cov' ? 'Click or drag between two shapes that covary.'
          : hover ? 'Pull a dot to connect · double-click to rename.'
            : 'Scroll to pan · ⌘-scroll or pinch to zoom · double-click empty space to add.';

  // toolbar above the selection, in screen coordinates
  let bar: Pt | null = null;
  if (!editing && !drag.current?.moved && !connect && !box && nSel) {
    if (selEdge) { const a = shownById.get(selEdge.from), b = shownById.get(selEdge.to); if (a && b) { const m = geometry(selEdge.kind === 'cov' ? 'cov' : 'line', a, b).mid; bar = toScreen(m); } }
    else {
      const ns = sel.nodes.map(id => shownById.get(id)).filter(Boolean) as DNode[];
      if (ns.length) bar = toScreen({ x: ns.reduce((a, n) => a + n.x, 0) / ns.length, y: Math.min(...ns.map(n => n.y - half(n).h)) });
    }
  }
  const sLoad = (e: DEdge) => s.load.some(x => x.id === e.id);

  return (
    <div className={`sc ${panning || space.current ? 'is-panning' : ''} tool-${tool}`} ref={wrap} onKeyDown={onKey} onKeyUp={onKeyUp}
      onScroll={e => { e.currentTarget.scrollLeft = 0; e.currentTarget.scrollTop = 0; }}
      onDragOver={e => { if (e.dataTransfer.types.includes(VAR_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; const id = nodeAt(e.clientX, e.clientY); setHover(id && byId.get(id)?.kind === 'latent' ? id : null); } }}
      onDrop={e => {
        const name = e.dataTransfer.getData(VAR_MIME);
        if (!name) return;
        e.preventDefault();
        const id = nodeAt(e.clientX, e.clientY);
        placeVariable(name, toWorld(e.clientX, e.clientY), id && byId.get(id)?.kind === 'latent' ? id : null);
      }}>
      <svg ref={svg} className="sc-svg" tabIndex={0} role="application"
        aria-label="Model canvas. F adds a factor, I an item, A arrows, C covariances, Enter renames, Delete removes, Ctrl+Z undoes."
        onPointerDown={onCanvasDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
        onPointerLeave={() => { if (!drag.current && !box && !connect) pointer.current = null; }}
        onDoubleClick={e => { if (!(e.target as Element).closest('[data-node],[data-edge],.lock')) setPicker({ at: toWorld(e.clientX, e.clientY) }); }}
        onContextMenu={e => { e.preventDefault(); const id = nodeAt(e.clientX, e.clientY); if (id) setSel({ nodes: [id], edges: [] }); else setPicker({ at: toWorld(e.clientX, e.clientY) }); }}>
        <defs>
          <pattern id="sc-grid" width={24 * cam.k} height={24 * cam.k} patternUnits="userSpaceOnUse" x={cam.x % (24 * cam.k)} y={cam.y % (24 * cam.k)}>
            <circle cx={1.2} cy={1.2} r={1.2} fill="var(--grid)" />
          </pattern>
        </defs>
        <Markers />
        <rect width="100%" height="100%" fill="url(#sc-grid)" data-ui="1" />
        <g data-world transform={`translate(${cam.x} ${cam.y}) scale(${cam.k})`}>
          {showDefaults && <Defaults d={shown} s={structure(shown)} />}
          {shown.edges.map(e => shownById.get(e.from) && shownById.get(e.to) && (
            <g key={e.id} className={`sc-edge ${sel.edges.includes(e.id) ? 'on' : ''}`}>
              <EdgeShape e={e} a={shownById.get(e.from)!} b={shownById.get(e.to)!} selected={sel.edges.includes(e.id)}
                onPointerDown={ev => onEdgeDown(ev, e)} onContext={ev => { ev.preventDefault(); ev.stopPropagation(); setSel({ nodes: [], edges: [e.id] }); }} />
            </g>
          ))}
          {shown.edges.filter(e => e.moderator && e.kind === 'path').map(e => {
            // a latent interaction: the moderator points at the middle of the path it changes
            const a = shownById.get(e.from), b = shownById.get(e.to), z = shownById.get(e.moderator!);
            if (!a || !b || !z) return null;
            const p1 = boundary(a, b.x, b.y), p2 = boundary(b, a.x, a.y), mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const zp = boundary(z, mid.x, mid.y), len = Math.hypot(mid.x - zp.x, mid.y - zp.y) || 1;
            const end = { x: mid.x - (mid.x - zp.x) / len * 6, y: mid.y - (mid.y - zp.y) / len * 6 };
            return (
              <g key={`mod-${e.id}`} className="mod" style={{ pointerEvents: 'none' }}>
                <line x1={zp.x} y1={zp.y} x2={end.x} y2={end.y} markerEnd="url(#ah)" />
                <circle cx={mid.x} cy={mid.y} r={9} /><text x={mid.x} y={mid.y + 4.5} textAnchor="middle">×</text>
              </g>
            );
          })}
          {shown.edges.map(e => {
            if (e.fix === undefined && !e.label && !e.free) return null;
            if (estimates?.byEdge.has(e.id)) return null;          // with numbers on the sheet, the number's own label tells it
            const a = shownById.get(e.from), b = shownById.get(e.to);
            if (!a || !b) return null;
            let pt: Pt;
            if (e.kind === 'cov') { const m = geometry('cov', a, b).mid; pt = { x: m.x, y: m.y + (a.kind === 'observed' ? 18 : -18) }; }
            else { const p1 = boundary(a, b.x, b.y), p2 = boundary(b, a.x, a.y); pt = { x: p1.x + (p2.x - p1.x) * 0.34, y: p1.y + (p2.y - p1.y) * 0.34 }; }
            const text = [e.label, e.fix !== undefined ? `=${e.fix}` : e.free ? 'NA' : ''].filter(Boolean).join(' ');
            const w = Math.max(26, text.length * 7.4 + 12);
            return <g key={`c-${e.id}`} className="cons" style={{ pointerEvents: 'none' }}><rect x={pt.x - w / 2} y={pt.y - 10} width={w} height={20} rx={6} /><text x={pt.x} y={pt.y + 4} textAnchor="middle">{text}</text></g>;
          })}
          {shown.nodes.filter(n => n.varFix !== undefined || n.varLabel).map(n => {
            const h = half(n), text = `${n.kind === 'latent' ? 'ψ' : 'θ'} ${[n.varLabel, n.varFix !== undefined ? `=${n.varFix}` : ''].filter(Boolean).join(' ')}`;
            const w = Math.max(30, text.length * 7.2 + 12), x = n.x - h.w + w / 2 - 6, y = n.y + h.h + 14;
            return <g key={`cv-${n.id}`} className="cons" style={{ pointerEvents: 'none' }}><rect x={x - w / 2} y={y - 10} width={w} height={20} rx={6} /><text x={x} y={y + 4} textAnchor="middle">{text}</text></g>;
          })}
          {estimates && shown.edges.map(e => {
            const v = estimates.byEdge.get(e.id), a = shownById.get(e.from), b = shownById.get(e.to);
            if (!v || !a || !b) return null;
            let pt: Pt;
            if (e.kind === 'cov') pt = geometry('cov', a, b).mid;
            else { const p1 = boundary(a, b.x, b.y), p2 = boundary(b, a.x, a.y); pt = { x: p1.x + (p2.x - p1.x) * 0.66, y: p1.y + (p2.y - p1.y) * 0.66 }; }
            const w = Math.max(30, v.text.length * 7.6 + 12);
            return (
              <g key={`est-${e.id}`} className={`est ${v.weak ? 'weak' : ''} ${v.equal ? 'equal' : ''} ${v.fixed ? 'fixed' : ''}`} style={{ pointerEvents: 'none' }}>
                <rect x={pt.x - w / 2} y={pt.y - 11} width={w} height={22} rx={11} />
                <text x={pt.x} y={pt.y + 4.5} textAnchor="middle">{v.text}</text>
              </g>
            );
          })}
          {from && connect && (() => {
            const tgt = connect.target ? shownById.get(connect.target) : undefined;
            const end = tgt ? boundary(tgt, from.x, from.y) : connect.to;
            const p1 = boundary(from, end.x, end.y);
            return <line x1={p1.x} y1={p1.y} x2={end.x} y2={end.y} stroke="var(--link)" strokeWidth={2.5} strokeDasharray="7 5" data-ui="1"
              markerEnd="url(#ah-sel)" markerStart={connect.cov ? 'url(#ah-sel)' : undefined} style={{ pointerEvents: 'none' }} />;
          })()}
          {shown.nodes.map(n => (
            <g key={n.id} data-node={n.id} className={`sc-node ${connect?.target === n.id ? 'target' : ''} ${highlight === n.id ? 'hl' : ''}`} tabIndex={0} role="button"
              aria-pressed={sel.nodes.includes(n.id)} aria-label={`${n.kind === 'latent' ? 'Factor' : 'Item'} ${n.label}`}
              onPointerDown={e => onNodeDown(e, n)} onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(h => (h === n.id ? null : h))}
              onDoubleClick={e => { e.stopPropagation(); if (tool === 'select') startRename(n.id); }}>
              {(highlight === n.id || connect?.target === n.id) && (n.kind === 'latent'
                ? <ellipse cx={n.x} cy={n.y} rx={LAT.rx + 9} ry={LAT.ry + 9} className="halo" />
                : <rect x={n.x - OBS.w / 2 - 9} y={n.y - OBS.h / 2 - 9} width={OBS.w + 18} height={OBS.h + 18} rx="14" className="halo" />)}
              <NodeShape n={editing === n.id ? { ...n, label: '' } : n} selected={sel.nodes.includes(n.id)} pending={tool !== 'select' && connect?.from === n.id}
                sub={estimates && Number.isFinite(estimates.r2[n.id]) ? `R² ${fmtNum(estimates.r2[n.id], true)}` : undefined} />
              {showDots(n.id) && dots(n).map((p, i) => (
                <g key={i} className="dot" data-ui="1" onPointerDown={e => onDotDown(e, n)}>
                  <circle cx={p.x} cy={p.y} r={16 / Math.max(cam.k, 0.6)} className="dot-hit" />
                  <circle cx={p.x} cy={p.y} r={7 / Math.max(cam.k, 0.6)} className="dot-face" />
                </g>
              ))}
              {badges.has(n.id) && (() => {
                const b = badges.get(n.id)!, h = half(n);
                const bx = n.x + h.w - (n.kind === 'latent' ? 18 : 4), by = n.y - h.h + (n.kind === 'latent' ? 4 : 0);
                return <g className={`badge ${b.level}`} data-ui="1"
                  onPointerDown={e => { e.stopPropagation(); onNote(n.id); }}
                  onPointerEnter={() => setTip({ node: n.id, text: b.text, level: b.level })} onPointerLeave={() => setTip(null)}>
                  <circle cx={bx} cy={by} r={10} />
                  <text x={bx} y={by + 4.5} textAnchor="middle">{b.level === 'warn' ? '!' : 'i'}</text>
                </g>;
              })()}
            </g>
          ))}
          {invariance && <LockLayer d={shown} s={s} v={invariance} />}
          {box && <rect x={Math.min(box.a.x, box.b.x)} y={Math.min(box.a.y, box.b.y)} width={Math.abs(box.b.x - box.a.x)} height={Math.abs(box.b.y - box.a.y)}
            fill="var(--latent)" fillOpacity="0.25" stroke="var(--link)" strokeDasharray="5 4" data-ui="1" style={{ pointerEvents: 'none' }} />}
          {ghost?.over && (() => {
            const w = toWorld(svg.current!.getBoundingClientRect().left + ghost.screen.x, svg.current!.getBoundingClientRect().top + ghost.screen.y);
            return <g opacity="0.55" style={{ pointerEvents: 'none' }} data-ui="1"><NodeShape n={{ id: 'ghost', kind: ghost.kind, label: ghost.kind === 'latent' ? 'Factor' : 'item', x: w.x, y: w.y }} /></g>;
          })()}
        </g>
      </svg>

      {/* ---- the rail */}
      <div className="sc-rail" role="toolbar" aria-label="Build">
        <button className={tool === 'select' ? 'on' : ''} onClick={() => { setTool('select'); setConnect(null); }} title="Select and move (V)" aria-pressed={tool === 'select'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3l12 9-6 1.2L9 20z" /></svg><span>Move</span></button>
        <button className={`drag ${tool === 'factor' ? 'on' : ''}`} onPointerDown={e => railDown(e, 'latent', 'factor')} title="Factor — drag onto the sheet, or click and place (F)" aria-pressed={tool === 'factor'}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); add('latent'); } }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9.5" ry="6" className="f" /></svg><span>Factor</span></button>
        <button className={`drag ${tool === 'item' ? 'on' : ''}`} onPointerDown={e => railDown(e, 'observed', 'item')} title="Item — drag onto the sheet, or click and place (I)" aria-pressed={tool === 'item'}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); add('observed'); } }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="2.5" className="i" /></svg><span>Item</span></button>
        <button className={tool === 'arrow' ? 'on' : ''} onClick={() => { setTool(tool === 'arrow' ? 'select' : 'arrow'); setConnect(null); }} title="Arrow — or pull a dot on any shape (A)" aria-pressed={tool === 'arrow'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M13 7l5 5-5 5" className="l" /></svg><span>Arrow</span></button>
        <button className={tool === 'cov' ? 'on' : ''} onClick={() => { setTool(tool === 'cov' ? 'select' : 'cov'); setConnect(null); }} title="Covariance — or Alt-pull a dot (C)" aria-pressed={tool === 'cov'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15c3-8 11-8 14 0M5 15l-1-4M5 15l4-1M19 15l1-4M19 15l-4-1" className="l" /></svg><span>Covary</span></button>
        <i className="sep" />
        <button onClick={undo} disabled={!past.current.length} title="Undo (⌘Z)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4 12l5 5M4 12h10a6 6 0 010 12" className="l" transform="translate(0 -3)" /></svg><span>Undo</span></button>
        <button onClick={redo} disabled={!future.current.length} title="Redo (⇧⌘Z)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7l5 5-5 5M20 12H10a6 6 0 000 12" className="l" transform="translate(0 -3)" /></svg><span>Redo</span></button>
        <button onClick={() => commit(tidy(d))} disabled={!d.nodes.length} title="Tidy up the layout (T)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" className="l" /></svg><span>Tidy</span></button>
        <button className={d.stdlv ? 'on' : ''} aria-pressed={!!d.stdlv} onClick={() => commit({ ...d, stdlv: !d.stdlv || undefined })}
          title={d.stdlv ? 'Factors are scaled by their variance (std.lv = TRUE). Click to scale by the first loading.' : 'Factors are scaled by their first loading. Click to fix their variances to 1 instead (std.lv = TRUE).'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="16" textAnchor="middle" style={{ font: '800 11px var(--f-body)', fill: 'var(--ink)' }}>{d.stdlv ? 'ψ=1' : 'λ=1'}</text></svg><span>Scale</span></button>
        <button className={showDefaults ? 'on' : ''} onClick={() => setShowDefaults(!showDefaults)} aria-pressed={showDefaults} title="Show what lavaan adds on its own (D)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" className="l" /><circle cx="12" cy="12" r="3" className="l" /></svg><span>Defaults</span></button>
      </div>

      {/* ---- zoom */}
      <div className="sc-zoom" role="group" aria-label="Zoom">
        <button onClick={() => zoomAt(size.w / 2, size.h / 2, cam.k / 1.25)} aria-label="Zoom out">−</button>
        <button onClick={() => fitTo(d)} title="Fit the whole model (⇧1)">{Math.round(cam.k * 100)}%</button>
        <button onClick={() => zoomAt(size.w / 2, size.h / 2, cam.k * 1.25)} aria-label="Zoom in">+</button>
      </div>

      <p className="sc-hint" aria-live="polite">{hint}</p>

      {/* ---- the name field, sitting on the shape */}
      {edit && (() => {
        const p = toScreen(edit), w = Math.max(130, (edit.kind === 'latent' ? LAT.rx * 2 - 20 : OBS.w - 8) * cam.k);
        return (
          <div className="sc-name" style={{ left: p.x - w / 2, top: p.y - 17, width: w }}>
            <input key={edit.id} ref={el => { if (el && document.activeElement !== el) { el.focus({ preventScroll: true }); el.select(); } }} aria-label={edit.kind === 'latent' ? 'Factor name' : 'Item name — the column in your data'}
              value={byId.get(edit.id)?.label ?? ''}
              onChange={e => rename(edit.id, e.target.value)}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); endRename(); }
                if (e.key === 'Tab') { e.preventDefault(); endRename('item'); }
              }}
              onBlur={() => { if (editingRef.current === edit.id) endRename(); }} />
            <small>{edit.kind === 'latent' ? 'Enter ✓ · Tab adds its first item' : 'Enter ✓ · Tab adds the next item'}</small>
          </div>
        );
      })()}

      {/* ---- the toolbar of the selection */}
      {bar && (
        <div className="sc-bar" style={{ left: Math.max(70, Math.min(size.w - 20, bar.x)), top: Math.max(8, bar.y - 54) }} onPointerDown={e => e.stopPropagation()}>
          {selNode && <>
            {selNode.kind === 'latent' && <button onClick={() => addItemTo(selNode.id)}>＋ Item</button>}
            <button onClick={() => startRename(selNode.id)}>Rename</button>
            <button aria-expanded={consOpen} onClick={() => setConsOpen(v => !v)}>Constrain{consOpen ? ' ▴' : ' ▾'}</button>
            <button onClick={() => { setTool('arrow'); setConnect({ from: selNode.id, to: selNode, cov: false, target: null, moved: false }); }}>→ Arrow</button>
            <button className="danger" onClick={() => remove()} aria-label="Remove">✕</button>
          </>}
          {selEdge && <>
            <span className="what">{selEdge.kind === 'cov' ? 'Covariance' : sLoad(selEdge) ? 'Loading' : 'Regression'}</span>
            {selEdge.kind !== 'cov' && byId.get(selEdge.from)?.kind === 'latent' && <button onClick={() => toggleKind(selEdge.id)}>Make it a {selEdge.kind === 'loading' ? 'regression' : 'loading'}</button>}
            <button onClick={() => makeCov(selEdge.id)}>{selEdge.kind === 'cov' ? '→ one-headed' : '↔ two-headed'}</button>
            {selEdge.kind !== 'cov' && <button onClick={() => reverse(selEdge.id)}>⇄ Reverse</button>}
            <button aria-expanded={consOpen} onClick={() => setConsOpen(v => !v)}>Constrain{consOpen ? ' ▴' : ' ▾'}</button>
            <button className="danger" onClick={() => remove()} aria-label="Remove">✕</button>
          </>}
          {consOpen && (selEdge || selNode) && (
            <div className="sc-cons" onKeyDown={e => e.stopPropagation()}>
              {selEdge && <>
                <p className="sc-cons-h">This {selEdge.kind === 'cov' ? 'covariance' : sLoad(selEdge) ? 'loading' : 'path'}</p>
                {isMarker(selEdge) && <p className="sc-cons-note">Fixed to 1: it gives the factor its scale. <button className="linkish" onClick={() => setEdge(selEdge.id, { free: true })}>Estimate it (NA*)</button> — then fix the factor’s variance instead.</p>}
                {selEdge.free && <p className="sc-cons-note">Freed with NA*. <button className="linkish" onClick={() => setEdge(selEdge.id, { free: undefined })}>Fix it to 1 again</button></p>}
                <label>Fixed value<input type="number" step="0.1" placeholder="free" defaultValue={selEdge.fix ?? ''} key={`fx-${selEdge.id}-${selEdge.fix}`}
                  onBlur={e => setEdge(selEdge.id, { fix: e.target.value === '' ? undefined : Number(e.target.value), free: undefined })}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>
                <label>Equality label<input type="text" placeholder="e.g. a" defaultValue={selEdge.label ?? ''} key={`lb-${selEdge.id}-${selEdge.label}`}
                  onBlur={e => setEdge(selEdge.id, { label: cleanLabel(e.target.value) })}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>
                <p className="sc-cons-note">Arrows with the same label are estimated as one number.</p>
                {selEdge.kind === 'path' && <label>Moderated by<select value={selEdge.moderator ?? ''} onChange={e => setEdge(selEdge.id, { moderator: e.target.value || undefined })}>
                  <option value="">nothing</option>
                  {d.nodes.filter(n => n.id !== selEdge.from && n.id !== selEdge.to).map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select></label>}
                {selEdge.moderator && <p className="sc-cons-note">A latent interaction: the effect depends on {byId.get(selEdge.moderator)?.label}. The code switches to modsem; the studio’s numbers leave the interaction out.</p>}
              </>}
              {selNode && <>
                <p className="sc-cons-h">{selNode.kind === 'latent' ? (s.load.some(e => e.to === selNode.id) || s.reg.some(e => e.to === selNode.id) ? 'Residual variance of the factor' : 'Variance of the factor') : 'Residual variance of the item'}</p>
                <label>Fixed value<input type="number" step="0.1" placeholder={d.stdlv && selNode.kind === 'latent' ? '1 (std.lv)' : 'free'} defaultValue={selNode.varFix ?? ''} key={`vf-${selNode.id}-${selNode.varFix}`}
                  onBlur={e => setNode(selNode.id, { varFix: e.target.value === '' ? undefined : Number(e.target.value) })}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>
                <label>Equality label<input type="text" placeholder="e.g. e" defaultValue={selNode.varLabel ?? ''} key={`vl-${selNode.id}-${selNode.varLabel}`}
                  onBlur={e => setNode(selNode.id, { varLabel: cleanLabel(e.target.value) })}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>
                {selNode.kind === 'latent' && s.load.some(e => e.from === selNode.id) && <>
                  <p className="sc-cons-h" style={{ marginTop: 8 }}>Its items</p>
                  <div className="sc-cons-row">
                    <button onClick={() => preset(selNode.id, 'tau')} title="All loadings equal">τ-equivalent</button>
                    <button onClick={() => preset(selNode.id, 'parallel')} title="Equal loadings and equal residual variances">Parallel</button>
                    <button onClick={() => preset(selNode.id, 'clear')} title="Every loading and residual free">Congeneric</button>
                  </div>
                </>}
              </>}
            </div>
          )}
          {nSel > 1 && <>
            <span className="what">{nSel} selected</span>
            <button onClick={() => { copy(); paste(); }}>Duplicate</button>
            <button className="danger" onClick={() => remove()}>✕ Remove</button>
          </>}
        </div>
      )}

      {/* ---- add something where you double-clicked */}
      {picker && (() => {
        const p = toScreen(picker.at);
        return (
          <div className="sc-picker" style={{ left: p.x, top: p.y }} onPointerDown={e => e.stopPropagation()}>
            <button autoFocus onClick={() => add('latent', picker.at)}><svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9.5" ry="6" className="f" /></svg>Factor <kbd>F</kbd></button>
            <button onClick={() => add('observed', picker.at)}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="2.5" className="i" /></svg>Item <kbd>I</kbd></button>
          </div>
        );
      })()}

      {/* ---- η's remark on a shape */}
      {tip && shownById.get(tip.node) && (() => {
        const n = shownById.get(tip.node)!, p = toScreen({ x: n.x + half(n).w, y: n.y - half(n).h });
        return <div className={`sc-tip ${tip.level}`} style={{ left: Math.min(p.x + 14, size.w - 300), top: Math.max(8, p.y - 10) }} role="status">{tip.text}</div>;
      })()}

      {!d.nodes.length && empty && <div className="sc-empty">{empty}</div>}
      {ghost && !ghost.over && <div className="sc-ghost" style={{ left: ghost.screen.x, top: ghost.screen.y }}>{ghost.kind === 'latent' ? 'Factor' : 'item'}</div>}
    </div>
  );
}
