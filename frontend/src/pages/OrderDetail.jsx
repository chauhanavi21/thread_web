import { Link, useLocation, useParams } from 'react-router-dom';
import { api, money } from '../api.js';
import ProductImage from '../components/ProductImage.jsx';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';
import { formatDate } from './Orders.jsx';

export default function OrderDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const { data: o, error, loading } = useAsync(() => api.order(id), [id]);

  if (loading || error) return <Status loading={loading} error={error} />;

  return (
    <>
      {state?.placed && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-100 px-5 py-4 text-brand-900" role="status">
          <p className="font-semibold">Thank you! Your order has been placed.</p>
          <p className="text-sm">A confirmation is saved below. Email receipts will be added later.</p>
        </div>
      )}
      <p className="mb-2 text-sm text-brand-500">
        <Link to="/orders" className="hover:underline">My orders</Link> / #{o.id}
      </p>
      <h1 className="text-4xl sm:text-6xl">Order #{o.id}</h1>
      <p className="mt-1 text-brand-500">{formatDate(o.createdAt)} · <span className="pill">{o.status}</span></p>

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
              <dt className="text-brand-600">Shipping</dt><dd className="text-right">{o.shippingCents === 0 ? 'Free' : money(o.shippingCents)}</dd>
              <dt className="border-t border-brand-200 pt-3 text-base font-semibold">Total</dt>
              <dd className="border-t border-brand-200 pt-3 text-right text-base font-semibold">{money(o.totalCents)}</dd>
            </dl>
          </aside>
          <aside className="panel">
            <h2 className="text-lg">Ships to</h2>
            <p className="mt-2 text-sm text-brand-600">{o.shipping.name}<br />{o.shipping.address}<br />{o.shipping.city} {o.shipping.zip}</p>
          </aside>
        </div>
      </div>
    </>
  );
}
