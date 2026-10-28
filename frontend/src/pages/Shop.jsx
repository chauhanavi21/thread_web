import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';
import { useSite } from '../context/SiteContext.jsx';

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
  const { categories } = useSite();
  const labels = Object.fromEntries(categories.map((c) => [c.key, c.title]));
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
  const heading = q ? `Results for “${q}”` : category ? labels[category] ?? titleCase(category) : 'All pieces';

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Shop</p>
          <h1 className="mt-2 text-5xl sm:text-7xl">{heading}</h1>
          {data && <p className="mt-2 text-sm text-brand-500">{data.length} {data.length === 1 ? 'piece' : 'pieces'}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm text-brand-600">
          Sort by
          <select className="input w-auto rounded-full py-2 pr-8" value={sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
      </div>

      {/* Filters scroll sideways on a phone instead of wrapping into a tall block. */}
      <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Category">
        <button className={`chip ${!category ? 'chip-on' : ''}`} onClick={() => update({ category: '', type: '' })}>All</button>
        {categories.map((c) => (
          <button key={c.key} className={`chip ${category === c.key ? 'chip-on' : ''}`} onClick={() => update({ category: c.key, type: '' })}>{c.title}</button>
        ))}
      </div>
      {types.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Type">
          <button className={`chip !px-3 !py-1 !text-xs ${!type ? 'chip-on' : ''}`} onClick={() => update({ type: '' })}>All types</button>
          {types.map((t) => (
            <button key={t.type} className={`chip !px-3 !py-1 !text-xs ${type === t.type ? 'chip-on' : ''}`} onClick={() => update({ type: t.type })}>
              {titleCase(t.type)} ({t.count})
            </button>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Status loading={loading} error={error} />
        {data && data.length === 0 && <Status>No pieces match your search.</Status>}
        {data && data.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
            {data.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </>
  );
}
