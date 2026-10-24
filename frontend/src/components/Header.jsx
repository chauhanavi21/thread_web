import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

const NAV = [
  ['/shop?category=women', 'Women'],
  ['/shop?category=men', 'Men'],
  ['/shop?category=accessories', 'Accessories'],
  ['/shop', 'All pieces'],
];

const navClass = ({ isActive }) => `text-sm transition hover:text-accent-600 ${isActive ? 'text-brand-950' : 'text-brand-600'}`;

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/**
 * Sticky header. Desktop: wordmark, links, search and account/bag. Below `md` the links and search move into a
 * full-width drop-down panel behind the menu button, so nothing is squeezed on a phone.
 */
export default function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => setOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const search = (e) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop');
    setQ('');
  };

  const searchBox = (
    <form onSubmit={search} role="search" className="w-full">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search hoodies, jeans, dresses…"
        aria-label="Search products"
        className="input rounded-full bg-brand-100 py-2 pl-4"
      />
    </form>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-brand-200 bg-brand-50/90 backdrop-blur">
      <div className="page flex items-center gap-4 py-3 md:gap-8">
        <button
          type="button"
          className="-ml-2 rounded-full p-2 hover:bg-brand-100 md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <Icon>{open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</Icon>
        </button>

        <Link to="/" className="font-display text-[28px] leading-none text-brand-950">
          Threads<span className="text-accent-500">.</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex lg:gap-8" aria-label="Main">
          {NAV.map(([to, label]) => <NavLink key={label} to={to} end className={navClass}>{label}</NavLink>)}
        </nav>

        <div className="mx-2 hidden max-w-sm flex-1 lg:block">{searchBox}</div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <Link to="/orders" className="hidden rounded-full px-3 py-2 text-sm text-brand-700 hover:bg-brand-100 sm:block">Hi, {user.name.split(' ')[0]}</Link>
              <button type="button" className="hidden rounded-full px-3 py-2 text-sm text-brand-500 hover:bg-brand-100 sm:block" onClick={() => { logout(); navigate('/'); }}>Sign out</button>
            </>
          ) : (
            <Link to="/login" className="rounded-full p-2 hover:bg-brand-100 sm:px-3 sm:text-sm" aria-label="Sign in">
              <span className="hidden sm:inline">Sign in</span>
              <span className="sm:hidden"><Icon><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5" /></Icon></span>
            </Link>
          )}
          <Link to="/cart" className="relative rounded-full p-2 hover:bg-brand-100" aria-label={`Bag, ${count} items`}>
            <Icon><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Icon>
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-600 px-1 text-[11px] font-semibold text-white">{count}</span>
            )}
          </Link>
        </div>
      </div>

      <div id="mobile-menu" className={`md:hidden ${open ? 'block' : 'hidden'}`}>
        <div className="page space-y-4 border-t border-brand-200 pb-5 pt-4">
          {searchBox}
          <nav className="flex flex-col" aria-label="Mobile">
            {NAV.map(([to, label]) => (
              <Link key={label} to={to} className="border-b border-brand-200 py-3 font-display text-2xl text-brand-900">{label}</Link>
            ))}
            {user && <Link to="/orders" className="border-b border-brand-200 py-3 font-display text-2xl text-brand-900">My orders</Link>}
          </nav>
          {user && <button type="button" className="link-btn" onClick={() => { logout(); navigate('/'); }}>Sign out</button>}
        </div>
      </div>
    </header>
  );
}

