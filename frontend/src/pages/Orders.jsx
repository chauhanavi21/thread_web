import { Link } from 'react-router-dom';
import { api, money } from '../api.js';
import ProductImage from '../components/ProductImage.jsx';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';

export const formatDate = (iso) =>
  new Date(`${iso.replace(' ', 'T')}Z`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export default function Orders() {
  const { data, error, loading } = useAsync(() => api.orders(), []);

  if (loading || error) return <Status loading={loading} error={error} />;
  if (data.length === 0) {
    return (
      <Status>
        <h1 className="text-3xl">No orders yet</h1>
        <p className="mt-2">When you place an order it will show up here.</p>
        <Link to="/shop" className="btn mt-6">Browse the shop</Link>
      </Status>
    );
  }

  return (
    <>
      <h1 className="text-5xl sm:text-6xl">My orders</h1>
      <ul className="mt-6 space-y-3">
        {data.map((o) => (
          <li key={o.id}>
            <Link
              to={`/orders/${o.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2  border border-brand-300 bg-white p-4 transition hover:border-brand-400 sm:px-6"
            >
              <div className="-space-x-3 flex">
                {o.items.slice(0, 3).map((i) => (
                  <div key={i.variantId} className="h-12 w-12 overflow-hidden  border-2 border-white">
                    <ProductImage type={i.type} color={i.colorHex} name="" />
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Order #{o.id}</p>
                <p className="text-sm text-brand-500">{formatDate(o.createdAt)} · {o.items.reduce((n, i) => n + i.qty, 0)} items</p>
              </div>
              <span className="pill">{o.status}</span>
              <strong className="w-20 text-right">{money(o.totalCents)}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
