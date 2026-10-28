import { useState } from 'react';
import { admin, money } from '../api.js';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';
import { PageHead, STATUSES, formatDateTime, statusClass, useFlash } from './ui.jsx';

export default function Orders() {
  const [filter, setFilter] = useState('');
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState(null);
  const { data, error, loading } = useAsync(() => admin.orders(filter), [filter, version]);
  const [flash, flashNode] = useFlash();

  const setStatus = async (order, status) => {
    if (status === 'cancelled' && !window.confirm(`Cancel order #${order.id}? The items go back into stock.`)) return;
    try {
      await admin.setOrderStatus(order.id, status);
      flash(`Order #${order.id} is now ${status}.`);
      setVersion((v) => v + 1);
    } catch (err) {
      flash(err.message, true);
    }
  };

  return (
    <>
      <PageHead title="Orders" />
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto" role="group" aria-label="Filter by status">
        <button className={`chip ${!filter ? 'chip-on' : ''}`} onClick={() => setFilter('')}>All</button>
        {STATUSES.map((s) => <button key={s} className={`chip capitalize ${filter === s ? 'chip-on' : ''}`} onClick={() => setFilter(s)}>{s}</button>)}
      </div>

      {loading && !data ? <Status loading /> : error ? <Status error={error} /> : data.length === 0 ? (
        <Status>No orders here yet.</Status>
      ) : (
        <ul className="space-y-3">
          {data.map((o) => {
            const isOpen = open === o.id;
            return (
              <li key={o.id} className="overflow-hidden rounded-2xl border border-brand-200 bg-white">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                  <button className="flex min-w-0 flex-1 items-center gap-4 text-left" onClick={() => setOpen(isOpen ? null : o.id)} aria-expanded={isOpen}>
                    <span className="font-semibold">#{o.id}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{o.customer.name} <span className="text-brand-500">· {o.customer.email}</span></span>
                      <span className="block text-xs text-brand-500">{formatDateTime(o.createdAt)} · {o.items.reduce((n, i) => n + i.qty, 0)} items</span>
                    </span>
                  </button>
                  <strong>{money(o.totalCents)}</strong>
                  <select
                    className={`rounded-full border-0 py-1.5 pl-3 pr-8 text-xs font-medium capitalize ${statusClass(o.status)}`}
                    value={o.status}
                    onChange={(e) => setStatus(o, e.target.value)}
                    aria-label={`Status of order ${o.id}`}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {isOpen && (
                  <div className="grid gap-4 border-t border-brand-100 bg-brand-50 px-4 py-4 text-sm sm:grid-cols-[1fr_auto] sm:px-5">
                    <ul className="space-y-1.5">
                      {o.items.map((i) => (
                        <li key={i.variantId} className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 rounded-full border border-black/15" style={{ backgroundColor: i.colorHex }} />
                          <span className="flex-1">{i.name} <span className="text-brand-500">· {i.color}, {i.size} × {i.qty}</span></span>
                          <span>{money(i.priceCents * i.qty)}</span>
                        </li>
                      ))}
                      <li className="flex justify-between border-t border-brand-200 pt-2 text-brand-600"><span>Shipping</span><span>{o.shippingCents === 0 ? 'Free' : money(o.shippingCents)}</span></li>
                    </ul>
                    <address className="not-italic text-brand-600">
                      <span className="eyebrow mb-1 block">Ship to</span>
                      {o.shipping.name}<br />{o.shipping.address}<br />{o.shipping.city} {o.shipping.zip}
                    </address>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {flashNode}
    </>
  );
}
