import { useState } from 'react';
import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';
import { ease, span, useScrollScene, setVars } from './useScrollScene.js';

const PANEL_W = 15; // % of the stage width
const PANEL_H = 52; // % of the stage height
const STEP_X = 7.6; // % each panel is shifted right of the previous one
const STEP_Y = 4.2; // % of the stage height each panel is raised above the previous one

/**
 * The "OFF [ GRID ]" scene. A tall section whose stage sticks to the screen while you scroll:
 *   0.00 – 0.22  one framed garment sways in the middle of the page
 *   0.22 – 0.46  the other panels stack up behind it as a tight pile, then fan out into the diagonal strip
 *   0.46 – 0.78  the strip holds, so you can hover and click a garment
 *   0.78 – 1.00  the whole strip slides up and out of view
 * Each panel is skewed so its top edge tilts. Panels overlap, so the one in front veils the garment of the
 * one behind it. Every garment is its own link and only its painted shape takes clicks, so overlapping pieces
 * stay individually clickable, and the hovered one rises to the front.
 * On narrow screens this becomes a plain horizontal scroller, because the diagonal layout needs width.
 */
export default function PanelStrip({ products }) {
  const [hover, setHover] = useState(null);
  const n = products.length;

  const ref = useScrollScene((p, el) => {
    setVars(el, {
      '--fan': ease(span(p, 0.22, 0.46)),
      '--sway': Math.sin(p * 40) * (1 - span(p, 0.15, 0.3)),
      '--out': ease(span(p, 0.78, 1)),
    });
  });

  return (
    <>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-4 md:hidden">
        {products.map((p) => (
          <Link key={p.id} to={`/product/${p.slug}`} className="w-40 shrink-0 border border-brand-400">
            <ProductImage type={p.type} color={p.colors[0].hex} name={p.name} />
            <p className="px-2 py-1.5 text-xs font-bold uppercase">{p.name}</p>
          </Link>
        ))}
      </div>

      <section ref={ref} style={{ '--fan': 0, '--sway': 0, '--out': 0 }} className="relative hidden h-[360vh] md:block">
        <div className="sticky top-0 h-screen overflow-hidden" style={{ transform: 'translateY(calc(var(--out) * -100%))' }}>
          <h2 className="absolute left-[8%] top-[34%] text-xl sm:text-2xl">Threads off [ grid ]</h2>

          {products.map((p, i) => {
            const active = hover === p.id;
            // Final spot of panel i on the diagonal; before the fan, they all sit on top of the first one.
            const x = 8 + i * STEP_X;
            const y = 8 + i * STEP_Y;
            const stackX = 38 + i * 0.5;
            const stackY = 22 + i * 0.35;
            return (
              <div
                key={p.id}
                className="absolute"
                style={{
                  width: `${PANEL_W}%`,
                  height: `${PANEL_H}%`,
                  left: `calc(${stackX}% + (${x - stackX}%) * var(--fan))`,
                  bottom: `calc(${stackY}% + (${y - stackY}%) * var(--fan))`,
                  zIndex: active ? 100 : i,
                  transform: `skewY(4deg) rotate(calc(var(--sway) * ${i === 0 ? 2.5 : 0}deg))`,
                  transformOrigin: 'left bottom',
                }}
              >
                {/* The panel itself: translucent card with a top and right edge. */}
                <div className="absolute inset-0 border-r-2 border-t-[3px] border-brand-500 bg-brand-950/[0.05]" />
                {/* One link per garment. The link box ignores the pointer; only the painted shape of the SVG inside takes it,
                    so overlapping garments each keep their own click area and the empty corners fall through. */}
                <Link
                  to={`/product/${p.slug}`}
                  aria-label={p.name}
                  onMouseEnter={() => setHover(p.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(p.id)}
                  onBlur={() => setHover(null)}
                  className="pointer-events-none absolute inset-x-[-12%] bottom-[2%] top-[6%] block"
                >
                  {/* Counter-skew keeps the garment upright while its card is tilted. */}
                  <div
                    className="h-full w-full transition-transform duration-500 ease-out"
                    style={{ transform: `skewY(-4deg) translateY(${active ? -3 : 0}%) scale(${active ? 1.08 : 1})`, transformOrigin: 'bottom' }}
                  >
                    <ProductImage type={p.type} color={p.colors[0].hex} name={p.name} bg="bg-transparent" fit="meet" square={false} hit className="h-full drop-shadow-md" />
                  </div>
                </Link>
                <span
                  className={`pointer-events-none absolute left-1/2 top-[46%] z-10 whitespace-nowrap bg-brand-800/90 px-2 py-1 font-display text-lg uppercase text-white transition-opacity duration-300 ${
                    active ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ transform: 'translateX(-50%) skewY(-4deg)' }}
                >
                  {p.name}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
