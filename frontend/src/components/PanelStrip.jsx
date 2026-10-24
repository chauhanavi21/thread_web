import { useState } from 'react';
import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';

const PANEL_H = 360; // px
const STEP_X = 8.2; // % each panel is shifted right of the previous one
const STEP_Y = 34; // px each panel is raised above the previous one

/**
 * A row of garments standing on translucent cards that climb diagonally, like the "OFF [ GRID ]"
 * strip in the reference. Each card is skewed so its top edge tilts, and only its top and right
 * edges are drawn. Cards overlap, so the card in front veils the garment of the one behind it.
 * Hovering lifts a garment and shows its name on a tag. On narrow screens the strip becomes a
 * plain horizontal scroller because the diagonal layout needs width.
 */
export default function PanelStrip({ products }) {
  const [hover, setHover] = useState(null);

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

      <div className="relative mx-auto hidden w-full max-w-[1440px] md:block" style={{ height: PANEL_H + 60 + STEP_Y * (products.length - 1) }}>
        {products.map((p, i) => {
          const active = hover === p.id;
          return (
            <Link
              key={p.id}
              to={`/product/${p.slug}`}
              onMouseEnter={() => setHover(p.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(p.id)}
              onBlur={() => setHover(null)}
              aria-label={p.name}
              className="absolute block border-r-2 border-t-[3px] border-brand-500 bg-brand-950/[0.05]"
              style={{
                left: `${3 + i * STEP_X}%`,
                bottom: i * STEP_Y,
                width: '15%',
                height: PANEL_H,
                zIndex: i,
                transform: 'skewY(4deg)',
                transformOrigin: 'left bottom',
              }}
            >
              {/* Counter-skew keeps the garment upright while its card is tilted. */}
              <div
                className="absolute inset-x-[-10%] bottom-2 transition-transform duration-500 ease-out"
                style={{ transform: `skewY(-4deg) translateY(${active ? -16 : 0}px) scale(${active ? 1.1 : 1})`, transformOrigin: 'bottom' }}
              >
                <ProductImage type={p.type} color={p.colors[0].hex} name={p.name} bg="bg-transparent" className="drop-shadow-md" />
              </div>
              <span
                className={`pointer-events-none absolute left-1/2 top-[48%] z-10 whitespace-nowrap bg-brand-800/90 px-2 py-1 font-display text-lg uppercase text-white transition-opacity duration-300 ${
                  active ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ transform: 'translateX(-50%) skewY(-4deg)' }}
              >
                {p.name}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
