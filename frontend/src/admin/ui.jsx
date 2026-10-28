import { useEffect, useRef, useState } from 'react';
import { admin } from '../api.js';

export const STATUSES = ['paid', 'processing', 'shipped', 'delivered', 'cancelled'];

export const statusClass = (s) =>
  ({
    paid: 'bg-amber-100 text-amber-800',
    processing: 'bg-sky-100 text-sky-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-brand-200 text-brand-600 line-through',
  })[s] ?? 'bg-brand-200 text-brand-800';

export const formatDateTime = (iso) =>
  new Date(`${iso.replace(' ', 'T')}Z`).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function PageHead({ title, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-4xl sm:text-5xl">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block text-sm font-medium text-brand-700 ${className}`}>
      {label}
      <div className="mt-1 font-normal">{children}</div>
      {hint && <span className="mt-1 block text-xs font-normal text-brand-500">{hint}</span>}
    </label>
  );
}

/** A transient message that clears itself. `flash(text, isError)` shows it. */
export function useFlash(ms = 3500) {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = (text, error = false) => {
    setMsg({ text, error });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), ms);
  };
  const node = msg && (
    <p className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm shadow-lift ${msg.error ? 'bg-red-600 text-white' : 'bg-brand-900 text-white'}`} role={msg.error ? 'alert' : 'status'}>
      {msg.text}
    </p>
  );
  return [flash, node];
}

/** Picks or uploads a picture and reports its URL. Empty means "use the drawn garment". */
export function ImageField({ value, onChange, onError }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      onChange(await admin.upload(file));
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-start gap-4">
      <div className="grid h-28 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-200 text-center text-xs text-brand-500">
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : 'No photo'}
      </div>
      <div className="space-y-2">
        <label className="btn btn-outline btn-sm cursor-pointer">
          {busy ? 'Uploading…' : value ? 'Replace photo' : 'Upload photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick} disabled={busy} />
        </label>
        {value && <button type="button" className="link-btn block" onClick={() => onChange(null)}>Remove photo</button>}
        <p className="text-xs text-brand-500">JPEG, PNG or WebP, up to 5 MB. Without a photo the shop shows a drawn garment.</p>
      </div>
    </div>
  );
}

/** Confirms before running a destructive action. */
export const confirmThen = (message, fn) => {
  if (window.confirm(message)) fn();
};
