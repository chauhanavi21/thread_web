import { useState } from 'react';
import { admin, money } from '../api.js';
import { Status } from '../components/Status.jsx';
import { useAsync } from '../components/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHead, confirmThen, formatDateTime, useFlash } from './ui.jsx';

export default function Customers() {
  const { user: me } = useAuth();
  const [version, setVersion] = useState(0);
  const { data, error, loading } = useAsync(() => admin.users(), [version]);
  const [flash, flashNode] = useFlash();

  const run = async (fn, okMessage) => {
    try {
      await fn();
      flash(okMessage);
      setVersion((v) => v + 1);
    } catch (err) {
      flash(err.message, true);
    }
  };

  if (loading && !data) return <Status loading />;
  if (error) return <Status error={error} />;

  return (
    <>
      <PageHead title="Customers" />
      <div className="overflow-x-auto rounded-2xl border border-brand-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-brand-200 bg-brand-100 text-xs uppercase tracking-wider text-brand-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Joined</th>
              <th className="px-3 py-3 text-right font-medium">Orders</th>
              <th className="px-3 py-3 text-right font-medium">Spent</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {data.map((u) => {
              const self = u.id === me.id;
              return (
                <tr key={u.id}>
                  <td className="px-4 py-2.5"><span className="block font-medium">{u.name}{self && <span className="ml-2 text-xs text-brand-500">(you)</span>}</span><span className="block text-xs text-brand-500">{u.email}</span></td>
                  <td className="px-3 py-2.5 text-brand-600">{formatDateTime(u.createdAt)}</td>
                  <td className="px-3 py-2.5 text-right">{u.orderCount}</td>
                  <td className="px-3 py-2.5 text-right">{money(u.spentCents)}</td>
                  <td className="px-3 py-2.5">
                    <select
                      className="input w-auto rounded-full py-1.5 pr-8 text-xs"
                      value={u.role}
                      disabled={self}
                      onChange={(e) => confirmThen(`Make ${u.name} ${e.target.value === 'admin' ? 'an admin? They will get full control of the store' : 'a customer? They will lose admin access'}.`, () => run(() => admin.setRole(u.id, e.target.value), 'Role updated.'))}
                      aria-label={`Role of ${u.name}`}
                    >
                      <option value="customer">Customer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!self && u.role === 'customer' && u.orderCount === 0 && (
                      <button className="link-btn !text-red-700" onClick={() => confirmThen(`Delete ${u.name}'s account?`, () => run(() => admin.deleteUser(u.id), 'Account deleted.'))}>Delete</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {flashNode}
    </>
  );
}
