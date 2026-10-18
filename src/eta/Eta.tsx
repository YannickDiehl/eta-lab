// η — the course character as a React component (same drawing as the course website).
// The letterform has two eyes on its arch; expression comes from eyes, lids, brows and tilt.
import { useEffect, useId } from 'react';

export type Mood = 'neutral' | 'curious' | 'thinking' | 'surprised' | 'worried' | 'pleased' | 'explaining';

const MOODS: Record<Mood, { lid: number; low: number; brow: { lift: number; tilt: number } | null; look: [number, number]; eye: number; tilt: number; small?: boolean }> = {
  neutral:    { lid: 0,   low: 0,   brow: null,                  look: [0, 0],     eye: 1,    tilt: 0 },
  curious:    { lid: 0,   low: 0,   brow: { lift: 7, tilt: 0 },  look: [.5, -.6],  eye: 1.05, tilt: 4 },
  thinking:   { lid: .42, low: 0,   brow: { lift: 6, tilt: 8 },  look: [-.7, -.7], eye: 1,    tilt: -4 },
  surprised:  { lid: 0,   low: 0,   brow: { lift: 10, tilt: 0 }, look: [0, 0],     eye: 1.18, tilt: 0, small: true },
  worried:    { lid: .18, low: 0,   brow: { lift: 5, tilt: 18 }, look: [0, .6],    eye: 1,    tilt: -2 },
  pleased:    { lid: .12, low: .42, brow: null,                  look: [0, -.2],   eye: 1,    tilt: 3 },
  explaining: { lid: 0,   low: .15, brow: { lift: 6, tilt: 0 },  look: [-.9, .3],  eye: 1,    tilt: -8 },
};

const STEM = 'M18,61 Q27,49 31,63 L31,112';
const ARCH = 'M31,76 C34,57 46,50 57,50 C71,50 76,61 76,76 L76,148';

// One global pointer listener moves every tracking pupil.
let listening = false;
function ensureListener() {
  if (listening || typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  listening = true;
  let mx = -1e5, my = -1e5, raf = 0;
  const update = () => {
    raf = 0;
    document.querySelectorAll<SVGCircleElement>('.eta-pupil').forEach(p => {
      const g = p.parentNode as SVGGraphicsElement, ctm = g.getScreenCTM?.();
      if (!ctm || !p.ownerSVGElement) return;
      const pt = p.ownerSVGElement.createSVGPoint(); pt.x = mx; pt.y = my;
      const q = pt.matrixTransform(ctm.inverse());
      const cx = +p.dataset.cx!, cy = +p.dataset.cy!, max = +p.dataset.max!;
      const dx = q.x - cx, dy = q.y - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(max, d / 18);
      p.setAttribute('cx', String(cx + (dx / d) * k)); p.setAttribute('cy', String(cy + (dy / d) * k));
    });
  };
  window.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(update); });
}

export function Eta({ mood = 'neutral', size = 96, track, look, tilt, title }: { mood?: Mood; size?: number; track?: boolean; look?: [number, number]; tilt?: number; title?: string }) {
  const id = useId().replace(/:/g, '');
  const m = MOODS[mood];
  const follow = track ?? !['thinking', 'worried', 'explaining'].includes(mood);
  const gaze = look ?? m.look;
  useEffect(() => { if (follow) ensureListener(); }, [follow]);
  const eyes: [number, number][] = [[45, 41], [66, 39]];
  const r = 10.5 * m.eye, pr = m.small ? 3.2 : 4.6;
  return (
    <svg width={size * 0.66} height={size} viewBox="0 20 100 140" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <g transform={`rotate(${tilt ?? m.tilt} 60 150)`}>
        <ellipse cx="60" cy="151" rx="30" ry="4" fill="var(--ink)" opacity=".12" />
        {[STEM, ARCH].map(d => <path key={'o' + d} d={d} fill="none" stroke="var(--ink)" strokeWidth="25" strokeLinecap="round" strokeLinejoin="round" />)}
        {[STEM, ARCH].map(d => <path key={'b' + d} d={d} fill="none" stroke="var(--eta)" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" />)}
        <path d="M38,70 C41,60 48,56 56,56" fill="none" stroke="#fff" opacity=".55" strokeWidth="4" strokeLinecap="round" />
        {eyes.map(([cx, cy], i) => {
          const max = r - pr - 1.6;
          return (
            <g key={i}>
              <clipPath id={`${id}c${i}`}><circle cx={cx} cy={cy} r={r} /></clipPath>
              <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="var(--ink)" strokeWidth="2.6" />
              <circle className={follow ? 'eta-pupil' : undefined} data-cx={cx} data-cy={cy} data-max={max}
                cx={cx + gaze[0] * max} cy={cy + gaze[1] * max} r={pr} fill="var(--ink)" />
              <g clipPath={`url(#${id}c${i})`}>
                {m.lid > 0 && <>
                  <rect x={cx - r - 2} y={cy - r - 2} width={2 * r + 4} height={2 * r * m.lid + 2} fill="var(--eta)" />
                  <line x1={cx - r} x2={cx + r} y1={cy - r + 2 * r * m.lid} y2={cy - r + 2 * r * m.lid} stroke="var(--ink)" strokeWidth="2.4" />
                </>}
                {m.low > 0 && <path d={`M${cx - r - 2},${cy + r + 2} L${cx - r - 2},${cy + r - 2 * r * m.low} Q${cx},${cy + r - 2 * r * m.low - 6} ${cx + r + 2},${cy + r - 2 * r * m.low} L${cx + r + 2},${cy + r + 2} Z`} fill="var(--eta)" stroke="var(--ink)" strokeWidth="2.4" />}
                <rect className="eta-blink" x={cx - r - 2} y={cy - r - 2} width={2 * r + 4} height={2 * r + 4} fill="var(--eta)" style={{ animationDelay: `${(i === 0 ? 0 : 0) + (id.length % 5) * 0.9}s` }} />
              </g>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--ink)" strokeWidth="2.6" />
              {m.brow && (() => {
                const dir = i === 0 ? -1 : 1, by = cy - r - m.brow.lift, ang = (m.brow.tilt * dir * Math.PI) / 180, L = 8;
                return <line x1={cx - L * Math.cos(ang)} y1={by - L * Math.sin(ang)} x2={cx + L * Math.cos(ang)} y2={by + L * Math.sin(ang)} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />;
              })()}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
