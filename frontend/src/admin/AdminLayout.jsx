import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Status } from '../components/Status.jsx';

const LINKS = [
  ['/admin', 'Dashboard', true],
  ['/admin/products', 'Products'],
  ['/admin/orders', 'Orders'],
  ['/admin/customers', 'Customers'],
  ['/admin/categories', 'Categories'],
  ['/admin/settings', 'Site settings'],
];

const linkClass = ({ isActive }) =>
  `whitespace-nowrap rounded-full px-4 py-2 text-sm transition lg:rounded-xl ${isActive ? 'bg-brand-900 text-white' : 'text-brand-700 hover:bg-brand-100'}`;

/**
 * Wraps every /admin page. Non-admins never see it: signed-out visitors go to sign in, customers go home.
 * This is only a convenience, the API refuses non-admins on its own.
 */
export default function AdminLayout() {
  const { user, isAdmin, loading, signedOutOnPurpose } = useAuth();
  const location = useLocation();

  if (loading) return <Status loading />;
  if (!user) return signedOutOnPurpose.current ? <Navigate to="/" replace /> : <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="grid gap-6 lg:grid-cols-[210px_1fr] lg:gap-10">
      <aside>
        <p className="eyebrow mb-3 hidden lg:block">Admin</p>
        <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0" aria-label="Admin">
          {LINKS.map(([to, label, end]) => <NavLink key={to} to={to} end={end} className={linkClass}>{label}</NavLink>)}
          <Link to="/" className="whitespace-nowrap rounded-full px-4 py-2 text-sm text-brand-500 hover:text-brand-900 lg:mt-4">View store ↗</Link>
        </nav>
      </aside>
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}
