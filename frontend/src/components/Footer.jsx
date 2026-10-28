import { Link } from 'react-router-dom';
import { money } from '../api.js';
import { useSite } from '../context/SiteContext.jsx';

const LINK = 'block py-1 text-brand-600 transition hover:text-brand-950';

export default function Footer() {
  const { categories, settings } = useSite();
  return (
    <footer className="mt-24 bg-brand-900 text-brand-200">
      <div className="page grid gap-12 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-display text-4xl text-brand-50">Threads<span className="text-accent-400">.</span></p>
          <p className="mt-3 max-w-xs text-sm text-brand-300">Everyday clothing in honest fabrics, made to be worn on repeat.</p>
        </div>
        <nav aria-label="Shop" className="text-sm">
          <p className="eyebrow mb-2 text-brand-400">Shop</p>
          {categories.map((c) => (
            <Link key={c.key} className={`${LINK} !text-brand-200 hover:!text-white`} to={`/shop?category=${c.key}`}>{c.title}</Link>
          ))}
        </nav>
        <nav aria-label="Account" className="text-sm">
          <p className="eyebrow mb-2 text-brand-400">Account</p>
          <Link className={`${LINK} !text-brand-200 hover:!text-white`} to="/orders">My orders</Link>
          <Link className={`${LINK} !text-brand-200 hover:!text-white`} to="/cart">Bag</Link>
          <Link className={`${LINK} !text-brand-200 hover:!text-white`} to="/login">Sign in</Link>
        </nav>
        <div className="text-sm">
          <p className="eyebrow mb-2 text-brand-400">Help</p>
          <p className="py-1">Free shipping over {money(settings.freeShippingOverCents).replace('.00', '')}</p>
          <p className="py-1">30-day returns</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="page py-5 text-xs text-brand-400">© 2026 Threads. {settings.footerNote}</p>
      </div>
    </footer>
  );
}
