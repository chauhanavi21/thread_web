import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, money } from '../api.js';
import ProductImage from '../components/ProductImage.jsx';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';
import { formatDate } from './Orders.jsx';
import Returns from '../components/Returns.jsx';
import { useInventoryVersion } from '../context/InventoryContext.jsx';

export default function OrderDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const [version, setVersion] = useState(0);
  const inventoryVersion = useInventoryVersion();
  const { data: o, error, loading } = useAsync(() => api.order(id), [id, version, inventoryVersion]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const cancelButton = useRef(null);
  const cancellationNotice = useRef(null);

  useEffect(() => {
    if (!loading && version > 0) cancellationNotice.current?.focus();
  }, [loading, version]);

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      await api.cancelOrder(id);
      setConfirming(false);
      setVersion((v) => v + 1);
    } catch (err) {
      setActionError(err.message);
      // An order may have shipped since this page was opened.
      if (err.status === 409) {
        setConfirming(false);
        setVersion((v) => v + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  if ((loading && !o) || error) return <Status loading={loading && !o} error={error} />;
  const isPickup = o.fulfillment === 'pickup';

  return (
    <>
      {state?.placed && ['paid', 'processing', 'reserved', 'ready'].includes(o.status) && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-100 px-5 py-4 text-brand-900" role="status">
          <p className="font-semibold">{isPickup ? 'Your pickup is reserved.' : 'Thank you! Your order has been placed.'}</p>
          <p className="text-sm">{isPickup ? 'Pay cash at collection. Check this page for Ready for pickup before visiting.' : 'A confirmation is saved below. Email receipts will be added later.'}</p>
        </div>
      )}
      <p className="mb-2 text-sm text-brand-500">
        <Link to="/orders" className="hover:underline">My orders</Link> / #{o.id}
      </p>
      <h1 className="text-4xl sm:text-6xl">Order #{o.id}</h1>
      <p className="mt-1 text-brand-500">{formatDate(o.createdAt)} · <span className="pill">{o.status === 'ready' ? 'Ready for pickup' : o.status}</span></p>

      {isPickup && <section className="panel mt-5 space-y-2" aria-label="Pickup information">
        <h2 className="text-xl">Collect in store</h2>
        <p className="text-sm">{o.pickup.location}</p>
        <p className="text-sm text-brand-600">{o.pickup.instructions}</p>
        <p className="text-sm text-brand-600">Hold ends {new Date(o.pickup.expiresAt).toLocaleString()}. Contact: {o.pickup.contact}</p>
        {['reserved', 'ready'].includes(o.status) && <p className="font-semibold">Pay {money(o.totalCents)} cash at collection.</p>}
        {o.paymentStatus === 'paid' && <p className="text-sm">Cash received: {money(o.cashReceivedCents)} · Change: {money(o.changeCents)}</p>}
        {o.status === 'expired' && <p role="status" className="font-medium">This pickup reservation expired. Your items have been released and no payment was taken. <Link to="/shop" className="underline">Browse the shop to reserve again.</Link></p>}
      </section>}

      {o.status === 'cancelled' && (
        <p ref={cancellationNotice} tabIndex={-1} className="mt-5 rounded-xl border border-brand-200 bg-brand-100 px-5 py-4 text-brand-900" role="status">
          {isPickup ? 'This pickup reservation has been cancelled. Your items have been released and no payment was taken.' : 'This order has been cancelled. No payment was taken in this demo.'}
        </p>
      )}
      {actionError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{actionError}</p>}
      {o.canCancel && (
        <section className="mt-5 rounded-2xl border border-brand-200 bg-white p-5" aria-label="Order cancellation">
          <p className="text-sm text-brand-600">{isPickup ? 'Changed your mind? You can cancel until collection or the hold deadline.' : 'Changed your mind? You can cancel until your order ships.'}</p>
          <button
            ref={cancelButton}
            className="link-btn mt-2"
            onClick={() => { setActionError(''); setConfirming((value) => !value); }}
            disabled={busy}
            aria-expanded={confirming}
            aria-controls={confirming ? 'cancel-confirmation' : undefined}
          >Cancel order</button>
          {confirming && (
            <div id="cancel-confirmation" className="mt-4 border-t border-brand-200 pt-4">
              <p className="font-medium">Cancel order #{o.id}?</p>
              <p className="mt-1 text-sm text-brand-600">{isPickup ? 'Your items will be released. No refund is needed because payment is due at collection.' : 'Your items will no longer be reserved. No refund is needed because this is a demo purchase.'}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button className="btn" onClick={cancel} disabled={busy}>{busy ? 'Cancelling…' : 'Yes, cancel order'}</button>
                <button className="link-btn" disabled={busy} onClick={() => { setConfirming(false); cancelButton.current?.focus(); }}>Keep order</button>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-brand-100 overflow-hidden rounded-2xl border border-brand-200 bg-white">
          {o.items.map((i) => (
            <li key={i.variantId} className="flex items-center gap-4 p-3 sm:p-4">
              <div className="w-16 shrink-0 overflow-hidden  sm:w-20">
                <ProductImage image={i.image} type={i.type} color={i.colorHex} name={`${i.name} in ${i.color}`} ratio="aspect-[4/5]" className="rounded-xl" />
              </div>
              <div className="min-w-0 flex-1">
                <Link to={`/product/${i.slug}`} className="font-semibold hover:underline">{i.name}</Link>
                <p className="text-sm text-brand-500">{i.color}{i.size !== 'One size' && ` · ${i.size}`} · {money(i.priceCents)} × {i.qty}</p>
              </div>
              <strong>{money(i.priceCents * i.qty)}</strong>
            </li>
          ))}
        </ul>
        <div className="space-y-4">
          <aside className="panel">
            <h2 className="text-lg">Totals</h2>
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              <dt className="text-brand-600">Subtotal</dt><dd className="text-right">{money(o.subtotalCents)}</dd>
              <dt className="text-brand-600">{isPickup ? 'Collection fee' : 'Shipping'}</dt><dd className="text-right">{o.shippingCents === 0 ? 'Free' : money(o.shippingCents)}</dd>
              <dt className="border-t border-brand-200 pt-3 text-base font-semibold">{!isPickup ? 'Total' : o.paymentStatus === 'paid' ? 'Total paid' : ['reserved', 'ready'].includes(o.status) ? 'Due at collection' : 'Reservation total (not charged)'}</dt>
              <dd className="border-t border-brand-200 pt-3 text-right text-base font-semibold">{money(o.totalCents)}</dd>
            </dl>
          </aside>
          <aside className="panel">
            <h2 className="text-lg">{isPickup ? 'Collecting customer' : 'Ships to'}</h2>
            <p className="mt-2 text-sm text-brand-600">{o.shipping.name}<br />{isPickup ? o.pickup.contact : <>{o.shipping.address}<br />{o.shipping.city} {o.shipping.zip}</>}</p>
          </aside>
        </div>
      </div>
      <Returns key={o.id} order={o} onSaved={() => setVersion((value) => value + 1)} />
    </>
  );
}
