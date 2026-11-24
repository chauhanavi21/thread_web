import { useState } from 'react';
import { admin, money } from '../api.js';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';
import { useInventoryVersion } from '../context/InventoryContext.jsx';
import { PageHead } from './ui.jsx';

function PickupCard({ order, onChanged }) {
  const [cash, setCash] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const act = async (action) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (action === 'collect') await admin.collectPickup(order.id, Math.round(Number(cash) * 100));
      else await admin.setOrderStatus(order.id, action);
      onChanged();
    } catch (err) { setError(err.message); if (err.status === 409) onChanged(); } finally { setBusy(false); }
  };
  return <article className="panel space-y-3" aria-label={`Pickup ${order.id}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl">Pickup #{order.id}</h2><span className="pill">{order.status === 'ready' ? 'Ready for pickup' : order.status}</span></div>
    <p className="text-sm">{order.shipping.name} · {order.pickup.contact}</p>
    <ul className="space-y-1 text-sm text-brand-600">{order.items.map((item) => <li key={item.id}>{item.name} · {item.color}, {item.size} × {item.qty}</li>)}</ul>
    <p className="text-sm text-brand-600">Hold ends {new Date(order.pickup.expiresAt).toLocaleString()}<br />{order.pickup.location}</p>
    <p className="font-semibold">{order.paymentStatus === 'paid' ? `Cash recorded: ${money(order.totalCents)}` : ['cancelled', 'expired'].includes(order.status) ? 'Closed — no payment recorded' : `Due at collection: ${money(order.totalCents)}`}</p>
    {order.paymentStatus === 'paid' && <p className="text-sm">Cash received {money(order.cashReceivedCents)} · Change {money(order.changeCents)}</p>}
    {order.status === 'reserved' && <button className="btn btn-sm" disabled={busy} onClick={() => act('ready')}>Mark ready for pickup</button>}
    {order.status === 'ready' && <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); act('collect'); }}>
      <label className="text-sm font-medium">Cash received for pickup #{order.id} ($)<input className="input mt-1" type="number" step="0.01" min={(order.totalCents / 100).toFixed(2)} required disabled={busy} value={cash} onChange={(e) => setCash(e.target.value)} /></label>
      <button className="btn btn-sm" disabled={busy}>Record payment & collection</button>
      <p className="w-full text-xs text-brand-500">Confirm the customer's order number, receive cash and hand over the reserved items before recording collection.</p>
    </form>}
    {['reserved', 'ready'].includes(order.status) && <button className="link-btn block" disabled={busy} onClick={() => { if (window.confirm(`Cancel pickup #${order.id} and release its items?`)) act('cancelled'); }}>Cancel pickup</button>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </article>;
}

export default function Pickups() {
  const inventoryVersion = useInventoryVersion();
  const [filter, setFilter] = useState('');
  const [version, setVersion] = useState(0);
  const { data, loading, error } = useAsync(() => admin.pickups(filter), [filter, version, inventoryVersion]);
  return <>
    <PageHead title="Click & collect" />
    <p className="mb-4 max-w-2xl text-sm text-brand-600">Prepare reservations, mark them ready, and record cash when the customer collects. Holds expire at the displayed deadline, including preparation time. Unpaid holds are excluded from revenue.</p>
    <label className="mb-5 block max-w-xs text-sm font-medium">Pickup status<select className="input mt-1" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All pickups</option>{['reserved', 'ready', 'collected', 'cancelled', 'expired'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
    {loading && !data ? <Status loading /> : error ? <Status error={error} /> : !data?.length ? <Status>No pickups here yet.</Status> : <div className="space-y-4">{data.map((order) => <PickupCard key={`${order.id}-${order.status}`} order={order} onChanged={() => setVersion((value) => value + 1)} />)}</div>}
  </>;
}
