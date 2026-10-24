import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

const PANEL_WIDTH = 'min(380px, calc(100vw - 48px))';

const NAV = [
  ['/', 'Home'],
  ['/shop?category=women', 'Women'],
  ['/shop?category=men', 'Men'],
  ['/shop?category=accessories', 'Accessories'],
  ['/shop', 'All pieces'],
];

/** Big grey slab button; a black bar grows along its bottom edge on hover. */
function Slab({ children, className = '', ...props }) {
  return (
    <Link {...props} className={`group relative flex h-[84px] items-end overflow-hidden border border-brand-300 bg-brand-100 px-3 pb-2 text-2xl font-bold ${className}`}>
      {children}
      <span className="absolute inset-x-0 bottom-0 h-0 bg-brand-950 transition-all duration-300 group-hover:h-2" />
    </Link>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [atTop, setAtTop] = useState(true);

  useEffect(() => setOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // The home hero already shows the wordmark in huge type, so the small one waits until you scroll.
  const hideWordmark = location.pathname === '/' && atTop;
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

  return (
    <>
      {/* Wordmark and bag stay readable over photos and dark sections thanks to the difference blend. */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 text-white mix-blend-difference">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
          <Link to="/" className={`pointer-events-auto font-display text-3xl uppercase leading-none transition-opacity ${hideWordmark ? 'opacity-0' : ''}`}>
            Threads<sup className="text-base">®</sup>
          </Link>
          <Link to="/cart" className="pointer-events-auto text-sm font-bold uppercase tracking-wider" aria-label={`Bag, ${count} items`}>
            Bag [{count}]
          </Link>
        </div>
      </header>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        style={{ right: open ? PANEL_WIDTH : 0 }}
        className="fixed top-1/2 z-[60] grid h-[52px] w-12 -translate-y-1/2 place-items-center border border-brand-400 bg-brand-50 transition-[right] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-brand-200"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
        </svg>
      </button>

      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 bg-black/20 transition-opacity duration-500 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden="true"
      />
      <aside
        id="menu"
        aria-hidden={!open}
        inert={!open}
        style={{ width: PANEL_WIDTH }}
        className={`fixed right-0 top-0 z-[55] flex h-full flex-col gap-3 overflow-y-auto border-l border-brand-400 bg-brand-50 p-5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <nav className="flex flex-col gap-2.5" aria-label="Main">
          {NAV.map(([to, label]) => <Slab key={label} to={to}>{label}</Slab>)}
        </nav>

        <form onSubmit={search} role="search" className="mt-2">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hoodies, jeans…" aria-label="Search products" className="input" />
        </form>

        <div className="mt-auto flex flex-col gap-2.5 pt-6">
          {user ? (
            <>
              <Slab to="/orders">Orders · {user.name.split(' ')[0]}</Slab>
              <button type="button" className="link-btn self-start" onClick={() => { logout(); navigate('/'); }}>Sign out</button>
            </>
          ) : (
            <Slab to="/login">Sign in ↗</Slab>
          )}
          <p className="font-display text-5xl uppercase leading-none">Threads<sup className="text-lg">®</sup></p>
        </div>
      </aside>
    </>
  );
}
