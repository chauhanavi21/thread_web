import { useEffect, useRef } from 'react';

export const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
/** Maps p from [a, b] to 0..1, clamped. */
export const span = (p, a, b) => clamp((p - a) / (b - a));
export const ease = (t) => 1 - (1 - t) ** 3;

/**
 * Drives a tall "sticky stage" section. `apply(p, el)` runs every frame while the stage moves, with p = 0
 * when the section's top reaches the viewport top and p = 1 when its bottom reaches the viewport bottom.
 * The value p chases the real scroll position, which gives the inertia the reference site has without
 * taking over the browser's own scrolling. The loop stops by itself once p has caught up.
 * Attach the returned ref to the tall section; apply writes CSS custom properties onto it.
 */
export function useScrollScene(apply) {
  const ref = useRef(null);
  const latest = useRef(apply);
  latest.current = apply;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let shown = 0;
    let raf = 0;
    let first = true;

    const target = () => {
      const r = el.getBoundingClientRect();
      const room = r.height - window.innerHeight;
      return room > 0 ? clamp(-r.top / room) : 0;
    };
    const frame = () => {
      raf = 0;
      const t = target();
      shown = reduce || first ? t : shown + (t - shown) * 0.12;
      first = false;
      if (Math.abs(t - shown) < 0.0004) shown = t;
      latest.current(shown, el);
      if (shown !== t) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    frame();
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', kick);
    };
  }, []);

  return ref;
}

/** Writes several CSS custom properties at once. */
export const setVars = (el, vars) => {
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, typeof v === 'number' ? v.toFixed(4) : v);
};
