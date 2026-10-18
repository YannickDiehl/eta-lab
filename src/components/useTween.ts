// Animate a vector of numbers towards its target (eased); instant when the user prefers reduced motion.
import { useEffect, useRef, useState } from 'react';

export function useTween(target: number[], ms = 500) {
  const [cur, setCur] = useState(target);
  const curRef = useRef(target);
  const key = target.map(v => v.toFixed(5)).join(',');
  useEffect(() => {
    // no animation when motion is reduced, or when the page is hidden (the browser pauses frames there)
    const reduce = typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.visibilityState !== 'visible');
    const from = curRef.current;
    if (reduce || from.length !== target.length) { curRef.current = target; setCur(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3;
      const v = target.map((x, i) => from[i] + (x - from[i]) * e);
      curRef.current = v; setCur(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // frames can be throttled (background panes): make sure the target is reached anyway
    const done = window.setTimeout(() => { cancelAnimationFrame(raf); curRef.current = target; setCur(target); }, ms + 80);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(done); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return cur;
}
