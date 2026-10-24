import ProductImage from './ProductImage.jsx';
import { ease, setVars, span, useScrollScene } from './useScrollScene.js';

// Tilted pictures that fly in along a diagonal: [garment, colour, final x %, final y %, tilt deg]
const CARDS = [
  ['jackets', '#6b6b3a', 70, 6, -10],
  ['knitwear', '#ecc3c0', 74, 20, 7],
  ['hoodies', '#6e1f2f', 66, 34, -4],
  ['dresses', '#b4532a', 72, 48, 9],
];

const CITIES = [
  ['Paris, FR', 'Concept boutiques and independent fashion.'],
  ['Tokyo, JP', 'Avant-garde retail and cultural concept stores.'],
  ['Berlin, DE', 'Concept boutiques and independent fashion.'],
  ['New York, US', 'Global flagship partners and multi-brand boutiques.'],
];

/**
 * The black "INTENTION / ON WEAR" scene, scroll-driven (440vh):
 *   0.00 – 0.18  the page fades from off-white to black
 *   0.12 – 0.42  tilted pictures fly in along a diagonal and settle in a stack
 *   0.20 – 0.50  the two giant words slide in from opposite sides
 *   0.50 – 0.64  the words, pictures and notes lift away and fade, clearing the stage
 *   0.52 – 0.95  four giant numerals rise from the bottom one after another, each with a city label and text
 */
export default function DarkScene() {
  const ref = useScrollScene((p, el) => {
    const vars = {
      '--black': span(p, 0, 0.18),
      '--w1': ease(span(p, 0.2, 0.42)),
      '--w2': ease(span(p, 0.28, 0.5)),
      '--meta': ease(span(p, 0.4, 0.55)),
      '--gone': ease(span(p, 0.5, 0.64)),
    };
    CARDS.forEach((_, i) => { vars[`--c${i}`] = ease(span(p, 0.12 + i * 0.06, 0.34 + i * 0.06)); });
    CITIES.forEach((_, i) => { vars[`--n${i}`] = ease(span(p, 0.52 + i * 0.1, 0.66 + i * 0.1)); });
    setVars(el, vars);
  });

  return (
    <section ref={ref} style={{ '--black': 0 }} className="relative h-[440vh]">
      <div className="sticky top-0 h-screen overflow-hidden" style={{ backgroundColor: 'color-mix(in srgb, #000 calc(var(--black) * 100%), #f4f4f4)' }}>
        <div className="absolute inset-0 text-brand-50" style={{ opacity: 'var(--black)' }}>
          <div className="absolute inset-0" style={{ opacity: 'calc(1 - var(--gone))', transform: 'translateY(calc(var(--gone) * -22vh))' }}>
          <p className="absolute left-[10%] top-[16%] text-sm leading-tight">Season<br />fall26</p>

          <h2 className="absolute left-3 top-[24%] text-[clamp(4rem,16vw,15rem)] !text-brand-50" style={{ transform: 'translateX(calc((1 - var(--w1)) * -60%))', opacity: 'var(--w1)' }}>
            Intention
          </h2>
          <h2 className="absolute left-[28%] top-[50%] text-[clamp(4rem,16vw,15rem)] !text-brand-200" style={{ transform: 'translateX(calc((1 - var(--w2)) * 60%))', opacity: 'var(--w2)' }}>
            On wear
          </h2>
          <p className="absolute left-[4%] top-[44%] text-sm" style={{ opacity: 'var(--meta)' }}>We are all in.</p>
          <p className="absolute bottom-[10%] left-[8%] max-w-[16rem] text-sm leading-snug" style={{ opacity: 'var(--meta)' }}>
            Our stockists are selected through a curated process. Prioritising alignment with our design philosophy, material standards and cultural positioning.
          </p>
          <div className="absolute bottom-[14%] right-4 text-right font-display text-2xl uppercase leading-tight" style={{ opacity: 'var(--meta)' }}>
            Chapter<br />0.001<br /><br />Index<br />2/2
          </div>

          {CARDS.map(([type, color, x, y, rot], i) => (
            <div
              key={type}
              className="pointer-events-none absolute hidden w-[11vw] min-w-28 border border-white/30 sm:block"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                opacity: `var(--c${i})`,
                transform: `translate(calc((1 - var(--c${i})) * 28vw), calc((1 - var(--c${i})) * -34vh)) rotate(${rot}deg)`,
              }}
              aria-hidden="true"
            >
              <ProductImage type={type} color={color} name="" bg="bg-brand-700" />
            </div>
          ))}

          </div>

          {/* Four giant numerals with a city label, rising from the bottom. */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-around px-4">
            {CITIES.map(([city, text], i) => (
              <div key={city} className="w-[22%]" style={{ transform: `translateY(calc((1 - var(--n${i})) * 110%))`, opacity: `var(--n${i})` }}>
                <p className="mb-1 bg-brand-50 px-1 font-display text-lg uppercase text-brand-950">{city}</p>
                <p className="font-display text-[clamp(8rem,26vw,24rem)] leading-[0.8] text-brand-50">{i + 1}</p>
                <p className="mt-2 hidden text-xs leading-snug sm:block">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
