import { Link } from 'react-router-dom';
import { admin, money } from '../api.js';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';
import { PageHead, formatDateTime, statusClass } from './ui.jsx';

function Tile({ label, value, to, note }) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-wider text-brand-500">{label}</p>
      <p className="mt-1 font-display text-4xl text-brand-950">{value}</p>
      {note && <p className="mt-0.5 text-xs text-brand-500">{note}</p>}
    </>
  );
  const cls = 'rounded-2xl border border-brand-200 bg-white p-5';
  return to ? <Link to={to} className={`${cls} transition hover:border-brand-400`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export default function Dashboard() {
  const { data: s, error, loading } = useAsync(() => admin.stats(), []);
  if (loading || error) return <Status loading={loading} error={error} />;

  return (
    <>
      <PageHead title="Dashboard" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <Tile label="Revenue" value={money(s.revenueCents)} note="excluding cancelled" />
        <Tile label="Orders" value={s.orders} to="/admin/orders" />
        <Tile label="To fulfil" value={s.toFulfil} to="/admin/orders" note="paid or processing" />
        <Tile label="Products" value={s.products} to="/admin/products" note={`${s.activeProducts} visible`} />
        <Tile label="Customers" value={s.customers} to="/admin/customers" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="panel">
          <h2 className="text-2xl">Recent orders</h2>
          {s.recentOrders.length === 0 ? (
            <p className="mt-3 text-sm text-brand-500">No orders yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-brand-100">
              {s.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link to="/admin/orders" className="flex items-center gap-3 py-2.5 text-sm hover:text-accent-600">
                    <span className="w-14 font-medium">#{o.id}</span>
                    <span className="min-w-0 flex-1 truncate">{o.customer}<span className="block text-xs text-brand-500">{formatDateTime(o.createdAt)}</span></span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${statusClass(o.status)}`}>{o.status}</span>
                    <strong className="w-20 text-right">{money(o.totalCents)}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2 className="text-2xl">Low stock</h2>
          {s.lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-brand-500">Nothing is running low.</p>
          ) : (
            <ul className="mt-3 divide-y divide-brand-100">
              {s.lowStock.map((v) => (
                <li key={v.variantId}>
                  <Link to={`/admin/products/${v.productId}`} className="flex items-center gap-3 py-2.5 text-sm hover:text-accent-600">
                    <span className="min-w-0 flex-1 truncate">{v.name}<span className="block text-xs text-brand-500">{v.color} · {v.size}</span></span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs ${v.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{v.stock === 0 ? 'Sold out' : `${v.stock} left`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel xl:col-span-2">
          <h2 className="text-2xl">Best sellers</h2>
          {s.topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-brand-500">Sales will show up here once orders come in.</p>
          ) : (
            <ul className="mt-3 divide-y divide-brand-100">
              {s.topProducts.map((p) => (
                <li key={p.productId} className="flex items-center justify-between py-2.5 text-sm">
                  <Link to={`/admin/products/${p.productId}`} className="hover:text-accent-600">{p.name}</Link>
                  <span className="text-brand-500">{p.sold} sold</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
