import { useEffect, useState } from 'react';
import { admin } from '../api.js';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';
import { useSite } from '../context/SiteContext.jsx';
import { Field, ImageField, PageHead, confirmThen, useFlash } from './ui.jsx';

function CategoryCard({ category, onSaved, onDeleted, flash }) {
  const isNew = !category.key;
  const [f, setF] = useState({ title: category.title ?? '', blurb: category.blurb ?? '', image: category.image ?? null, sortOrder: String(category.sortOrder ?? 0) });
  const [busy, setBusy] = useState(false);
  useEffect(() => setF({ title: category.title ?? '', blurb: category.blurb ?? '', image: category.image ?? null, sortOrder: String(category.sortOrder ?? 0) }), [category]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...f, sortOrder: Number(f.sortOrder) };
      if (isNew) await admin.createCategory(body);
      else await admin.updateCategory(category.key, body);
      flash(isNew ? 'Category added.' : 'Saved.');
      onSaved();
    } catch (err) {
      flash(err.message, true);
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    confirmThen(`Delete the "${category.title}" category?`, async () => {
      try {
        await admin.deleteCategory(category.key);
        flash('Category deleted.');
        onDeleted();
      } catch (err) {
        flash(err.message, true);
      }
    });

  return (
    <form onSubmit={save} className="panel space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-2xl">{isNew ? 'New category' : category.title}</h2>
        {!isNew && <span className="text-xs text-brand-500">/{category.key} · {category.productCount} products</span>}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_90px]">
        <Field label="Title"><input className="input" required maxLength={60} value={f.title} onChange={set('title')} /></Field>
        <Field label="Order"><input className="input" type="number" min="0" max="1000" value={f.sortOrder} onChange={set('sortOrder')} /></Field>
      </div>
      <Field label="Short description"><input className="input" maxLength={120} value={f.blurb} onChange={set('blurb')} placeholder="Shown on the home page tile" /></Field>
      <div>
        <p className="mb-2 text-sm font-medium text-brand-700">Home page picture</p>
        <ImageField value={f.image} onChange={(image) => setF((x) => ({ ...x, image }))} onError={(m) => flash(m, true)} />
      </div>
      <div className="flex gap-3">
        <button className="btn btn-sm" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Add category' : 'Save'}</button>
        {!isNew && <button type="button" className="btn btn-outline btn-sm !border-red-300 !text-red-700 hover:!bg-red-700 hover:!text-white" onClick={remove}>Delete</button>}
      </div>
    </form>
  );
}

export default function Categories() {
  const { refresh } = useSite();
  const [version, setVersion] = useState(0);
  const { data, error, loading } = useAsync(() => admin.categories(), [version]);
  const [flash, flashNode] = useFlash();
  const changed = () => {
    setVersion((v) => v + 1);
    refresh();
  };

  if (loading && !data) return <Status loading />;
  if (error) return <Status error={error} />;

  return (
    <>
      <PageHead title="Categories" />
      <p className="-mt-3 mb-6 max-w-xl text-sm text-brand-500">These are the sections in the shop menu, the footer and the home page tiles. A category with no visible products is hidden from the storefront.</p>
      <div className="grid gap-6 xl:grid-cols-2">
        {data.map((c) => <CategoryCard key={c.key} category={c} onSaved={changed} onDeleted={changed} flash={flash} />)}
        <CategoryCard category={{}} onSaved={changed} onDeleted={changed} flash={flash} />
      </div>
      {flashNode}
    </>
  );
}
