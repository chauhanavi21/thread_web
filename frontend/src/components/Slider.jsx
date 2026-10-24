import { useEffect, useRef, useState } from 'react';

/**
 * Horizontal slider for any row of tiles. It is a plain scroll container with scroll-snap, so touch swipe,
 * trackpad and keyboard all work natively on every screen size; the round arrows are an extra for mouse users
 * and disable themselves at either end. Give each child a width (e.g. `w-[70%] sm:w-[40%] lg:w-[23%]`).
 */
export default function Slider({ children, label }) {
  const track = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    const update = () => setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [children]);

  const move = (dir) => {
    const el = track.current;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  const arrow = 'grid h-10 w-10 place-items-center rounded-full border border-brand-900 bg-brand-50 transition hover:bg-brand-900 hover:text-white disabled:cursor-not-allowed disabled:border-brand-300 disabled:text-brand-300 disabled:hover:bg-brand-50 disabled:hover:text-brand-300';

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <button type="button" className={arrow} onClick={() => move(-1)} disabled={edge.start} aria-label={`Previous ${label ?? 'items'}`}>←</button>
        <button type="button" className={arrow} onClick={() => move(1)} disabled={edge.end} aria-label={`Next ${label ?? 'items'}`}>→</button>
      </div>
      <div
        ref={track}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:gap-6 lg:px-0"
        tabIndex={0}
        role="group"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}
