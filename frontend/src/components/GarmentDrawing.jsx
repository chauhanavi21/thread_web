import { useId } from 'react';

// Fallback artwork: a garment drawn as an SVG silhouette in the chosen colour. ProductImage shows a photo when one
// exists and falls back to this, so a product without a photo still has a picture that matches its colour swatch.

/** Mixes a #rrggbb colour toward black (amount < 0) or white (amount > 0). */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Each shape gets (fill, dark, light) and returns SVG children drawn in a 200x200 box.
const SHAPES = {
  't-shirts': (f, d) => (
    <>
      <path d="M70 30 L40 45 L18 82 L44 94 L56 78 L56 172 L144 172 L144 78 L156 94 L182 82 L160 45 L130 30 Q100 54 70 30 Z" fill={f} />
      <path d="M70 30 Q100 54 130 30" fill="none" stroke={d} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  hoodies: (f, d, l) => (
    <>
      <path d="M72 42 L36 58 L18 152 L44 158 L56 112 L56 176 L144 176 L144 112 L156 158 L182 152 L164 58 L128 42 Z" fill={f} />
      <path d="M72 42 Q100 6 128 42 Q100 70 72 42 Z" fill={l} stroke={d} strokeWidth="2" />
      <path d="M92 58 L90 92 M108 58 L110 92" stroke={d} strokeWidth="3" strokeLinecap="round" />
      <path d="M70 140 L130 140 L136 170 L64 170 Z" fill={l} opacity=".55" />
      <path d="M56 176 H144 M18 152 L44 158 M182 152 L156 158" stroke={d} strokeWidth="5" opacity=".5" />
    </>
  ),
  shirts: (f, d, l) => (
    <>
      <path d="M72 30 L40 46 L20 84 L46 96 L56 80 L56 176 L144 176 L144 80 L154 96 L180 84 L160 46 L128 30 Z" fill={f} />
      <path d="M72 30 L100 62 L128 30 L116 26 L100 40 L84 26 Z" fill={l} stroke={d} strokeWidth="2" strokeLinejoin="round" />
      <path d="M100 62 V176" stroke={d} strokeWidth="2" />
      <g fill={d}>
        <circle cx="105" cy="84" r="2" /><circle cx="105" cy="108" r="2" /><circle cx="105" cy="132" r="2" /><circle cx="105" cy="156" r="2" />
      </g>
    </>
  ),
  jeans: (f, d, l) => (
    <>
      <path d="M60 22 H140 L150 180 H108 L100 76 L92 180 H50 Z" fill={f} />
      <rect x="60" y="22" width="80" height="12" fill={l} stroke={d} strokeWidth="2" />
      <path d="M100 34 V76" stroke={d} strokeWidth="2" />
      <path d="M66 36 Q76 54 90 46 M134 36 Q124 54 110 46" fill="none" stroke={d} strokeWidth="2" />
      <path d="M52 170 H92 M108 170 H148" stroke={d} strokeWidth="3" opacity=".5" />
    </>
  ),
  shorts: (f, d, l) => (
    <>
      <path d="M58 40 H142 L154 140 H108 L100 90 L92 140 H46 Z" fill={f} />
      <rect x="58" y="40" width="84" height="12" fill={l} stroke={d} strokeWidth="2" />
      <path d="M100 52 V90" stroke={d} strokeWidth="2" />
      <path d="M62 56 Q72 72 86 64" fill="none" stroke={d} strokeWidth="2" />
    </>
  ),
  jackets: (f, d, l) => (
    <>
      <path d="M72 30 L36 48 L18 156 L46 162 L56 116 L56 176 L144 176 L144 116 L154 162 L182 156 L164 48 L128 30 Z" fill={f} />
      <path d="M72 30 L100 54 L128 30 L120 22 L100 36 L80 22 Z" fill={l} stroke={d} strokeWidth="2" strokeLinejoin="round" />
      <path d="M100 54 V176" stroke={d} strokeWidth="3" />
      <path d="M68 120 H92 M108 120 H132" stroke={d} strokeWidth="3" strokeLinecap="round" opacity=".6" />
    </>
  ),
  dresses: (f, d, l) => (
    <>
      <path d="M78 20 L86 20 L100 58 L114 20 L122 20 L126 60 L156 182 H44 L74 60 Z" fill={f} />
      <path d="M74 60 L126 60 L122 84 L78 84 Z" fill={l} opacity=".55" />
      <path d="M100 58 L78 84 L122 84 Z" fill="none" stroke={d} strokeWidth="2" strokeLinejoin="round" />
      <path d="M92 182 L96 110 M108 182 L104 110" stroke={d} strokeWidth="2" opacity=".35" />
    </>
  ),
  knitwear: (f, d, l) => (
    <>
      <path d="M74 32 L36 52 L16 152 L46 160 L56 112 L56 176 L144 176 L144 112 L154 160 L184 152 L164 52 L126 32 Q100 50 74 32 Z" fill={f} />
      <path d="M74 32 Q100 50 126 32" fill="none" stroke={l} strokeWidth="9" strokeLinecap="round" />
      <path d="M56 168 H144 M18 146 L48 154 M182 146 L152 154" stroke={l} strokeWidth="8" />
      <g stroke={d} strokeWidth="2" opacity=".35" fill="none">
        <path d="M84 70 V160 M100 66 V160 M116 70 V160" />
      </g>
    </>
  ),
  skirts: (f, d, l) => (
    <>
      <path d="M64 44 H136 L164 180 H36 Z" fill={f} />
      <rect x="64" y="40" width="72" height="12" fill={l} stroke={d} strokeWidth="2" />
      <path d="M76 52 L58 180 M92 52 L84 180 M108 52 L116 180 M124 52 L142 180" stroke={d} strokeWidth="2" opacity=".4" />
    </>
  ),
  caps: (f, d, l) => (
    <>
      <path d="M44 124 Q42 54 100 54 Q158 54 156 124 Z" fill={f} />
      <path d="M40 124 Q100 110 160 124 Q196 132 184 146 Q100 130 40 136 Z" fill={l} stroke={d} strokeWidth="2" />
      <circle cx="100" cy="54" r="5" fill={d} />
      <path d="M100 56 V118" stroke={d} strokeWidth="2" opacity=".4" />
    </>
  ),
  beanies: (f, d, l) => (
    <>
      <path d="M46 128 Q44 44 100 44 Q156 44 154 128 Z" fill={f} />
      <rect x="40" y="118" width="120" height="34" rx="8" fill={l} stroke={d} strokeWidth="2" />
      <path d="M62 52 V118 M80 46 V118 M100 44 V118 M120 46 V118 M138 52 V118" stroke={d} strokeWidth="2" opacity=".3" />
    </>
  ),
  bags: (f, d, l) => (
    <>
      <path d="M72 84 Q72 30 100 30 Q128 30 128 84" fill="none" stroke={d} strokeWidth="7" strokeLinecap="round" />
      <path d="M42 80 H158 L150 178 H50 Z" fill={f} />
      <path d="M42 80 H158" stroke={d} strokeWidth="3" />
      <rect x="80" y="104" width="40" height="30" rx="3" fill={l} opacity=".55" />
    </>
  ),
  scarves: (f, d, l) => (
    <>
      <path d="M52 40 Q100 18 148 40 L154 72 Q100 52 46 72 Z" fill={f} />
      <path d="M58 66 H98 L92 180 H52 Z" fill={f} />
      <path d="M104 60 H146 L138 172 H98 Z" fill={l} />
      <path d="M54 172 V186 M62 172 V186 M70 172 V186 M80 172 V186 M90 172 V186" stroke={d} strokeWidth="2" />
      <path d="M100 164 V178 M110 164 V178 M120 164 V178 M130 164 V178" stroke={d} strokeWidth="2" />
    </>
  ),
};

/**
 * `type` picks the silhouette and `color` (#rrggbb) fills it. The SVG filter gives it a puffy, lit look
 * (light from the upper left), soft cloth wrinkles and a fine woven grain, so it reads as fabric, not flat vector art.
 *  - `viewBox` crops into the drawing (the hero zooms on the chest).
 *  - `hit` makes only the painted garment clickable, not its whole square, so overlapping garments each
 *    keep their own click area.
 */
export default function GarmentDrawing({ type, color = '#b8bbc0', name, className = '', square = true, fit = 'meet', bg = 'bg-brand-200', viewBox = '0 0 200 200', hit = false }) {
  const Shape = SHAPES[type] ?? SHAPES['t-shirts'];
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const dark = shade(color, -0.38);
  const light = shade(color, 0.14);
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={`xMidYMid ${fit}`}
      role="img"
      aria-label={name}
      className={`${square ? 'aspect-square' : ''} w-full ${bg} ${className}`}
      style={hit ? { pointerEvents: 'none' } : undefined}
    >
      <defs>
        <filter id={id} filterUnits="userSpaceOnUse" x="0" y="0" width="200" height="200" colorInterpolationFilters="sRGB">
          {/* Rounded edges: light the blurred silhouette as if it were a height map. */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
          <feDiffuseLighting in="blur" surfaceScale="3.6" diffuseConstant="1" lightingColor="#ffffff" result="edge">
            <feDistantLight azimuth="235" elevation="56" />
          </feDiffuseLighting>
          <feComposite in="SourceGraphic" in2="edge" operator="arithmetic" k1="1.3" k2="0" k3="0" k4="0" result="rounded" />
          {/* Cloth wrinkles: a low-frequency noise height map, lit from the same side. */}
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.032" numOctaves="3" seed="7" result="folds" />
          <feDiffuseLighting in="folds" surfaceScale="1.7" diffuseConstant="1" lightingColor="#ffffff" result="wrinkle">
            <feDistantLight azimuth="235" elevation="62" />
          </feDiffuseLighting>
          <feComposite in="rounded" in2="wrinkle" operator="arithmetic" k1="1.22" k2="0" k3="0" k4="0" result="shaded" />
          {/* Fine weave: speckle that darkens a little, clipped to the garment. */}
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.5 0 0 0 -0.3" result="speck" />
          <feComposite in="speck" in2="SourceAlpha" operator="in" result="grain" />
          <feMerge>
            <feMergeNode in="shaded" />
            <feMergeNode in="grain" />
          </feMerge>
        </filter>
      </defs>
      <ellipse cx="100" cy="187" rx="64" ry="5.5" fill="#000" opacity=".14" />
      <g
        filter={`url(#${id})`}
        stroke={dark}
        strokeOpacity=".6"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={hit ? { pointerEvents: 'visiblePainted' } : undefined}
      >
        {Shape(color, dark, light)}
      </g>
    </svg>
  );
}
