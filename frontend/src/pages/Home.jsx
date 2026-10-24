import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import DarkScene from '../components/DarkScene.jsx';
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

/** Perceived brightness of a #rrggbb colour, 0..255. */
const luma = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};

export default function Home() {
  const { data, error, loading } = useAsync(() => api.products({ featured: '1' }), []);
  // The hero zooms into one garment, so choose a mid-light one that shows the fabric (not a flat black or white blob).
  const heroPick = useMemo(() => {
    const tops = data?.filter((p) => ['hoodies', 'knitwear', 't-shirts', 'shirts', 'jackets'].includes(p.type));
    return tops?.length ? [...tops].sort((a, b) => Math.abs(luma(a.colors[0].hex) - 170) - Math.abs(luma(b.colors[0].hex) - 170))[0] : data?.[0];
  }, [data]);

  return (
    <>
      <Hero product={heroPick} />

      {/* ---------- Panel strip scene ---------- */}
      {data && <PanelStrip products={data.slice(0, 10)} />}
      <Status loading={loading} error={error} />

      {/* ---------- Lookbook statement ---------- */}
      <section className="page py-24 text-center sm:py-40">
        <Reveal>
          <h2 className="mx-auto max-w-4xl text-5xl sm:text-7xl">Our lookbooks serve as a dialogue</h2>
          <p className="mx-auto mt-8 max-w-md text-sm font-bold uppercase leading-relaxed">
            We prioritise clarity, function and the power of the grid to elevate everyday standards.
          </p>
          <p className="mx-auto mt-6 max-w-lg text-xs leading-relaxed">
            Our lookbooks serve as a dialogue between the garment and the void. By prioritising volume over traditional tailoring, each piece becomes a structural study. We invite you to explore the intersection of form and function through this curated visual sequence.
          </p>
        </Reveal>
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

      {/* ---------- Black scene ---------- */}
      <div className="mt-24 sm:mt-40"><DarkScene /></div>

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
