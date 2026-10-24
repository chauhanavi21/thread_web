import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const CART_KEY = 'threads.cart';
export const MAX_QTY = 10;
export const FREE_SHIPPING_OVER_CENTS = 10000;
export const FLAT_SHIPPING_CENTS = 699;

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
  name: product.name,
  type: product.type,
  color: variant.color,
  colorHex: variant.colorHex,
  size: variant.size,
  priceCents: product.priceCents,
  stock: variant.stock,
});

export function CartProvider({ children }) {
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
  }, []);

  const setQty = useCallback((variantId, qty) => {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.variantId !== variantId) return [l];
        if (qty < 1) return [];
        return [{ ...l, qty: Math.min(qty, MAX_QTY, l.stock) }];
      }),
    );
  }, []);

  const remove = useCallback((variantId) => setLines((prev) => prev.filter((l) => l.variantId !== variantId)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotalCents = lines.reduce((n, l) => n + l.qty * l.priceCents, 0);
    const shippingCents = lines.length === 0 || subtotalCents >= FREE_SHIPPING_OVER_CENTS ? 0 : FLAT_SHIPPING_CENTS;
    return { lines, count, subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents, add, setQty, remove, clear };
  }, [lines, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
