import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { admin, money } from '../api.js';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';
import ProductImage from '../components/ProductImage.jsx';
import { PageHead, confirmThen, useFlash } from './ui.jsx';

const totalStock = (p) => p.variants.reduce((n, v) => n + v.stock, 0);

export default function Products() {
  const [version, setVersion] = useState(0);
  const { data, error, loading } = useAsync(() => admin.products(), [version]);
  const [flash, flashNode] = useFlash();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [view, setView] = useState('all'); // all | hidden | low

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((p) => {
      if (category && p.category !== category) return false;
      if (view === 'hidden' && p.active) return false;
      if (view === 'low' && !p.variants.some((v) => v.stock <= 3)) return false;
      return !term || p.name.toLowerCase().includes(term) || p.type.includes(term) || p.slug.includes(term);
    });
  }, [data, q, category, view]);

  const categories = useMemo(() => [...new Set((data ?? []).map((p) => p.category))], [data]);

  const run = async (fn, okMessage) => {
    try {
      await fn();
      flash(okMessage);
      setVersion((v) => v + 1);
    } catch (err) {
      flash(err.message, true);
    }
  };

  if (loading && !data) return <Status loading />;
  if (error) return <Status error={error} />;

  return (
    <>
      <PageHead title="Products">
        <Link to="/admin/products/new" className="btn btn-sm">+ New product</Link>
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input w-full rounded-full sm:w-64" type="search" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        <select className="input w-auto rounded-full" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {[['all', 'All'], ['hidden', 'Hidden'], ['low', 'Low stock']].map(([k, label]) => (
          <button key={k} className={`chip ${view === k ? 'chip-on' : ''}`} onClick={() => setView(k)}>{label}</button>
        ))}
        <span className="ml-auto text-sm text-brand-500">{rows.length} of {data.length}</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-brand-200 bg-brand-100 text-xs uppercase tracking-wider text-brand-600">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-3 py-3 font-medium">Category</th>
              <th className="px-3 py-3 text-right font-medium">Price</th>
              <th className="px-3 py-3 text-right font-medium">Stock</th>
              <th className="px-3 py-3 text-center font-medium">Featured</th>
              <th className="px-3 py-3 text-center font-medium">Visible</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {rows.map((p) => (
              <tr key={p.id} className={p.active ? '' : 'bg-brand-50 text-brand-500'}>
                <td className="px-4 py-2.5">
                  <Link to={`/admin/products/${p.id}`} className="flex items-center gap-3 hover:text-accent-600">
                    <span className="w-10 shrink-0 overflow-hidden rounded-lg">
                      <ProductImage image={p.image} type={p.type} color={p.colors[0]?.hex} name="" ratio="aspect-[4/5]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block text-xs capitalize text-brand-500">{p.type.replace(/-/g, ' ')}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 capitalize">{p.category}</td>
                <td className="px-3 py-2.5 text-right">{money(p.priceCents)}</td>
                <td className={`px-3 py-2.5 text-right ${totalStock(p) === 0 ? 'font-medium text-red-700' : ''}`}>{totalStock(p)}</td>
                <td className="px-3 py-2.5 text-center">
                  <input type="checkbox" className="h-4 w-4 accent-brand-900" checked={p.featured} aria-label={`Feature ${p.name}`} onChange={(e) => run(() => admin.patchProduct(p.id, { featured: e.target.checked }), 'Saved.')} />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <input type="checkbox" className="h-4 w-4 accent-brand-900" checked={p.active} aria-label={`Show ${p.name} in the shop`} onChange={(e) => run(() => admin.patchProduct(p.id, { active: e.target.checked }), e.target.checked ? 'Now visible in the shop.' : 'Hidden from the shop.')} />
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <Link to={`/admin/products/${p.id}`} className="link-btn mr-3">Edit</Link>
                  <button className="link-btn !text-red-700" onClick={() => confirmThen(`Delete "${p.name}"? This cannot be undone.`, () => run(() => admin.deleteProduct(p.id), 'Product deleted.'))}>Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-brand-500">No products match.</td></tr>}
          </tbody>
        </table>
      </div>
      {flashNode}
    </>
  );
}
