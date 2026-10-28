import { useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../api.js';
import ProductImage from './ProductImage.jsx';

/**
 * Product tile: portrait picture, name and price on one row, the type underneath, colour dots, and an
 * "Add to cart" pill. The pill takes you to the product page, because a size has to be chosen first.
 */
export default function ProductCard({ product, className = '' }) {
  const [color, setColor] = useState(product.colors[0]);
  const to = `/product/${product.slug}`;

  return (
    <article className={`group flex h-full flex-col ${className}`}>
      <Link to={to} className="relative block overflow-hidden rounded-2xl" aria-label={product.name}>
        <ProductImage
          image={product.image}
          type={product.type}
          color={color.hex}
          name={`${product.name} in ${color.name}`}
          className="transition duration-700 ease-out group-hover:scale-[1.04]"
        />
        {!product.inStock && <span className="absolute left-3 top-3 rounded-full bg-brand-900 px-2.5 py-1 text-xs font-medium text-white">Sold out</span>}
        {product.inStock && product.featured && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-brand-900 backdrop-blur">Best seller</span>
        )}
      </Link>

      <div className="flex flex-1 flex-col pt-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-sans text-[15px] font-medium leading-snug tracking-normal text-brand-950">
            <Link to={to} className="hover:text-accent-600">{product.name}</Link>
          </h3>
          <strong className="shrink-0 text-[15px] font-medium">{money(product.priceCents)}</strong>
        </div>
        <p className="mt-0.5 text-xs capitalize text-brand-500">{product.type.replace(/-/g, ' ')}</p>

        {/* The dot is 16px, but its button is 32px so it is easy to hit with a thumb. */}
        <ul className="-mx-2 mt-0.5 flex flex-wrap items-center" aria-label="Available colours">
          {product.colors.slice(0, 6).map((c) => (
            <li key={c.name}>
              <button
                type="button"
                title={c.name}
                aria-label={c.name}
                aria-pressed={c.name === color.name}
                onClick={() => setColor(c)}
                className="grid h-8 w-8 place-items-center"
              >
                <span
                  className={`block h-4 w-4 rounded-full border border-black/15 transition ${c.name === color.name ? 'outline outline-1 outline-offset-2 outline-brand-900' : 'group-hover:scale-100 hover:scale-125'}`}
                  style={{ backgroundColor: c.hex }}
                />
              </button>
            </li>
          ))}
          {product.colors.length > 6 && <li className="px-1 text-xs text-brand-500">+{product.colors.length - 6}</li>}
        </ul>

        <Link
          to={to}
          className="mt-3 flex items-center justify-center rounded-full border border-brand-300 py-2 text-sm text-brand-900 transition group-hover:border-brand-900 group-hover:bg-brand-900 group-hover:text-white"
        >
          {product.inStock ? 'Add to cart' : 'View'}
        </Link>
      </div>
    </article>
  );
}
