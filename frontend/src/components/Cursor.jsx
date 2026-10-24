import { useEffect, useRef } from 'react';

/**
 * Small diamond that trails the mouse, tilts with its speed and grows over links and buttons.
 * It uses mix-blend-mode: difference, so it reads black on the pale page and white on dark sections.
 * Only mounted for fine pointers (mouse / trackpad); touch screens never see it.
 */
export default function Cursor() {
  const ref = useRef(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return undefined;
    const el = ref.current;
    let x = -100;
    let y = -100;
    let cx = x;
    let cy = y;
    let tilt = 0;
    let grow = 1;
    let target = 1;
    let raf = 0;

    const onMove = (e) => {
      x = e.clientX;
      y = e.clientY;
      el.style.opacity = '1';
    };
    const onOver = (e) => {
      target = e.target.closest?.('a, button, select, input, label, [role="button"]') ? 2.2 : 1;
    };
    const onLeave = () => {
      el.style.opacity = '0';
    };

    const tick = () => {
      const dx = x - cx;
      const dy = y - cy;
      cx += dx * 0.2;
      cy += dy * 0.2;
      tilt += (Math.max(-40, Math.min(40, dx * 1.6)) - tilt) * 0.15;
      grow += (target - grow) * 0.2;
      el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%) rotate(${45 + tilt}deg) scale(${grow})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseover', onOver);
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return <div ref={ref} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[100] h-3.5 w-3.5 bg-white opacity-0 mix-blend-difference" />;
}
