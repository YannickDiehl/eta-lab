// A path-diagram editor in the spirit of lavaangui: add factors and items, drag them,
// connect them by dragging or clicking, select several, undo and redo, see what lavaan
// adds on its own, and save the drawing as an image.
//
// Mouse:     drag a shape to move it (all selected shapes move together); drag on empty
//            canvas to select with a box; Shift/⌘-click adds to the selection; double-click
//            a shape to rename it; right-click for a menu.
// Arrow / ↔: drag from one shape to another, or click both.
// Keys:      F factor · I item (at the pointer) · A arrow · C covariance · V move · Esc cancel
//            ⌫ remove · ⌘Z undo · ⇧⌘Z redo · ⌘A select all · arrow keys nudge (⇧ = more)
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react';
import { addEdge, SLOT, structure, tidy, uid, type DEdge, type Diagram, type DNode } from './diagram.ts';
import { EQUAL } from './invariance.ts';
import { boundary, capture, Defaults, EdgeShape, extent, GRID, LockLayer, Markers, MIN_SCALE, NodeShape, NONE, saveImage, VIEW, nextItemLabel, GREEK, WHAT, type LockView, type Mode, type Pt, type Sel } from './shapes.tsx';
export { Diagram, extent, VIEW, nextItemLabel, type LockView } from './shapes.tsx';

type Target = { type: 'canvas' } | { type: 'node'; id: string } | { type: 'edge'; id: string };
type Menu = { x: number; y: number; at: Pt; target: Target } | null;

export function Editor({ d, onChange, invariance }: { d: Diagram; onChange: (d: Diagram) => void; invariance?: LockView }) {
  const [mode, setMode] = useState<Mode>('move');
  const [sel, setSel] = useState<Sel>(NONE);
  const [pending, setPending] = useState<string | null>(null);
  const [pointer, setPointer] = useState<Pt | null>(null);
  const [box, setBox] = useState<{ a: Pt; b: Pt; add: boolean } | null>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const [, force] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);   // null: fit the width, but never smaller than MIN_SCALE
  const [cw, setCw] = useState(0);
  const area = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(el.clientWidth));
    ro.observe(el); setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const svg = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: Pt; orig: Map<string, Pt>; moved: boolean; base: Diagram } | null>(null);
  const connect = useRef<string | null>(null);         // the shape a connecting drag started on
  const frozen = useRef<{ w: number; h: number } | null>(null);
  const past = useRef<Diagram[]>([]), future = useRef<Diagram[]>([]);
  const emitted = useRef<Diagram>(d);
  const renameStart = useRef<Diagram | null>(null);
  const byId = useMemo(() => new Map(d.nodes.map(n => [n.id, n])), [d]);
  const s = useMemo(() => structure(d), [d]);

  // changes from outside (example, import) become undoable too; our own (even mid-drag) are not "outside"
  const own = useRef(new WeakSet<Diagram>([d]));
  useEffect(() => {
    if (!own.current.has(d)) {
      past.current.push(emitted.current); future.current = [];
      own.current.add(d);
      setSel(NONE); setPending(null); force(x => x + 1);
    }
    emitted.current = d;
  }, [d]);

  // when the focused shape disappears (removed, undone), keep the keyboard on the canvas
  const keepFocus = () => requestAnimationFrame(() => {
    const a = document.activeElement;
    if (!a || a === document.body || !wrap.current?.contains(a)) svg.current?.focus({ preventScroll: true });
  });
  const emit = (next: Diagram) => { own.current.add(next); onChange(next); keepFocus(); };
  const commit = (next: Diagram, base: Diagram = d) => {
    past.current.push(base); if (past.current.length > 100) past.current.shift();
    future.current = [];
    emit(next);
  };
  const undo = () => { const prev = past.current.pop(); if (prev) { future.current.push(d); emit(prev); setSel(NONE); setPending(null); } };
  const redo = () => { const next = future.current.pop(); if (next) { past.current.push(d); emit(next); setSel(NONE); setPending(null); } };

  const ext = frozen.current ?? extent(d);
  const fit = cw ? cw / ext.w : 1;
  const scale = zoom ?? Math.max(fit, Math.min(MIN_SCALE, fit * 3));
  const zoomBy = (f: number) => setZoom(Math.min(2, Math.max(Math.min(fit, 0.25), scale * f)));
  const toSvg = (cx: number, cy: number): Pt => {
    const el = svg.current!, p = el.createSVGPoint(); p.x = cx; p.y = cy;
    const q = p.matrixTransform(el.getScreenCTM()!.inverse());
    return { x: q.x, y: q.y };
  };
  const clampPt = (p: Pt): Pt => ({ x: Math.max(70, Math.min(4000, p.x)), y: Math.max(40, Math.min(3000, p.y)) });
  const snap = (v: number) => Math.round(v / GRID) * GRID;
  /** Shift a group of shapes, stopping the whole group at the canvas edge so it keeps its shape. */
  const shift = (base: Diagram, ids: Set<string> | Map<string, Pt>, dx: number, dy: number) => {
    const pts = base.nodes.filter(n => ids.has(n.id));
    dx = Math.max(dx, 70 - Math.min(...pts.map(n => n.x))); dy = Math.max(dy, 40 - Math.min(...pts.map(n => n.y)));
    return { ...base, nodes: base.nodes.map(n => (ids.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)) };
  };
  const nodeAt = (cx: number, cy: number) => (document.elementFromPoint(cx, cy)?.closest('[data-node]') as SVGGElement | null)?.dataset.node ?? null;

  // ---- creating
  const freeSpot = (kind: 'latent' | 'observed'): Pt => {
    const y = kind === 'latent' ? 110 : 330;
    let x = 110;
    while (d.nodes.some(n => Math.abs(n.x - x) < (n.kind === 'latent' || kind === 'latent' ? 175 : 125) && Math.abs(n.y - y) < 70)) x += kind === 'latent' ? 180 : SLOT;
    return { x, y };
  };
  const add = (kind: 'latent' | 'observed', at?: Pt) => {
    const p = clampPt(at ?? freeSpot(kind));
    const taken = new Set(d.nodes.map(n => n.label));
    let k = d.nodes.filter(n => n.kind === kind).length + 1;
    const make = () => (kind === 'latent' ? `Factor ${k}` : `item${k}`);
    while (taken.has(make())) k++;
    const n: DNode = { id: uid('n'), kind, label: make(), x: snap(p.x), y: snap(p.y) };
    commit({ ...d, nodes: [...d.nodes, n] });
    setSel({ nodes: [n.id], edges: [] }); setMode('move'); setPending(null);
  };
  const addItemTo = (fid: string) => {
    const f = byId.get(fid);
    if (!f || f.kind !== 'latent') return;
    const own = d.edges.filter(e => e.from === fid && e.kind === 'loading').map(e => byId.get(e.to)).filter(n => n?.kind === 'observed') as DNode[];
    const y = own.length ? Math.max(...own.map(n => n.y)) : f.y + 220;
    let x = own.length ? Math.max(...own.map(n => n.x)) + SLOT : f.x;
    while (d.nodes.some(n => Math.abs(n.x - x) < 120 && Math.abs(n.y - y) < 50)) x += SLOT;
    const it: DNode = { id: uid('n'), kind: 'observed', label: nextItemLabel(d, f), x: snap(x), y: snap(y) };
    commit({ nodes: [...d.nodes, it], edges: [...d.edges, { id: uid('e'), kind: 'loading', from: fid, to: it.id }] });
    setSel({ nodes: [fid], edges: [] });
  };
  const link = (from: string, to: string) => {
    if (from === to) return;
    const next = addEdge(d, from, to, mode === 'cov');
    if (next !== d) commit(next);
  };

  // ---- removing and editing
  const remove = (what: Sel = sel) => {
    if (!what.nodes.length && !what.edges.length) return;
    const gone = new Set(what.nodes);
    commit({ nodes: d.nodes.filter(n => !gone.has(n.id)), edges: d.edges.filter(e => !gone.has(e.from) && !gone.has(e.to) && !what.edges.includes(e.id)) });
    setSel(NONE);
  };
  const rename = (id: string, label: string) => emit({ ...d, nodes: d.nodes.map(n => (n.id === id ? { ...n, label } : n)) });
  const toggleKind = (eid: string) => commit({ ...d, edges: d.edges.map(e => (e.id === eid ? { ...e, kind: e.kind === 'loading' ? 'path' : 'loading' } : e)) });
  const reverse = (eid: string) => commit({ ...d, edges: d.edges.map(e => (e.id === eid ? { ...e, from: e.to, to: e.from, kind: 'path' } : e)) });
  const focusRename = () => requestAnimationFrame(() => { const el = document.getElementById('ed-name') as HTMLInputElement | null; el?.focus({ preventScroll: true }); el?.select(); });

  // ---- pointer
  const onNodeDown = (e: RPointerEvent, n: DNode) => {
    if (e.button !== 0) return;
    e.stopPropagation(); setMenu(null);
    // capture on the shape itself, so moves still reach the canvas and double-clicks still reach the shape
    capture(e.currentTarget as Element, e.pointerId);
    if (mode !== 'move') {
      if (pending && pending !== n.id) { link(pending, n.id); setPending(null); connect.current = null; return; }
      setPending(n.id); connect.current = n.id; setPointer(toSvg(e.clientX, e.clientY));
      return;
    }
    (e.currentTarget as SVGGElement).focus({ preventScroll: true });
    const multi = e.shiftKey || e.metaKey || e.ctrlKey;
    let nodes = sel.nodes;
    if (multi) nodes = nodes.includes(n.id) ? nodes.filter(x => x !== n.id) : [...nodes, n.id];
    else if (!nodes.includes(n.id)) nodes = [n.id];
    setSel({ nodes, edges: multi ? sel.edges : [] });
    if (!nodes.includes(n.id)) return;
    frozen.current = extent(d);
    drag.current = { start: toSvg(e.clientX, e.clientY), orig: new Map(nodes.map(id => [id, { x: byId.get(id)!.x, y: byId.get(id)!.y }])), moved: false, base: d };
  };
  const onEdgeDown = (e: RPointerEvent, edge: DEdge) => {
    if (e.button !== 0 || mode !== 'move') return;
    e.stopPropagation(); setMenu(null);
    svg.current?.focus({ preventScroll: true });
    const multi = e.shiftKey || e.metaKey || e.ctrlKey;
    setSel(multi ? { nodes: sel.nodes, edges: sel.edges.includes(edge.id) ? sel.edges.filter(x => x !== edge.id) : [...sel.edges, edge.id] } : { nodes: [], edges: [edge.id] });
  };
  const onCanvasDown = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    setMenu(null);
    svg.current?.focus({ preventScroll: true });
    if (mode !== 'move') { setPending(null); connect.current = null; return; }
    if (svg.current) capture(svg.current, e.pointerId);
    const p = toSvg(e.clientX, e.clientY);
    setBox({ a: p, b: p, add: e.shiftKey || e.metaKey || e.ctrlKey });
  };
  const onMove = (e: RPointerEvent) => {
    const p = toSvg(e.clientX, e.clientY);
    setPointer(p);
    const g = drag.current;
    if (g) {
      const dx = p.x - g.start.x, dy = p.y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) < 3) return;
      g.moved = true;
      emit(shift(g.base, g.orig, dx, dy));
    }
    if (box) setBox({ ...box, b: p });
  };
  const onUp = (e: RPointerEvent) => {
    const g = drag.current;
    drag.current = null;
    if (g?.moved) commit({ ...d, nodes: d.nodes.map(n => (g.orig.has(n.id) ? { ...n, x: snap(n.x), y: snap(n.y) } : n)) }, g.base);
    frozen.current = null;
    if (connect.current) {
      const target = nodeAt(e.clientX, e.clientY);
      if (target && target !== connect.current) { link(connect.current, target); setPending(null); }
      connect.current = null;
    }
    if (box) {
      const x0 = Math.min(box.a.x, box.b.x), x1 = Math.max(box.a.x, box.b.x), y0 = Math.min(box.a.y, box.b.y), y1 = Math.max(box.a.y, box.b.y);
      const tiny = x1 - x0 < 4 && y1 - y0 < 4;
      const inside = tiny ? [] : d.nodes.filter(n => n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1).map(n => n.id);
      setSel(box.add ? { nodes: [...new Set([...sel.nodes, ...inside])], edges: sel.edges } : { nodes: inside, edges: [] });
      setBox(null);
    }
    force(x => x + 1);
  };
  const openMenu = (e: RMouseEvent, target: Target) => {
    e.preventDefault(); e.stopPropagation();
    const r = wrap.current!.getBoundingClientRect();
    if (target.type === 'node' && !sel.nodes.includes(target.id)) setSel({ nodes: [target.id], edges: [] });
    if (target.type === 'edge') setSel({ nodes: [], edges: [target.id] });
    setMenu({ x: Math.min(e.clientX - r.left, r.width - 240), y: e.clientY - r.top, at: toSvg(e.clientX, e.clientY), target });
  };

  // ---- keyboard
  const onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'a') { e.preventDefault(); setSel({ nodes: d.nodes.map(n => n.id), edges: d.edges.map(x => x.id) }); return; }
    if (mod || e.altKey) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); return; }
    if (e.key === 'Escape') { setPending(null); setMenu(null); setMode('move'); setSel(NONE); return; }
    const focusNode = (t.closest?.('[data-node]') as SVGGElement | null)?.dataset.node;
    if (e.key === 'Enter' && focusNode) {
      e.preventDefault();
      if (mode === 'move') { if (sel.nodes.length === 1 && sel.nodes[0] === focusNode) focusRename(); else setSel({ nodes: [focusNode], edges: [] }); }
      else if (pending && pending !== focusNode) { link(pending, focusNode); setPending(null); }
      else setPending(focusNode);
      return;
    }
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dirs[e.key] && sel.nodes.length) {
      e.preventDefault();
      const step = e.shiftKey ? 50 : GRID, [dx, dy] = dirs[e.key];
      commit(shift(d, new Set(sel.nodes), dx * step, dy * step));
      return;
    }
    const inside = pointer && pointer.x >= 0 && pointer.y >= 0 && pointer.x <= ext.w && pointer.y <= ext.h ? pointer : undefined;
    if (k === 'f' || k === 'l') { e.preventDefault(); add('latent', inside); }
    else if (k === 'i' || k === 'o') { e.preventDefault(); add('observed', inside); }
    else if (k === 'a') { setMode('arrow'); setSel(NONE); setPending(null); }
    else if (k === 'c') { setMode('cov'); setSel(NONE); setPending(null); }
    else if (k === 'v' || k === 'm') { setMode('move'); setPending(null); }
    else if (e.key === 'F2' && sel.nodes.length === 1) focusRename();
  };
  useEffect(() => {
    if (!menu) return;
    const close = (ev: PointerEvent) => { if (!(ev.target as HTMLElement).closest?.('.ctx')) setMenu(null); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  const selNode = sel.nodes.length === 1 && !sel.edges.length ? byId.get(sel.nodes[0]) : undefined;
  const selEdge = sel.edges.length === 1 && !sel.nodes.length ? d.edges.find(e => e.id === sel.edges[0]) : undefined;
  const nSel = sel.nodes.length + sel.edges.length;
  const edgeName = (e: DEdge) => {
    if (e.kind === 'cov') return 'Covariance';
    return s.load.some(x => x.id === e.id) ? (byId.get(e.to)?.kind === 'latent' ? 'Loading (higher-order factor)' : 'Loading') : 'Regression path';
  };
  const canToggle = (e: DEdge) => e.kind !== 'cov' && byId.get(e.from)?.kind === 'latent';
  // the hint keeps a fixed height (see .mode-hint), so the canvas never moves under the pointer mid-gesture
  const modeHint = mode === 'arrow' ? (pending ? 'Now click or drag to the shape the arrow points to. Esc cancels.' : 'Drag from one shape to another, or click both. Factor → item is a loading, else a regression.')
    : mode === 'cov' ? (pending ? 'Now click or drag to the second shape. Esc cancels.' : 'Drag between two shapes that covary: two factors, or two items sharing extra variance.')
      : 'Drag to move, drag on empty space to select, double-click to rename, right-click for more.';
  const pend = pending ? byId.get(pending) : undefined;
  const menuNode = menu?.target.type === 'node' ? byId.get(menu.target.id) : undefined;
  const menuEdge = menu?.target.type === 'edge' ? d.edges.find(x => x.id === (menu.target as { id: string }).id) : undefined;

  return (
    <div className="editor" ref={wrap} onKeyDown={onKey}>
      <div className="toolbar" role="toolbar" aria-label="Model editor">
        <button className="tool" onClick={() => add('latent')} title="Add a factor (F)"><span className="ico e" aria-hidden="true" />Factor</button>
        <button className="tool" onClick={() => add('observed')} title="Add an item (I)"><span className="ico r" aria-hidden="true" />Item</button>
        <span className="seg" role="group" aria-label="Tool">
          <button aria-pressed={mode === 'move'} onClick={() => { setMode('move'); setPending(null); }} title="Move and select (V)">Move</button>
          <button aria-pressed={mode === 'arrow'} onClick={() => { setMode('arrow'); setPending(null); setSel(NONE); }} title="Draw arrows (A)">→ Arrow</button>
          <button aria-pressed={mode === 'cov'} onClick={() => { setMode('cov'); setPending(null); setSel(NONE); }} title="Draw covariances (C)">↔ Covariance</button>
        </span>
        <button className="tool" aria-pressed={showDefaults} onClick={() => setShowDefaults(v => !v)} title="Show the variances, covariances and fixed values lavaan adds on its own">
          lavaan’s defaults
        </button>
        <span className="spacer" />
        <button className="tool" onClick={undo} disabled={!past.current.length} title="Undo (⌘Z)">Undo</button>
        <button className="tool" onClick={redo} disabled={!future.current.length} title="Redo (⇧⌘Z)">Redo</button>
        <button className="tool" onClick={() => { commit(tidy(d, cw ? Math.max(VIEW.w, cw / MIN_SCALE - 10) : undefined)); setZoom(null); }} disabled={!d.nodes.length}>Tidy up</button>
        <span className="seg" role="group" aria-label="Zoom">
          <button onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out" title="Zoom out">−</button>
          <button onClick={() => setZoom(zoom === null ? fit : null)} aria-pressed={zoom !== null && Math.abs(zoom - fit) < 1e-3} title="Show the whole model / back to readable size">{Math.round(scale * 100)}%</button>
          <button onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">+</button>
        </span>
      </div>
      <p className="hint mode-hint" aria-live="polite">{modeHint}</p>
      <div className="canvas-area" ref={area}>
      <svg ref={svg} className={`canvas mode-${mode}`} viewBox={`0 0 ${ext.w} ${ext.h}`} tabIndex={0}
        style={cw ? { width: Math.round(ext.w * scale), height: Math.round(ext.h * scale) } : { width: '100%' }}
        onPointerDown={onCanvasDown} onPointerMove={onMove} onPointerUp={onUp}
        onPointerCancel={() => { setBox(null); if (drag.current?.moved) emit(drag.current.base); drag.current = null; frozen.current = null; connect.current = null; }} onPointerLeave={() => { if (!drag.current && !box) setPointer(null); }}
        onContextMenu={e => openMenu(e, { type: 'canvas' })} role="application"
        aria-label="Path diagram editor. Keys: F factor, I item, A arrow, C covariance, Delete removes, Ctrl+Z undo.">
        <Markers />
        {d.nodes.length === 0 && <text className="lbl-s" x={ext.w / 2} y={ext.h / 2} textAnchor="middle" style={{ fontSize: 16 }} data-ui="1">Add a factor and a few items, then draw arrows between them.</text>}
        {showDefaults && <Defaults d={d} s={s} />}
        {d.edges.map(e => byId.get(e.from) && byId.get(e.to) && (
          <EdgeShape key={e.id} e={e} a={byId.get(e.from)!} b={byId.get(e.to)!} selected={sel.edges.includes(e.id)}
            onPointerDown={ev => onEdgeDown(ev, e)} onContext={ev => openMenu(ev, { type: 'edge', id: e.id })} />
        ))}
        {pend && pointer && mode !== 'move' && (() => {
          const p1 = boundary(pend, pointer.x, pointer.y);
          return <line x1={p1.x} y1={p1.y} x2={pointer.x} y2={pointer.y} stroke="var(--link)" strokeWidth="2.5" strokeDasharray="6 5" data-ui="1"
            markerEnd="url(#ah-sel)" markerStart={mode === 'cov' ? 'url(#ah-sel)' : undefined} style={{ pointerEvents: 'none' }} />;
        })()}
        {d.nodes.map(n => (
          <g key={n.id} data-node={n.id} tabIndex={0} role="button" aria-pressed={sel.nodes.includes(n.id)}
            aria-label={`${n.kind === 'latent' ? 'Factor' : 'Item'} ${n.label}`}
            style={{ cursor: mode === 'move' ? 'grab' : 'crosshair', outline: 'none' }}
            onPointerDown={e => onNodeDown(e, n)}
            onDoubleClick={() => { if (mode === 'move') { setSel({ nodes: [n.id], edges: [] }); focusRename(); } }}
            onContextMenu={e => openMenu(e, { type: 'node', id: n.id })}>
            <NodeShape n={n} selected={sel.nodes.includes(n.id)} pending={pending === n.id} />
          </g>
        ))}
        {invariance && <LockLayer d={d} s={s} v={invariance} />}
        {box && <rect x={Math.min(box.a.x, box.b.x)} y={Math.min(box.a.y, box.b.y)} width={Math.abs(box.b.x - box.a.x)} height={Math.abs(box.b.y - box.a.y)}
          fill="var(--latent)" fillOpacity="0.25" stroke="var(--link)" strokeDasharray="5 4" data-ui="1" style={{ pointerEvents: 'none' }} />}
      </svg>
      </div>

      {showDefaults && (
        <p className="hint legend">
          <b>Dashed</b> = added by lavaan without being drawn: every variance (the loops) and the covariances it assumes.{' '}
          <span className="chip">1</span> the first loading is fixed to 1 and gives the factor its scale.{' '}
          {s.params.some(p => p.fixed === 0) && <><span className="chip">0</span> a lone item’s noise is fixed to 0. </>}
          {s.params.some(p => p.fixed === 'data') && <><span className="chip">x</span> a covariate: lavaan takes its variance from the data (fixed.x).</>}
        </p>
      )}

      {invariance && EQUAL[invariance.level].length > 0 && (
        <p className="hint legend">
          <b>Across groups</b>, the chips show what this rung holds equal:{' '}
          {EQUAL[invariance.level].map(k => <span key={k}><span className="chip lock-chip">{GREEK[k]}=</span> {WHAT[k]}s{' '}</span>)}
          · <span className="chip">λ=1</span> marker, equal by construction. Click a chip to release it (<span className="chip lock-chip off">≠</span> partial invariance).
        </p>
      )}

      {menu && (
        <div className="ctx" role="menu" style={{ left: menu.x, top: menu.y }}>
          {menu.target.type === 'canvas' && <>
            <button role="menuitem" onClick={() => { add('latent', menu.at); setMenu(null); }}>Add factor here <kbd>F</kbd></button>
            <button role="menuitem" onClick={() => { add('observed', menu.at); setMenu(null); }}>Add item here <kbd>I</kbd></button>
            {d.nodes.length > 0 && <button role="menuitem" onClick={() => { setSel({ nodes: d.nodes.map(n => n.id), edges: d.edges.map(x => x.id) }); setMenu(null); }}>Select all <kbd>⌘A</kbd></button>}
          </>}
          {menuNode && <>
            <button role="menuitem" onClick={() => { setSel({ nodes: [menuNode.id], edges: [] }); setMenu(null); focusRename(); }}>Rename</button>
            {menuNode.kind === 'latent' && <button role="menuitem" onClick={() => { addItemTo(menuNode.id); setMenu(null); }}>Add an item to {menuNode.label || 'this factor'}</button>}
            <button role="menuitem" onClick={() => { setMode('arrow'); setPending(menuNode.id); setSel(NONE); setMenu(null); }}>Draw an arrow from here</button>
            <button role="menuitem" onClick={() => { remove(sel.nodes.includes(menuNode.id) ? sel : { nodes: [menuNode.id], edges: [] }); setMenu(null); }}>
              Remove{sel.nodes.length > 1 && sel.nodes.includes(menuNode.id) ? ` ${sel.nodes.length} shapes` : ''} <kbd>⌫</kbd></button>
          </>}
          {menuEdge && <>
            {canToggle(menuEdge) && <button role="menuitem" onClick={() => { toggleKind(menuEdge.id); setMenu(null); }}>Make it a {menuEdge.kind === 'loading' ? 'regression path' : 'loading'}</button>}
            {menuEdge.kind !== 'cov' && <button role="menuitem" onClick={() => { reverse(menuEdge.id); setMenu(null); }}>Reverse direction</button>}
            <button role="menuitem" onClick={() => { remove({ nodes: [], edges: [menuEdge.id] }); setMenu(null); }}>Remove <kbd>⌫</kbd></button>
          </>}
        </div>
      )}

      <div className="inspector">
        {selNode && <>
          <label htmlFor="ed-name">{selNode.kind === 'latent' ? 'Factor name' : 'Item name (= column in your data)'}</label>
          <input id="ed-name" type="text" value={selNode.label}
            onFocus={() => { renameStart.current = d; }}
            onBlur={() => {
              if (renameStart.current && renameStart.current !== d) { past.current.push(renameStart.current); future.current = []; force(x => x + 1); }
              renameStart.current = null;
            }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { (e.target as HTMLInputElement).blur(); svg.current?.focus({ preventScroll: true }); } }}
            onChange={e => rename(selNode.id, e.target.value)} />
          {selNode.kind === 'latent' && <button className="tool" onClick={() => addItemTo(selNode.id)}>+ Item</button>}
          <button className="tool" onClick={() => remove()}>Remove</button>
        </>}
        {selEdge && <>
          <span className="hint" style={{ margin: 0 }}><b>{edgeName(selEdge)}</b>: {byId.get(selEdge.from)?.label} {selEdge.kind === 'cov' ? '↔' : '→'} {byId.get(selEdge.to)?.label}</span>
          {canToggle(selEdge) && <button className="tool" onClick={() => toggleKind(selEdge.id)}>Make it a {selEdge.kind === 'loading' ? 'regression' : 'loading'}</button>}
          {selEdge.kind !== 'cov' && <button className="tool" onClick={() => reverse(selEdge.id)}>Reverse</button>}
          <button className="tool" onClick={() => remove()}>Remove</button>
        </>}
        {nSel > 1 && <>
          <span className="hint" style={{ margin: 0 }}><b>{nSel} selected</b> — drag one to move them all, arrow keys nudge them.</span>
          <button className="tool" onClick={() => remove()}>Remove {nSel}</button>
        </>}
        {nSel === 0 && <span className="hint" style={{ margin: 0 }}>Select a shape to rename it, add items or remove it.</span>}
        <span className="spacer" />
        <button className="tool" onClick={() => svg.current && saveImage(svg.current, 'png')} disabled={!d.nodes.length}>Save PNG</button>
        <button className="tool" onClick={() => svg.current && saveImage(svg.current, 'svg')} disabled={!d.nodes.length}>Save SVG</button>
      </div>
      <details className="keys">
        <summary className="hint">Keyboard shortcuts</summary>
        <p className="hint"><kbd>F</kbd> factor and <kbd>I</kbd> item at the pointer · <kbd>A</kbd> arrows · <kbd>C</kbd> covariances · <kbd>V</kbd> move · <kbd>Esc</kbd> cancel ·{' '}
          <kbd>⌫</kbd> remove · <kbd>⌘Z</kbd> undo · <kbd>⇧⌘Z</kbd> redo · <kbd>⌘A</kbd> select all · arrow keys nudge (<kbd>⇧</kbd> = more) · <kbd>Enter</kbd> on a focused shape selects, renames or connects it.</p>
      </details>
    </div>
  );
}
