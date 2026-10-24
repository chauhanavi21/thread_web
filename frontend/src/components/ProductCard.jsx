import { useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../api.js';
import ProductImage from './ProductImage.jsx';

/** One bordered cell of the product grid. Put several inside a `.cell-grid`. */
export default function ProductCard({ product }) {
  const [color, setColor] = useState(product.colors[0]);
  const to = `/product/${product.slug}`;

  return (
    <article className="group flex h-full flex-col bg-brand-50 p-2">
      <Link to={to} className="relative block overflow-hidden" aria-label={product.name}>
        <ProductImage type={product.type} color={color.hex} name={`${product.name} in ${color.name}`} className="transition duration-700 ease-out group-hover:scale-105" />
        {!product.inStock && <span className="absolute left-2 top-2 bg-brand-950 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">Sold out</span>}
      </Link>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-sans text-base font-bold normal-case leading-snug tracking-normal sm:text-lg">{product.name}</h3>
          <strong className="shrink-0 text-base font-bold sm:text-lg">{money(product.priceCents)}</strong>
        </div>
        <ul className="mt-2 flex items-center gap-1.5" aria-label="Available colours">
          {product.colors.slice(0, 6).map((c) => (
            <li key={c.name}>
              <button
                type="button"
                title={c.name}
                aria-label={c.name}
                aria-pressed={c.name === color.name}
                onClick={() => setColor(c)}
                className={`h-3.5 w-3.5 border border-black/20 transition ${c.name === color.name ? 'outline outline-1 outline-offset-2 outline-black' : 'hover:scale-125'}`}
                style={{ backgroundColor: c.hex }}
              />
            </li>
          ))}
          {product.colors.length > 6 && <li className="text-xs text-brand-500">+{product.colors.length - 6}</li>}
        </ul>

        <Link
          to={to}
          className="mt-4 flex items-center justify-between bg-brand-100 px-3 py-2.5 text-sm font-bold uppercase tracking-wide transition group-hover:bg-brand-950 group-hover:text-white"
        >
          <span>{product.type.replace(/-/g, ' ')}</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}
