import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const SiteContext = createContext(null);

// Used until /api/site answers (or if it fails), so the storefront never renders with holes in it.
const FALLBACK = {
  categories: [],
  settings: {
    announcement: '',
    heroEyebrow: '',
    heroTitle: '',
    heroText: '',
    bannerTitle: '',
    bannerText: '',
    perks: [],
    footerNote: '',
    freeShippingOverCents: 10000,
    flatShippingCents: 699,
    maxQtyPerItem: 10,
  },
  heroProduct: null,
  bannerProduct: null,
};

/** Categories, copy and shipping rules that the admin controls. `refresh()` re-reads them after an admin edit. */
export function SiteProvider({ children }) {
  const [site, setSite] = useState(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(
    () =>
      api
        .site()
        .then(setSite)
        .catch(() => {})
        .finally(() => setLoaded(true)),
    [],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ ...site, loaded, refresh }), [site, loaded, refresh]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);

/** Renders "Clothes made to be *worn* on repeat" with the starred words in <em>. */
export function accent(text, emClass = '') {
  return String(text ?? '')
    .split(/\*(.+?)\*/g)
    .map((part, i) => (i % 2 ? <em key={i} className={emClass}>{part}</em> : part));
}
