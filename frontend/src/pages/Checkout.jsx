import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { checkoutKey, clearCheckoutKey } from '../checkoutAttempt.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { OrderSummary } from './CartPage.jsx';
import { useSite } from '../context/SiteContext.jsx';

function Field({ label, className = '', ...props }) {
  return (
    <label className={`block text-sm font-medium text-brand-700 ${className}`}>
      {label}
      <input className="input mt-1" {...props} />
    </label>
  );
}

export default function Checkout() {
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const { settings } = useSite();
  const [fulfillment, setFulfillment] = useState('shipping');
  const [contact, setContact] = useState(user?.email ?? '');
  const [form, setForm] = useState({ name: user?.name ?? '', address: '', city: '', zip: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Clearing the bag after a successful order would otherwise trigger the empty-bag redirect below.
  const placed = useRef(false);
  const submitting = useRef(false);

  if (cart.lines.length === 0 && !placed.current) return <Navigate to="/cart" replace />;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    setBusy(true);
    try {
      const body = {
        items: cart.lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        ...(fulfillment === 'pickup' ? { fulfillment, pickup: { name: form.name, contact } } : { shipping: form }),
      };
      const key = await checkoutKey(user.id, body);
      const order = await api.placeOrder(body, key);
      placed.current = true;
      cart.clear();
      clearCheckoutKey(user.id, key);
      navigate(`/orders/${order.id}`, { replace: true, state: { placed: true } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
      submitting.current = false;
    }
  };

  return (
    <>
      <h1 className="text-4xl sm:text-6xl">Checkout</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="panel space-y-4 sm:p-7">
          <fieldset disabled={busy} className="space-y-2">
            <legend className="mb-2 text-xl">How would you like your items?</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="fulfillment" value="shipping" checked={fulfillment === 'shipping'} onChange={() => setFulfillment('shipping')} />Ship to my address</label>
            {settings.pickupEnabled && <label className="flex items-center gap-2 text-sm"><input type="radio" name="fulfillment" value="pickup" checked={fulfillment === 'pickup'} onChange={() => setFulfillment('pickup')} />Collect in store — pay at pickup</label>}
          </fieldset>
          <fieldset disabled={busy} className="space-y-4">
            <legend className="mb-4 text-xl">{fulfillment === 'pickup' ? 'Pickup details' : 'Shipping details'}</legend>
            <Field label="Full name" required value={form.name} onChange={set('name')} autoComplete="name" maxLength={100} />
            {fulfillment === 'pickup' ? <>
              <Field label="Pickup contact (phone or email)" required value={contact} onChange={(e) => setContact(e.target.value)} minLength={3} maxLength={120} />
              <div className="rounded-xl bg-brand-100 p-4 text-sm text-brand-700">
                <p className="font-semibold">{settings.pickupAddress}</p><p className="mt-1">{settings.pickupInstructions}</p>
                <p className="mt-2">Your items are held for {settings.pickupHoldHours} hours from reservation, including preparation time. No shipping fee. Uncollected holds expire automatically.</p>
              </div>
            </> : <>
            <Field label="Address" required value={form.address} onChange={set('address')} autoComplete="street-address" maxLength={200} />
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="City" required value={form.city} onChange={set('city')} autoComplete="address-level2" maxLength={100} />
              <Field label="ZIP / postal code" required value={form.zip} onChange={set('zip')} autoComplete="postal-code" minLength={3} maxLength={12} />
            </div>
            </>}
          </fieldset>

          <h2 className="pt-2 text-xl">Payment</h2>
          <p className=" bg-brand-50 px-4 py-3 text-sm text-brand-600">
            {fulfillment === 'pickup' ? 'Pay cash when you collect. Reserving your items does not record a payment. Check My orders for Ready for pickup.' : 'Demo store: no card is needed and nothing is charged. Placing the order marks it as paid.'}
          </p>
          {error && (
            <p className=" bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error} {fulfillment === 'pickup' ? 'Retrying the same items and pickup contact is safe.' : 'Retrying the same bag and address is safe.'} <Link to="/orders" className="underline">Check my orders</Link> or <Link to="/cart" className="underline">review bag</Link>.
            </p>
          )}
          <button className="btn w-full py-3.5 sm:w-auto sm:px-10" disabled={busy}>{busy ? 'Saving…' : fulfillment === 'pickup' ? 'Reserve for pickup' : 'Place order'}</button>
        </form>
        <div className="lg:sticky lg:top-28 lg:self-start"><OrderSummary cart={fulfillment === 'pickup' ? { ...cart, shippingCents: 0, totalCents: cart.subtotalCents } : cart} fulfillment={fulfillment} /></div>
      </div>
    </>
  );
}
