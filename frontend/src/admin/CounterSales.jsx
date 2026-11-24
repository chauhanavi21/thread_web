import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { admin, money } from '../api.js';
import { useAsync } from '../components/useAsync.js';
import { Status } from '../components/Status.jsx';
import { useInventoryVersion } from '../context/InventoryContext.jsx';
import { useSite } from '../context/SiteContext.jsx';
import { PageHead } from './ui.jsx';

function Receipt({ order }) {
  return <section className="panel mb-6 space-y-3" aria-label={`Counter receipt ${order.id}`}>
    <h2 className="text-2xl">Counter receipt #{order.id}</h2>
    <p className="text-sm text-brand-600">{order.shipping.name} · Cash recorded · {order.status === 'delivered' ? 'Handed to customer' : order.status}</p>
    <ul className="space-y-1 text-sm">{order.items.map((item) => <li key={item.id} className="flex justify-between gap-3"><span>{item.name} · {item.color}, {item.size} × {item.qty}</span><span>{money(item.priceCents * item.qty)}</span></li>)}</ul>
    <dl className="grid grid-cols-[1fr_auto] gap-2 border-t border-brand-200 pt-3 text-sm"><dt>Total</dt><dd>{money(order.totalCents)}</dd><dt>Cash received</dt><dd>{money(order.cashReceivedCents)}</dd><dt>Change due</dt><dd>{money(order.changeCents)}</dd></dl>
    <Link to="/admin/returns" className="link-btn inline-block">Process a return using order #{order.id}</Link>
  </section>;
}

export default function CounterSales() {
  const inventoryVersion = useInventoryVersion();
  const { settings } = useSite();
  const { data: products, error, loading } = useAsync(() => admin.products(), [inventoryVersion]);
  const [version, setVersion] = useState(0);
  const receipts = useAsync(() => admin.counterSales(), [version]);
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState([]);
  const [name, setName] = useState('');
  const [cash, setCash] = useState('');
  const [busy, setBusy] = useState(false);
  const [saleError, setSaleError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const attempt = useRef(null);
  const pending = useRef(false);
  const total = lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
  const cashCents = Math.round(Number(cash) * 100);
  const available = (products ?? []).filter((product) => product.active).flatMap((product) => product.variants.map((variant) => ({
    ...variant, name: product.name, slug: product.slug, priceCents: product.priceCents,
  }))).filter((variant) => `${variant.name} ${variant.slug} ${variant.color} ${variant.size}`.toLowerCase().includes(query.toLowerCase()));
  const add = (variant) => {
    setReceipt(null);
    setLines((previous) => {
      const existing = previous.find((line) => line.id === variant.id);
      if (existing) return previous.map((line) => line.id === variant.id ? { ...line, qty: Math.min(line.qty + 1, variant.stock, settings.maxQtyPerItem) } : line);
      return [...previous, { ...variant, qty: 1 }];
    });
  };
  const record = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setSaleError('');
    const body = { customerName: name.trim() || 'Walk-in customer', cashReceivedCents: cashCents, expectedTotalCents: total, items: lines.map((line) => ({ variantId: line.id, qty: line.qty })) };
    const signature = JSON.stringify(body);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    try {
      const saved = await admin.recordCounterSale(body, attempt.current.key);
      setReceipt(saved); setLines([]); setCash(''); setName(''); attempt.current = null; setVersion((value) => value + 1);
    } catch (err) { setSaleError(err.message); } finally { pending.current = false; setBusy(false); }
  };

  return <>
    <PageHead title="Counter sales" />
    <p className="mb-5 max-w-2xl text-sm text-brand-600">Record a cash sale after receiving payment and handing over the items. Online orders and counter sales use the same stock. Threads does not process card payments.</p>
    {receipt && <Receipt order={receipt} />}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0">
        <label className="block text-sm font-medium">Find a product, size or colour<input className="input mt-1" type="search" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        {loading && !products ? <Status loading /> : error ? <Status error={error} /> : <ul className="mt-4 max-h-[36rem] space-y-2 overflow-y-auto rounded-xl border border-brand-200 bg-white p-3">
          {available.map((variant) => {
            const inSale = lines.find((line) => line.id === variant.id)?.qty ?? 0;
            const limit = Math.min(variant.stock, settings.maxQtyPerItem);
            return <li key={variant.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 p-2 last:border-0">
              <div className="min-w-0"><p className="font-medium">{variant.name}</p><p className="text-sm text-brand-600">{variant.color}, {variant.size} · {money(variant.priceCents)} · {variant.stock} in stock</p></div>
              <button className="btn btn-outline btn-sm" disabled={busy || inSale >= limit} onClick={() => add(variant)} aria-label={`Add ${variant.name} ${variant.color} ${variant.size}`}>{variant.stock === 0 ? 'Sold out' : 'Add'}</button>
            </li>;
          })}
          {!available.length && <li className="p-4 text-sm text-brand-500">No matching products.</li>}
        </ul>}
      </section>
      <form className="panel h-fit space-y-4" onSubmit={record}>
        <h2 className="text-2xl">Current sale</h2>
        <fieldset disabled={busy} className="space-y-4">
          {!lines.length && <p className="text-sm text-brand-500">Add a size and colour to begin.</p>}
          {lines.map((line) => <div key={line.id} className="border-b border-brand-100 pb-3">
            <p className="text-sm font-medium">{line.name} · {line.color}, {line.size}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <label className="text-sm">Quantity for {line.name} {line.size}<input className="input mt-1 w-24" type="number" required min="1" max={settings.maxQtyPerItem} value={line.qty} onChange={(e) => setLines((previous) => previous.map((entry) => entry.id === line.id ? { ...entry, qty: Number(e.target.value) } : entry))} /></label>
              <button type="button" className="link-btn" onClick={() => setLines((previous) => previous.filter((entry) => entry.id !== line.id))}>Remove {line.size}</button>
            </div>
          </div>)}
          <p className="flex justify-between font-semibold"><span>Sale total</span><span>{money(total)}</span></p>
          <label className="block text-sm font-medium">Customer name (optional)<input className="input mt-1" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block text-sm font-medium">Cash received ($)<input className="input mt-1" type="number" step="0.01" min={(total / 100).toFixed(2)} required value={cash} onChange={(e) => setCash(e.target.value)} /></label>
          {cash !== '' && cashCents >= total && <p className="text-sm">Change due: {money(cashCents - total)}</p>}
        </fieldset>
        {saleError && <p role="alert" className="text-sm text-red-700">{saleError} Check recent receipts before starting another sale.</p>}
        <button className="btn w-full" disabled={busy || !lines.length}>{busy ? 'Recording…' : 'Record cash sale'}</button>
      </form>
    </div>
    <section className="mt-8"><h2 className="text-2xl">Recent counter receipts</h2>
      {receipts.error && <Status error={receipts.error} />}
      <ul className="mt-3 space-y-2">{receipts.data?.map((order) => <li key={order.id}><button className="flex w-full flex-wrap justify-between gap-2 rounded-xl border border-brand-200 bg-white p-4 text-left text-sm" onClick={() => setReceipt(order)}><span>Receipt #{order.id} · {order.shipping.name}</span><strong>{money(order.totalCents)}</strong></button></li>)}</ul>
    </section>
  </>;
}
