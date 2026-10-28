import { useEffect, useState } from 'react';
import { admin } from '../api.js';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';
import { useSite } from '../context/SiteContext.jsx';
import { Field, PageHead, useFlash } from './ui.jsx';

const dollars = (cents) => (cents / 100).toFixed(2);

export default function SiteSettings() {
  const { refresh } = useSite();
  const { data, error, loading } = useAsync(() => admin.settings(), []);
  const products = useAsync(() => admin.products(), []);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flash, flashNode] = useFlash();

  useEffect(() => {
    if (data) setF({ ...data, freeShipping: dollars(data.freeShippingOverCents), flatShipping: dollars(data.flatShippingCents) });
  }, [data]);

  if (loading || !f || products.loading) return <Status loading />;
  if (error) return <Status error={error} />;

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setPerk = (i, k, v) => setF((x) => ({ ...x, perks: x.perks.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { freeShipping, flatShipping, ...rest } = f;
      await admin.saveSettings({
        ...rest,
        freeShippingOverCents: Math.round(Number(freeShipping) * 100),
        flatShippingCents: Math.round(Number(flatShipping) * 100),
        maxQtyPerItem: Number(f.maxQtyPerItem),
      });
      await refresh();
      flash('Saved. The storefront is updated.');
    } catch (err) {
      flash(err.message, true);
    } finally {
      setBusy(false);
    }
  };

  const productOptions = (products.data ?? []).filter((p) => p.active);

  return (
    <form onSubmit={save}>
      <PageHead title="Site settings">
        <button className="btn btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </PageHead>

      <div className="grid max-w-3xl gap-6">
        <section className="panel space-y-4">
          <h2 className="text-2xl">Announcement bar</h2>
          <Field label="Message" hint="Shown above the menu on every page. Leave empty to hide it."><input className="input" maxLength={160} value={f.announcement} onChange={set('announcement')} placeholder="Free shipping this weekend" /></Field>
        </section>

        <section className="panel space-y-4">
          <h2 className="text-2xl">Home page hero</h2>
          <Field label="Small heading"><input className="input" maxLength={60} value={f.heroEyebrow} onChange={set('heroEyebrow')} /></Field>
          <Field label="Title" hint="Put *stars* around words to highlight them, like: Clothes made to be *worn* on repeat"><input className="input" maxLength={120} value={f.heroTitle} onChange={set('heroTitle')} /></Field>
          <Field label="Text"><textarea className="input min-h-16" maxLength={240} value={f.heroText} onChange={set('heroText')} /></Field>
          <Field label="Featured product" hint="Its photo and a link to it appear in the hero.">
            <select className="input" value={f.heroProduct} onChange={set('heroProduct')}>
              <option value="">None</option>
              {productOptions.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
            </select>
          </Field>
        </section>

        <section className="panel space-y-4">
          <h2 className="text-2xl">Banner</h2>
          <Field label="Title" hint="Use *stars* to highlight words."><input className="input" maxLength={120} value={f.bannerTitle} onChange={set('bannerTitle')} /></Field>
          <Field label="Text"><textarea className="input min-h-16" maxLength={240} value={f.bannerText} onChange={set('bannerText')} /></Field>
          <Field label="Picture from product">
            <select className="input" value={f.bannerProduct} onChange={set('bannerProduct')}>
              <option value="">None</option>
              {productOptions.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
            </select>
          </Field>
        </section>

        <section className="panel space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl">Highlights strip</h2>
            {f.perks.length < 6 && <button type="button" className="btn btn-outline btn-sm" onClick={() => setF((x) => ({ ...x, perks: [...x.perks, { title: '', text: '' }] }))}>+ Add</button>}
          </div>
          {f.perks.length === 0 && <p className="text-sm text-brand-500">No highlights. The strip is hidden.</p>}
          {f.perks.map((p, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
              <Field label="Title"><input className="input" required maxLength={60} value={p.title} onChange={(e) => setPerk(i, 'title', e.target.value)} /></Field>
              <Field label="Text"><input className="input" maxLength={120} value={p.text} onChange={(e) => setPerk(i, 'text', e.target.value)} /></Field>
              <button type="button" className="link-btn !text-red-700 pb-3" onClick={() => setF((x) => ({ ...x, perks: x.perks.filter((_, j) => j !== i) }))}>Remove</button>
            </div>
          ))}
        </section>

        <section className="panel space-y-4">
          <h2 className="text-2xl">Shipping &amp; limits</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Free shipping over ($)"><input className="input" type="number" step="0.01" min="0" required value={f.freeShipping} onChange={set('freeShipping')} /></Field>
            <Field label="Flat shipping ($)"><input className="input" type="number" step="0.01" min="0" required value={f.flatShipping} onChange={set('flatShipping')} /></Field>
            <Field label="Max per item"><input className="input" type="number" min="1" max="100" required value={f.maxQtyPerItem} onChange={set('maxQtyPerItem')} /></Field>
          </div>
          <p className="text-xs text-brand-500">Applied in the bag and enforced by the server when an order is placed. The text on the home page highlights is separate, so update it too if you change the free-shipping amount.</p>
        </section>

        <section className="panel space-y-4">
          <h2 className="text-2xl">Footer</h2>
          <Field label="Note"><input className="input" maxLength={200} value={f.footerNote} onChange={set('footerNote')} /></Field>
        </section>
      </div>
      {flashNode}
    </form>
  );
}
