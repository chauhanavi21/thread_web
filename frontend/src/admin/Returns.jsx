import { useState } from 'react';
import { admin, money } from '../api.js';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';
import { ReturnRequestForm } from '../components/Returns.jsx';
import { PageHead } from './ui.jsx';

function ReturnWorkCard({ entry, onChanged }) {
  const [inspections, setInspections] = useState({});
  const [refund, setRefund] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const act = async (action) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await admin.returnAction(entry.id, {
        action, confirmRefund: refund,
        inspections: entry.items.map((item) => ({ itemId: item.id, restock: inspections[item.id] === 'resellable' })),
      });
      onChanged();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const ready = entry.items.every((item) => Boolean(inspections[item.id])) && (entry.refundCents === 0 || refund);
  return <article className="panel space-y-4" aria-label={`Return case ${entry.id}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl capitalize">{entry.kind} #{entry.id}</h2><span className="pill">{entry.status}</span>
    </div>
    <p className="text-sm text-brand-600">Order #{entry.orderId} · {entry.customer}<br />{entry.reason}</p>
    <ul className="space-y-2 text-sm">{entry.items.map((item) => <li key={item.id}>
      <span className="font-medium">{item.name}</span> · {item.color}, {item.size} × {item.qty}
      {item.replacement && <span className="block text-brand-600">Replacement: {item.replacement.color}, {item.replacement.size} · original price kept</span>}
      {entry.status === 'approved' && <label className="mt-2 block">Inspection for {item.name} ({item.size})
        <select className="input mt-1" disabled={busy} value={inspections[item.id] ?? ''} onChange={(e) => setInspections((state) => ({ ...state, [item.id]: e.target.value }))}>
          <option value="">Inspect the returned item</option><option value="resellable">Resellable — return to stock</option><option value="damaged">Damaged — keep out of stock</option>
        </select>
      </label>}
      {item.restock !== null && <span className="block text-brand-600">{item.restock ? 'Returned to sellable stock' : 'Kept out of sellable stock'}</span>}
    </li>)}</ul>
    {entry.kind === 'return' && <p className="text-sm">{entry.status === 'completed' ? 'Refund recorded' : 'Refund to record'}: <strong>{money(entry.refundCents)}</strong> · shipping excluded</p>}
    {entry.status === 'approved' && entry.refundCents > 0 && <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" disabled={busy} checked={refund} onChange={(e) => setRefund(e.target.checked)} />Refund of {money(entry.refundCents)} has been recorded. Threads does not send money.</label>}
    {entry.status === 'approved' && entry.kind === 'exchange' && <p className="text-sm text-brand-600">Complete only after inspecting the original and handing the reserved replacement to the customer.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3">
      {entry.allowedActions.includes('approve') && <button className="btn btn-sm" disabled={busy} onClick={() => act('approve')}>Approve {entry.kind}</button>}
      {entry.allowedActions.includes('complete') && <button className="btn btn-sm" disabled={busy || !ready} onClick={() => act('complete')}>Complete {entry.kind}</button>}
      {entry.allowedActions.includes('reject') && <button className="link-btn" disabled={busy} onClick={() => act('reject')}>Reject request</button>}
    </div>
  </article>;
}

export default function Returns() {
  const [filter, setFilter] = useState('');
  const [version, setVersion] = useState(0);
  const { data, error, loading } = useAsync(() => admin.returns(filter), [filter, version]);
  const [receipt, setReceipt] = useState('');
  const [order, setOrder] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [looking, setLooking] = useState(false);
  const refresh = () => setVersion((value) => value + 1);
  const find = async (event) => {
    event.preventDefault(); setLooking(true); setLookupError(''); setOrder(null);
    try { setOrder(await admin.order(Number(receipt))); } catch (err) { setLookupError(err.message); } finally { setLooking(false); }
  };
  return <>
    <PageHead title="Returns & exchanges" />
    <section className="panel mb-6">
      <h2 className="text-xl">Start from a receipt</h2>
      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={find}>
        <label className="text-sm font-medium">Order number<input className="input mt-1" type="number" min="1" required value={receipt} onChange={(e) => setReceipt(e.target.value)} /></label>
        <button className="btn btn-sm" disabled={looking}>{looking ? 'Finding…' : 'Find receipt'}</button>
      </form>
      {lookupError && <p className="mt-3 text-sm text-red-700" role="alert">{lookupError}</p>}
      {order && <ReturnRequestForm key={`${order.id}-${version}`} staff order={order} onSaved={() => { setOrder(null); refresh(); }} />}
    </section>
    <label className="mb-5 block max-w-xs text-sm font-medium">Request status<select className="input mt-1" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All requests</option>{['requested', 'approved', 'completed', 'rejected', 'cancelled'].map((status) => <option key={status}>{status}</option>)}</select></label>
    {loading || error ? <Status loading={loading} error={error} /> : !data.length ? <Status>No requests yet.</Status> : <div className="space-y-4">{data.map((entry) => <ReturnWorkCard key={`${entry.id}-${entry.status}`} entry={entry} onChanged={refresh} />)}</div>}
  </>;
}
