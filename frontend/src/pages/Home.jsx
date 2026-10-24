import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import ProductImage from '../components/ProductImage.jsx';
import Reveal from '../components/Reveal.jsx';
import Slider from '../components/Slider.jsx';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';

const CATEGORIES = [
  { key: 'women', title: 'Women', blurb: 'Dresses, knitwear, denim', slug: 'wrap-midi-dress' },
  { key: 'men', title: 'Men', blurb: 'Tees, hoodies, shirts', slug: 'heavyweight-hoodie' },
  { key: 'accessories', title: 'Accessories', blurb: 'Caps, beanies, totes', slug: 'rib-beanie' },
];

const PERKS = [
  ['Free shipping', 'On every order over $100'],
  ['Honest fabrics', 'Organic cotton, linen and wool'],
  ['Easy returns', '30 days, no questions asked'],
];

function Subscribe() {
  const [done, setDone] = useState(false);
  return (
    <section className="page mt-20 sm:mt-28">
      <div className="grid gap-8 rounded-3xl bg-brand-100 p-8 sm:p-12 lg:grid-cols-2 lg:items-end">
        <div>
          <p className="eyebrow">Newsletter</p>
          <h2 className="mt-3 text-4xl sm:text-5xl">Stay in the <em>loop</em></h2>
          <p className="mt-3 max-w-sm text-brand-600">New drops, restocks and the occasional offer. Never more than once a week.</p>
        </div>
        {done ? (
          <p className="text-lg" role="status">Thank you. This demo does not send email, so nothing was stored.</p>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); setDone(true); }}
            className="flex items-end gap-3 border-b border-brand-900 pb-2"
          >
            <label className="sr-only" htmlFor="sub-email">Email address</label>
            <input id="sub-email" type="email" required placeholder="Your email" className="w-full bg-transparent font-display text-3xl placeholder:text-brand-400 focus:outline-none sm:text-4xl" />
            <button className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-900 text-white transition hover:bg-accent-600" aria-label="Subscribe">→</button>
          </form>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const featured = useAsync(() => api.products({ featured: '1' }), []);
  const all = useAsync(() => api.products({ sort: 'rating' }), []);
  const slides = featured.data?.slice(0, 10) ?? [];
  const grid = all.data?.slice(0, 8) ?? [];

  return (
    <>
      {/* ---------- Hero: copy on the left, a large picture with a floating product card on the right ---------- */}
      <section className="page grid items-center gap-8 py-8 sm:py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-16">
        <div>
          <p className="eyebrow animate-fade-up">New season · Fall 26</p>
          <h1 className="mt-4 animate-fade-up text-[clamp(3.1rem,9vw,6.6rem)] [animation-delay:120ms]">
            Clothes made to be <em className="text-accent-600">worn</em> on repeat
          </h1>
          <p className="mt-5 max-w-md animate-fade-up text-base text-brand-600 [animation-delay:240ms] sm:text-lg">
            Well-cut essentials in organic cotton, linen and wool, in colours that go with everything.
          </p>
          <div className="mt-8 flex animate-fade-up flex-wrap gap-3 [animation-delay:360ms]">
            <Link to="/shop?category=women" className="btn px-7 py-3.5">Shop women</Link>
            <Link to="/shop?category=men" className="btn btn-outline px-7 py-3.5">Shop men</Link>
          </div>
        </div>

        <div className="relative animate-fade-in [animation-delay:150ms]">
          <ProductImage slug="wrap-midi-dress" type="dresses" color="#b4532a" name="Model wearing a burgundy dress" ratio="aspect-[4/5] sm:aspect-[5/6] lg:aspect-[4/5]" className="rounded-3xl" priority />
          <Link
            to="/product/wrap-midi-dress"
            className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl bg-white/90 p-3 shadow-lift backdrop-blur transition hover:bg-white sm:left-auto sm:right-5 sm:w-72"
          >
            <span>
              <span className="block text-xs text-brand-500">Dresses</span>
              <span className="block text-[15px] font-medium">Wrap Midi Dress</span>
              <span className="block text-sm text-brand-600">$89.00</span>
            </span>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-900 text-white" aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      {/* ---------- Perks ---------- */}
      <section className="page">
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-brand-200 bg-brand-200 sm:grid-cols-3">
          {PERKS.map(([title, text]) => (
            <li key={title} className="bg-brand-50 px-6 py-5">
              <p className="font-medium text-brand-900">{title}</p>
              <p className="text-sm text-brand-500">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- See what's new: slider ---------- */}
      <section className="page mt-20 sm:mt-28">
        <Reveal className="mb-2 flex items-end justify-between gap-4">
          <h2 className="text-4xl sm:text-6xl">See what&rsquo;s <em>new</em></h2>
          <Link to="/shop" className="shrink-0 text-sm underline underline-offset-4 hover:text-accent-600">Shop all</Link>
        </Reveal>
        <Status loading={featured.loading} error={featured.error} />
        {slides.length > 0 && (
          <Slider label="new arrivals">
            {slides.map((p) => (
              <div key={p.id} className="w-[68%] shrink-0 snap-start sm:w-[40%] md:w-[31%] lg:w-[23.5%]">
                <ProductCard product={p} />
              </div>
            ))}
          </Slider>
        )}
      </section>

      {/* ---------- Discount banner ---------- */}
      <section className="page mt-20 sm:mt-28">
        <Reveal className="relative overflow-hidden rounded-3xl bg-brand-900 text-white">
          <div className="grid items-stretch lg:grid-cols-2">
            <ProductImage slug="shirt-dress" type="dresses" color="#b4532a" name="" ratio="aspect-[5/4] lg:aspect-auto lg:h-full" className="lg:min-h-[420px]" />
            <div className="flex flex-col justify-center gap-5 p-8 sm:p-12">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-500 text-lg font-semibold">%</span>
              <h2 className="text-4xl !text-white sm:text-5xl">Discover your new favourite in our <em>best sellers</em></h2>
              <p className="max-w-md text-brand-300">The pieces our customers keep coming back for. Free shipping when your bag passes $100.</p>
              <div><Link to="/shop?sort=rating" className="btn border-white bg-white text-brand-900 hover:border-accent-500 hover:bg-accent-500 hover:text-white">Shop collection →</Link></div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- Categories ---------- */}
      <section className="page mt-20 sm:mt-28">
        <Reveal><h2 className="mb-8 text-4xl sm:text-6xl">Shop by <em>category</em></h2></Reveal>
        <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.key} delay={i * 100}>
              <Link to={`/shop?category=${c.key}`} className="group relative block overflow-hidden rounded-3xl">
                <ProductImage slug={c.slug} name="" ratio="aspect-[4/3] sm:aspect-[3/4]" className="transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 text-white">
                  <div>
                    <h3 className="text-4xl !text-white">{c.title}</h3>
                    <p className="text-sm text-white/80">{c.blurb}</p>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand-900 transition group-hover:bg-accent-500 group-hover:text-white" aria-hidden="true">↗</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Top rated grid ---------- */}
      <section className="page mt-20 sm:mt-28">
        <Reveal className="mb-8 flex items-end justify-between gap-4">
          <h2 className="text-4xl sm:text-6xl">Top <em>rated</em></h2>
          <Link to="/shop?sort=rating" className="shrink-0 text-sm underline underline-offset-4 hover:text-accent-600">View all</Link>
        </Reveal>
        <Status loading={all.loading} error={all.error} />
        {grid.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
            {grid.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      <Subscribe />
    </>
  );
}
