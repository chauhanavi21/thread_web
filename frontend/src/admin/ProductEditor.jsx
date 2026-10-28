import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { admin } from '../api.js';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';
import { useSite } from '../context/SiteContext.jsx';
import { Field, ImageField, PageHead, confirmThen, useFlash } from './ui.jsx';

const SIZE_PRESETS = {
  Clothing: ['XS', 'S', 'M', 'L', 'XL'],
  'Jeans (men)': ['28', '30', '32', '34', '36'],
  'Jeans (women)': ['24', '26', '28', '30', '32'],
  'One size': ['One size'],
};

const BLANK = {
  name: '',
  slug: '',
  category: '',
  type: '',
  description: '',
  details: '',
  price: '',
  rating: '4.5',
  reviewCount: '0',
  featured: false,
  active: true,
  image: null,
};

/** Turns a product from the API into form state: colours with a stock number per size. */
function toForm(p) {
  const colors = [];
  const sizes = [];
  for (const v of p.variants) {
    let c = colors.find((x) => x.name === v.color);
    if (!c) colors.push((c = { name: v.color, hex: v.colorHex, stock: {}, ids: {} }));
    c.stock[v.size] = String(v.stock);
    c.ids[v.size] = v.id;
    if (!sizes.includes(v.size)) sizes.push(v.size);
  }
  return {
    form: {
      name: p.name, slug: p.slug, category: p.category, type: p.type, description: p.description, details: p.details,
      price: (p.priceCents / 100).toFixed(2), rating: String(p.rating), reviewCount: String(p.reviewCount),
      featured: p.featured, active: p.active, image: p.image,
    },
    colors,
    sizes,
  };
}

/** The inverse: one variant per colour and size, keeping the ids of existing ones so orders stay linked. */
function toPayload(form, colors, sizes) {
  const cents = Math.round(Number(form.price) * 100);
  return {
    ...form,
    priceCents: cents,
    rating: Number(form.rating),
    reviewCount: Number(form.reviewCount),
    variants: colors.flatMap((c) => sizes.map((size) => ({ id: c.ids[size] ?? null, color: c.name.trim(), colorHex: c.hex, size, stock: Number(c.stock[size] || 0) }))),
  };
}

export default function ProductEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { categories, refresh } = useSite();
  const allCategories = useAsync(() => admin.categories(), []);
  const existing = useAsync(() => (isNew ? Promise.resolve(null) : admin.product(id)), [id]);
  const [flash, flashNode] = useFlash();

  const [form, setForm] = useState(BLANK);
  const [colors, setColors] = useState([{ name: 'Black', hex: '#1c1c1e', stock: {}, ids: {} }]);
  const [sizes, setSizes] = useState(SIZE_PRESETS.Clothing);
  const [newSize, setNewSize] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing.data) {
      const s = toForm(existing.data);
      setForm(s.form);
      setColors(s.colors);
      setSizes(s.sizes);
    }
  }, [existing.data]);

  useEffect(() => {
    // Default a new product to the first category once they load.
    if (isNew && !form.category && allCategories.data?.[0]) setForm((f) => ({ ...f, category: allCategories.data[0].key }));
  }, [isNew, form.category, allCategories.data]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const totalStock = useMemo(() => colors.reduce((n, c) => n + sizes.reduce((m, s) => m + Number(c.stock[s] || 0), 0), 0), [colors, sizes]);

  const setColor = (i, patch) => setColors((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const setStock = (i, size, value) => setColors((cs) => cs.map((c, j) => (j === i ? { ...c, stock: { ...c.stock, [size]: value } } : c)));
  const addSize = (size) => {
    const v = size.trim();
    if (v && !sizes.some((s) => s.toLowerCase() === v.toLowerCase())) setSizes((s) => [...s, v]);
    setNewSize('');
  };

  if (!isNew && (existing.loading || allCategories.loading)) return <Status loading />;
  if (existing.error) return <Status error={existing.error} />;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!(Number(form.price) >= 0) || form.price === '') return setError('Enter a price.');
    if (colors.length === 0 || sizes.length === 0) return setError('Add at least one colour and one size.');
    setBusy(true);
    try {
      const payload = toPayload(form, colors, sizes);
      const saved = isNew ? await admin.createProduct(payload) : await admin.updateProduct(id, payload);
      refresh(); // the storefront reads categories and hero picks from the same tables
      if (isNew) navigate(`/admin/products/${saved.id}`, { replace: true });
      else {
        const s = toForm(saved);
        setForm(s.form);
        setColors(s.colors);
        setSizes(s.sizes);
      }
      flash(isNew ? 'Product created.' : 'Saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    confirmThen(`Delete "${form.name}"? This cannot be undone.`, async () => {
      try {
        await admin.deleteProduct(id);
        navigate('/admin/products');
      } catch (err) {
        setError(err.message);
      }
    });

  const cats = allCategories.data ?? categories;

  return (
    <form onSubmit={save}>
      <PageHead title={isNew ? 'New product' : 'Edit product'}>
        <Link to="/admin/products" className="btn btn-outline btn-sm">← All products</Link>
        {!isNew && <a href={`/product/${form.slug}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">View in shop ↗</a>}
      </PageHead>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="panel space-y-4">
            <Field label="Name"><input className="input" required maxLength={120} value={form.name} onChange={set('name')} /></Field>
            {isNew && (
              <Field label="URL name" hint={`Used in the link: /product/${form.slug || 'my-product'}. Leave blank to use the name. Cannot be changed later.`}>
                <input className="input" maxLength={80} value={form.slug} onChange={set('slug')} placeholder="auto" />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select className="input" required value={form.category} onChange={set('category')}>
                  {cats.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
                </select>
              </Field>
              <Field label="Type" hint="e.g. hoodies, jeans, dresses. Picks the drawn garment when there is no photo.">
                <input className="input" required maxLength={40} list="product-types" value={form.type} onChange={set('type')} />
                <datalist id="product-types">
                  {['t-shirts', 'hoodies', 'shirts', 'jeans', 'jackets', 'shorts', 'dresses', 'knitwear', 'skirts', 'caps', 'beanies', 'bags', 'scarves'].map((t) => <option key={t} value={t} />)}
                </datalist>
              </Field>
            </div>
            <Field label="Description"><textarea className="input min-h-24" required maxLength={2000} value={form.description} onChange={set('description')} /></Field>
            <Field label="Fabric & care"><textarea className="input min-h-16" maxLength={1000} value={form.details} onChange={set('details')} /></Field>
          </section>

          <section className="panel">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-2xl">Colours, sizes &amp; stock</h2>
                <p className="text-sm text-brand-500">{totalStock} in stock across {colors.length * sizes.length} variants. Set a number to 0 to mark it sold out.</p>
              </div>
              <select className="input w-auto text-xs" value="" onChange={(e) => e.target.value && setSizes(SIZE_PRESETS[e.target.value])} aria-label="Use a size preset">
                <option value="">Size preset…</option>
                {Object.keys(SIZE_PRESETS).map((k) => <option key={k}>{k}</option>)}
              </select>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-brand-500">
                    <th className="py-2 pr-3 font-medium">Colour</th>
                    {sizes.map((s) => (
                      <th key={s} className="px-1 py-2 text-center font-medium">
                        {s}
                        <button type="button" className="ml-1 text-brand-400 hover:text-red-700" aria-label={`Remove size ${s}`} onClick={() => setSizes((all) => all.filter((x) => x !== s))}>×</button>
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {colors.map((c, i) => (
                    <tr key={i} className="border-t border-brand-100">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <input type="color" value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value })} className="h-8 w-8 shrink-0 cursor-pointer rounded-full border border-brand-300 bg-transparent p-0" aria-label={`Swatch for ${c.name}`} />
                          <input className="input !py-1.5" required maxLength={40} value={c.name} onChange={(e) => setColor(i, { name: e.target.value })} aria-label="Colour name" />
                        </div>
                      </td>
                      {sizes.map((s) => (
                        <td key={s} className="px-1 py-2">
                          <input type="number" min="0" max="100000" className="input !px-2 !py-1.5 text-center" value={c.stock[s] ?? ''} placeholder="0" onChange={(e) => setStock(i, s, e.target.value)} aria-label={`${c.name} ${s} stock`} />
                        </td>
                      ))}
                      <td className="py-2 pl-2 text-right">
                        <button type="button" className="link-btn !text-red-700" onClick={() => setColors((cs) => cs.filter((_, j) => j !== i))} aria-label={`Remove colour ${c.name}`}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setColors((cs) => [...cs, { name: '', hex: '#9caf88', stock: {}, ids: {} }])}>+ Add colour</button>
              <span className="flex gap-2">
                <input className="input !w-28 !py-1.5" placeholder="New size" value={newSize} maxLength={20} onChange={(e) => setNewSize(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSize(newSize); } }} aria-label="New size" />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => addSize(newSize)}>+ Add size</button>
              </span>
            </div>
            <p className="mt-3 text-xs text-brand-500">A colour or size that appears on a past order cannot be removed; set its stock to 0 instead.</p>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel space-y-4">
            <Field label="Price (USD)"><input className="input" type="number" step="0.01" min="0" max="100000" required value={form.price} onChange={set('price')} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rating"><input className="input" type="number" step="0.1" min="0" max="5" value={form.rating} onChange={set('rating')} /></Field>
              <Field label="Reviews"><input className="input" type="number" min="0" value={form.reviewCount} onChange={set('reviewCount')} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-900" checked={form.active} onChange={set('active')} /> Visible in the shop</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-900" checked={form.featured} onChange={set('featured')} /> Featured (best seller badge, home slider)</label>
          </section>

          <section className="panel">
            <h2 className="mb-3 text-lg">Photo</h2>
            <ImageField value={form.image} onChange={(image) => setForm((f) => ({ ...f, image }))} onError={(m) => flash(m, true)} />
          </section>

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
          <div className="flex gap-3">
            <button className="btn flex-1" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}</button>
            {!isNew && <button type="button" className="btn btn-outline !border-red-300 !text-red-700 hover:!bg-red-700 hover:!text-white" onClick={remove}>Delete</button>}
          </div>
        </div>
      </div>
      {flashNode}
    </form>
  );
}
