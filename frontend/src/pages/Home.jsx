import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Hero from '../components/Hero.jsx';
import PanelStrip from '../components/PanelStrip.jsx';
import ProductCard from '../components/ProductCard.jsx';
import ProductImage from '../components/ProductImage.jsx';
import Reveal from '../components/Reveal.jsx';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';

const CATEGORIES = [
  { key: 'women', title: 'Women', blurb: 'Dresses, knitwear, denim & outerwear', type: 'dresses', color: '#b4532a' },
  { key: 'men', title: 'Men', blurb: 'Tees, hoodies, shirts & jeans', type: 'hoodies', color: '#3b3f45' },
  { key: 'accessories', title: 'Accessories', blurb: 'Caps, beanies, scarves & totes', type: 'beanies', color: '#6b6b3a' },
];

// Tilted cards in the black section: [type, colour, rotation in degrees, x offset in %, y offset in %]
const STACK = [
  ['jackets', '#6b6b3a', -9, 0, 0],
  ['knitwear', '#ecc3c0', 6, 14, 14],
  ['hoodies', '#6e1f2f', -4, 4, 28],
];

export default function Home() {
  const { data, error, loading } = useAsync(() => api.products({ featured: '1' }), []);

  return (
    <>
      <Hero product={data?.[0]} />

      {/* ---------- Statement ---------- */}
      <section className="page py-24 text-center sm:py-36">
        <Reveal>
          <h2 className="mx-auto max-w-4xl text-5xl sm:text-7xl">Our pieces are made to be lived in</h2>
          <p className="mx-auto mt-8 max-w-md text-sm font-bold uppercase leading-relaxed">
            We prioritise clarity, function and the power of the grid to elevate everyday standards.
          </p>
        </Reveal>
      </section>

      {/* ---------- 3D panel strip ---------- */}
      <section className="overflow-hidden py-10">
        <h2 className="page mb-4 text-xl sm:text-2xl">Threads off [ grid ]</h2>
        {data && <PanelStrip products={data.slice(0, 10)} />}
        <Status loading={loading} error={error} />
      </section>

      {/* ---------- Product grid ---------- */}
      <section className="page mt-20 sm:mt-32">
        <Reveal className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-4xl sm:text-6xl">Best sellers</h2>
          <Link to="/shop" className="shrink-0 text-sm font-bold uppercase underline underline-offset-4">[ View all ]</Link>
        </Reveal>
        {data && (
          <div className="cell-grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {data.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* ---------- Black section ---------- */}
      <section className="relative mt-24 overflow-hidden bg-brand-950 py-24 text-brand-50 sm:mt-40 sm:py-32">
        <div className="page relative min-h-[34rem]">
          <p className="text-sm leading-tight">Season<br />fall26</p>
          <h2 className="mt-2 text-[clamp(4rem,15vw,13rem)] !text-brand-50">Intention</h2>
          <h2 className="ml-[22%] text-[clamp(4rem,15vw,13rem)] !text-brand-200">On wear</h2>
          <p className="mt-6 max-w-xs text-sm">Our pieces are chosen through a considered process. We are all in.</p>

          <div className="pointer-events-none absolute right-[8%] top-0 hidden h-72 w-52 lg:block" aria-hidden="true">
            {STACK.map(([type, color, rot, x, y], i) => (
              <Reveal key={type} delay={i * 150} className="absolute w-44 border border-white/30" style={{ left: `${x}%`, top: `${y}%`, transform: `rotate(${rot}deg)` }}>
                <ProductImage type={type} color={color} name="" bg="bg-brand-700" />
              </Reveal>
            ))}
          </div>

          <div className="absolute bottom-0 right-4 text-right font-display text-2xl uppercase leading-tight sm:right-10">
            Chapter<br />0.001<br /><br />Index<br />2/2
          </div>
        </div>
      </section>

      {/* ---------- Categories ---------- */}
      <section className="page mt-20 sm:mt-32">
        <div className="cell-grid sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <Link key={c.key} to={`/shop?category=${c.key}`} className="group relative block overflow-hidden bg-brand-50 p-2">
              <ProductImage type={c.type} color={c.color} name="" className="transition duration-700 group-hover:scale-105" />
              <div className="flex items-center justify-between px-1 py-3">
                <div>
                  <h3 className="text-3xl">{c.title}</h3>
                  <p className="mt-1 text-xs">{c.blurb}</p>
                </div>
                <span className="text-2xl transition group-hover:translate-x-1" aria-hidden="true">↗</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- Giant word + call to action ---------- */}
      <section className="mt-24 overflow-hidden text-center sm:mt-40">
        <Reveal>
          <p className="text-sm">Dialogue</p>
          <Link to="/shop" className="mt-3 inline-block font-display text-xl uppercase hover:underline">[ Shop all pieces ]</Link>
        </Reveal>
        <Reveal as="p" className="mt-10 font-display text-[clamp(6rem,26vw,24rem)] uppercase leading-[0.85]">Wear&amp;</Reveal>
      </section>
    </>
  );
}
