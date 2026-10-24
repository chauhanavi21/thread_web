import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, money } from '../api.js';
import { MAX_QTY, useCart } from '../context/CartContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import ProductImage from '../components/ProductImage.jsx';
import Stars from '../components/Stars.jsx';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';

export default function ProductPage() {
  const { slug } = useParams();
  const { data: p, error, loading } = useAsync(() => api.product(slug), [slug]);
  const { add, lines } = useCart();
  const [colorName, setColorName] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [showSizeHint, setShowSizeHint] = useState(false);
  const timer = useRef();

  useEffect(() => () => clearTimeout(timer.current), []);

  // Start on the first colour that has anything in stock, with no size chosen yet.
  useEffect(() => {
    if (!p) return;
    const firstInStock = p.variants.find((v) => v.stock > 0) ?? p.variants[0];
    setColorName(firstInStock?.color ?? '');
    setSize(p.sizes.length === 1 ? p.sizes[0] : '');
    setQty(1);
    setShowSizeHint(false);
  }, [p]);

  if (loading) return <Status loading />;
  if (error) return <Status error={error} />;

  const color = p.colors.find((c) => c.name === colorName) ?? p.colors[0];
  const variantFor = (sz) => p.variants.find((v) => v.color === color.name && v.size === sz);
  const variant = size ? variantFor(size) : null;
  const inCart = variant ? lines.find((l) => l.variantId === variant.id)?.qty ?? 0 : 0;
  const maxMore = variant ? Math.max(0, Math.min(MAX_QTY, variant.stock) - inCart) : 0;
  const colorSoldOut = p.sizes.every((s) => (variantFor(s)?.stock ?? 0) === 0);

  const chooseColor = (name) => {
    setColorName(name);
    // Keep the size if it exists in the new colour, otherwise ask again.
    const keep = p.variants.find((v) => v.color === name && v.size === size && v.stock > 0);
    if (!keep) setSize(p.sizes.length === 1 ? p.sizes[0] : '');
    setQty(1);
  };

  const addToBag = () => {
    if (!variant) {
      setShowSizeHint(true);
      return;
    }
    add(p, variant, Math.min(qty, maxMore));
    setJustAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1800);
  };

  const needsSize = p.sizes.length > 1;

  return (
    <>
      <p className="mb-4 text-sm capitalize text-brand-500">
        <Link to="/shop" className="hover:underline">Shop</Link> /{' '}
        <Link to={`/shop?category=${p.category}`} className="hover:underline">{p.category}</Link> / <span className="text-brand-800">{p.name}</span>
      </p>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <div className="md:sticky md:top-24 md:self-start">
          <ProductImage slug={p.slug} type={p.type} color={color.hex} name={`${p.name} in ${color.name}`} ratio="aspect-[4/5]" className="rounded-3xl" priority />
          <p className="mt-2 text-xs text-brand-500">Photo is for illustration and may not show the colour you pick.</p>
        </div>

        <div>
          <p className="eyebrow">{p.type.replace(/-/g, ' ')}</p>
          <h1 className="mt-1 text-4xl sm:text-6xl">{p.name}</h1>
          <div className="mt-2"><Stars rating={p.rating} count={p.reviewCount} /></div>
          <p className="mt-4 text-3xl font-medium text-brand-900">{money(p.priceCents)}</p>
          <p className="mt-4 text-brand-600">{p.description}</p>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium text-brand-800">
              Colour: <span className="font-normal text-brand-600">{color.name}</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {p.colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={c.name === color.name}
                  onClick={() => chooseColor(c.name)}
                  className={`h-9 w-9 rounded-full border border-black/15 transition ${c.name === color.name ? 'outline outline-2 outline-offset-2 outline-brand-900' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </fieldset>

          {needsSize && (
            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-brand-800">
                Size{size && <span className="font-normal text-brand-600">: {size}</span>}
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.sizes.map((s) => {
                  const out = (variantFor(s)?.stock ?? 0) === 0;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={out}
                      aria-pressed={s === size}
                      onClick={() => { setSize(s); setQty(1); setShowSizeHint(false); }}
                      className={`min-w-12 rounded-full border px-4 py-2 text-sm font-medium transition ${
                        s === size
                          ? 'border-brand-900 bg-brand-900 text-white'
                          : out
                            ? 'cursor-not-allowed border-brand-200 bg-brand-50 text-brand-300 line-through'
                            : 'border-brand-200 bg-white text-brand-800 hover:border-brand-900'
                      }`}
                      title={out ? 'Sold out in this colour' : undefined}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              {showSizeHint && !size && <p className="mt-2 text-sm text-red-700" role="alert">Please choose a size.</p>}
            </fieldset>
          )}

          {colorSoldOut ? (
            <p className="mt-6  bg-red-50 px-4 py-3 text-sm text-red-700">{color.name} is sold out. Try another colour.</p>
          ) : (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <label>
                <span className="sr-only">Quantity</span>
                <select className="input w-24 py-3" value={qty} onChange={(e) => setQty(Number(e.target.value))} disabled={!variant || maxMore === 0}>
                  {Array.from({ length: Math.max(1, maxMore) }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
                </select>
              </label>
              <button className="btn flex-1 sm:flex-none sm:px-10" onClick={addToBag} disabled={Boolean(variant) && maxMore === 0}>
                {variant && maxMore === 0 ? 'Max in bag' : justAdded ? 'Added ✓' : 'Add to bag'}
              </button>
            </div>
          )}
          {variant && variant.stock <= 5 && variant.stock > 0 && <p className="mt-2 text-sm text-amber-700">Only {variant.stock} left in {color.name}, {variant.size}.</p>}
          {inCart > 0 && (
            <p className="mt-2 text-sm text-brand-500">
              {inCart} in your bag · <Link to="/cart" className="text-brand-950 underline">View bag</Link>
            </p>
          )}

          <div className="mt-8 rounded-2xl bg-brand-100 p-5">
            <h2 className="text-lg">Fabric &amp; care</h2>
            <p className="mt-1 text-sm text-brand-600">{p.details}</p>
          </div>
        </div>
      </div>

      {p.related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-4xl sm:text-5xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-4">
            {p.related.map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </section>
      )}
    </>
  );
}
