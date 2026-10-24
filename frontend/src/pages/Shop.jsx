import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';

const CATEGORY_LABELS = { women: 'Women', men: 'Men', accessories: 'Accessories' };
const SORTS = [
  ['featured', 'Featured'],
  ['rating', 'Top rated'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['name', 'Name'],
];

const titleCase = (s) => s.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const type = params.get('type') || '';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'featured';

  const meta = useAsync(() => api.productMeta(), []);
  const { data, error, loading } = useAsync(() => api.products({ category, type, q, sort }), [category, type, q, sort]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };

  const types = category ? meta.data?.categories[category] ?? [] : [];
  const heading = q ? `Results for “${q}”` : category ? CATEGORY_LABELS[category] ?? 'Shop' : 'All products';

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-5xl sm:text-7xl">{heading}</h1>
          {data && <p className="mt-1 text-sm text-brand-500">{data.length} {data.length === 1 ? 'product' : 'products'}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm text-brand-600">
          Sort by
          <select className="input w-auto py-2" value={sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Category">
        <button className={`chip ${!category ? 'chip-on' : ''}`} onClick={() => update({ category: '', type: '' })}>All</button>
        {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
          <button key={k} className={`chip ${category === k ? 'chip-on' : ''}`} onClick={() => update({ category: k, type: '' })}>{label}</button>
        ))}
      </div>
      {types.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Product type">
          <button className={`chip !px-3 !py-1 !text-xs ${!type ? 'chip-on' : ''}`} onClick={() => update({ type: '' })}>All types</button>
          {types.map((t) => (
            <button key={t.type} className={`chip !px-3 !py-1 !text-xs ${type === t.type ? 'chip-on' : ''}`} onClick={() => update({ type: t.type })}>
              {titleCase(t.type)} ({t.count})
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Status loading={loading} error={error} />
        {data && data.length === 0 && <Status>No products match your search.</Status>}
        {data && data.length > 0 && (
          <div className="cell-grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {data.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </>
  );
}
