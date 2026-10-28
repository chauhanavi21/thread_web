import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSite } from './SiteContext.jsx';

const CartContext = createContext(null);
const CART_KEY = 'threads.cart';

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((i) => i && Number.isInteger(i.variantId) && i.qty > 0) : [];
  } catch {
    return [];
  }
}

// Each line is one size/colour variant. It keeps a small snapshot so the bag renders without refetching.
const snapshot = (product, variant) => ({
  productId: product.id,
  variantId: variant.id,
  slug: product.slug,
  image: product.image ?? null,
  name: product.name,
  type: product.type,
  color: variant.color,
  colorHex: variant.colorHex,
  size: variant.size,
  priceCents: product.priceCents,
  stock: variant.stock,
});

export function CartProvider({ children }) {
  // Shipping and quantity rules are set by the admin. The server applies the same rules when the order is placed.
  const { settings } = useSite();
  const { freeShippingOverCents, flatShippingCents, maxQtyPerItem: MAX_QTY } = settings;
  const [lines, setLines] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines]);

  const add = useCallback((product, variant, qty = 1) => {
    setLines((prev) => {
      const limit = Math.min(MAX_QTY, variant.stock);
      const existing = prev.find((l) => l.variantId === variant.id);
      if (existing) {
        return prev.map((l) => (l.variantId === variant.id ? { ...l, ...snapshot(product, variant), qty: Math.min(limit, l.qty + qty) } : l));
      }
      return [...prev, { ...snapshot(product, variant), qty: Math.min(limit, qty) }];
    });
  }, [MAX_QTY]);

  const setQty = useCallback((variantId, qty) => {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.variantId !== variantId) return [l];
        if (qty < 1) return [];
        return [{ ...l, qty: Math.min(qty, MAX_QTY, l.stock) }];
      }),
    );
  }, [MAX_QTY]);

  const remove = useCallback((variantId) => setLines((prev) => prev.filter((l) => l.variantId !== variantId)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotalCents = lines.reduce((n, l) => n + l.qty * l.priceCents, 0);
    const shippingCents = lines.length === 0 || subtotalCents >= freeShippingOverCents ? 0 : flatShippingCents;
    return { lines, count, subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents, freeShippingOverCents, maxQty: MAX_QTY, add, setQty, remove, clear };
  }, [lines, add, setQty, remove, clear, freeShippingOverCents, flatShippingCents, MAX_QTY]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
