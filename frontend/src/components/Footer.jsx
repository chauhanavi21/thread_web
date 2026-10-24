import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';

const LINK = 'block font-bold uppercase transition hover:underline';

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-brand-400 bg-brand-50">
      <div className="page grid gap-10 py-12 md:grid-cols-2">
        <div className="flex flex-col justify-between gap-10">
          <div className="flex justify-between text-sm">
            <span>Collection archive</span>
            <span>Edition 026</span>
          </div>
          <nav className="self-end text-right text-sm" aria-label="Footer">
            <Link className={LINK} to="/shop?category=women">Women</Link>
            <Link className={LINK} to="/shop?category=men">Men</Link>
            <Link className={LINK} to="/shop?category=accessories">Accessories</Link>
            <Link className={LINK} to="/orders">My orders</Link>
          </nav>
          <div className="flex items-end justify-between gap-6">
            <div className="hidden w-40 sm:block"><ProductImage type="jackets" color="#3b3f45" name="" bg="bg-brand-200" /></div>
            <p className="text-sm">© 2026 Threads. Demo store: no real payments are taken.</p>
          </div>
        </div>
        <div className="hidden md:block">
          <ProductImage type="hoodies" color="#6b6b3a" name="" bg="bg-brand-200" />
        </div>
      </div>
    </footer>
  );
}
