import { useEffect, useRef, useState } from 'react';
import { api, admin, money } from '../api.js';

export function ReturnRequestForm({ order, staff = false, onSaved }) {
  const eligible = order.items.filter((item) => item.returnableQty > 0);
  const [itemId, setItemId] = useState(String(eligible[0]?.id ?? ''));
  const [kind, setKind] = useState('return');
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [product, setProduct] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef(null);
  const item = eligible.find((entry) => entry.id === Number(itemId));
  const eligibleIds = eligible.map((entry) => entry.id).join(',');

  useEffect(() => {
    if (!eligible.some((entry) => entry.id === Number(itemId))) {
      setItemId(String(eligible[0]?.id ?? ''));
      setQty('1');
    }
  }, [eligibleIds, itemId]);

  useEffect(() => {
    let active = true;
    setProduct(null);
    setReplacementId('');
    if (kind === 'exchange' && item) {
      const load = staff ? admin.product(item.productId) : api.product(item.slug);
      load.then((value) => active && setProduct(value)).catch((err) => active && setError(err.message));
    }
    return () => { active = false; };
  }, [kind, item?.productId, staff]);

  if (!eligible.length) return <p className="text-sm text-brand-600">No items are currently available for a new return or exchange. Check the delivery status, return window, and existing requests.</p>;

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const body = { kind, reason, items: [{ orderItemId: item.id, qty: Number(qty), ...(kind === 'exchange' ? { replacementVariantId: Number(replacementId) } : {}) }] };
    const signature = JSON.stringify(body);
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    try {
      if (staff) await admin.createReturn({ orderId: order.id, ...body }, attempt.current.key);
      else await api.requestReturn(order.id, body, attempt.current.key);
      attempt.current = null;
      setReason('');
      setQty('1');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">What do you need?
          <select className="input mt-1" value={kind} onChange={(e) => { setKind(e.target.value); setError(''); }}>
            <option value="return">Return for a refund</option><option value="exchange">Exchange size or colour</option>
          </select>
        </label>
        <label className="text-sm font-medium">Purchased item
          <select className="input mt-1" value={itemId} onChange={(e) => { setItemId(e.target.value); setQty('1'); }}>
            {eligible.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.color}, {entry.size}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Return quantity
          <input className="input mt-1" type="number" min="1" max={item?.returnableQty} required value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        {kind === 'exchange' && <label className="text-sm font-medium">Replacement size and colour
          <select className="input mt-1" required value={replacementId} onChange={(e) => setReplacementId(e.target.value)}>
            <option value="">{product ? 'Choose a replacement' : 'Loading sizes…'}</option>
            {product?.variants.filter((variant) => variant.id !== item.variantId).map((variant) => <option key={variant.id} value={variant.id} disabled={variant.stock < Number(qty)}>{variant.color}, {variant.size} · {variant.stock} available</option>)}
          </select>
        </label>}
        <label className="text-sm font-medium sm:col-span-2">Reason
          <textarea className="input mt-1" required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </fieldset>
      <p className="text-sm text-brand-600">{kind === 'exchange' ? 'The original purchase price is kept. Replacement stock is held after staff approves the exchange. Bring the original item to the shop for inspection and handover.' : `Item refund: ${money((item?.priceCents ?? 0) * Number(qty || 0))}. Shipping is not refunded. Bring the item to the shop for inspection.`}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className="btn btn-sm" disabled={busy || !item || (kind === 'exchange' && !product)}>{busy ? 'Saving…' : kind === 'exchange' ? 'Request exchange' : 'Request return'}</button>
    </form>
  );
}

export function ReturnHistory({ cases, onWithdraw }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const withdraw = async (id) => {
    if (pending !== null) return;
    setPending(id);
    setError('');
    try { await api.cancelReturn(id); onWithdraw(); } catch (err) { setError(err.message); } finally { setPending(null); }
  };
  return (
    <div className="mt-5 space-y-3">
      {cases.map((entry) => <article key={entry.id} className="rounded-xl border border-brand-200 p-4" aria-label={`${entry.kind} request ${entry.id}`}>
        <p className="font-semibold capitalize">{entry.kind} #{entry.id} <span className="pill ml-2">{entry.status}</span></p>
        <ul className="mt-2 space-y-1 text-sm text-brand-600">{entry.items.map((item) => <li key={item.id}>{item.name} · {item.color}, {item.size} × {item.qty}{item.replacement && ` → ${item.replacement.color}, ${item.replacement.size}`}{item.restock !== null && (item.restock ? ' · returned to stock' : ' · kept out of sellable stock')}</li>)}</ul>
        {entry.kind === 'return' && <p className="mt-2 text-sm">{entry.status === 'completed' ? 'Refund recorded' : 'Item refund'}: {money(entry.refundCents)}</p>}
        {entry.status === 'approved' && <p className="mt-2 text-sm text-brand-600">Approved. Bring your item to the shop.{entry.kind === 'exchange' && ' Your replacement is reserved.'}</p>}
        {onWithdraw && entry.canCancel && <button className="link-btn mt-3" disabled={pending !== null} onClick={() => withdraw(entry.id)}>Withdraw request #{entry.id}</button>}
      </article>)}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export default function Returns({ order, onSaved }) {
  return <section className="panel mt-8" aria-label="Returns and exchanges">
    <h2 className="text-2xl">Returns &amp; size exchanges</h2>
    {order.returnWindowEndsAt && <p className="mt-2 text-sm text-brand-600">Return window ends {new Date(order.returnWindowEndsAt).toLocaleDateString()}.</p>}
    <ReturnRequestForm order={order} onSaved={onSaved} />
    <ReturnHistory cases={order.returnCases} onWithdraw={onSaved} />
  </section>;
}
