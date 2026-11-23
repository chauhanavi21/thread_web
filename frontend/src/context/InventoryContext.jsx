import { createContext, useContext, useEffect, useState } from 'react';

const InventoryContext = createContext(0);
export function InventoryProvider({ children }) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1);
    const stream = new EventSource('/api/inventory/events');
    stream.addEventListener('inventory', refresh);
    window.addEventListener('focus', refresh);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stream.close();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return <InventoryContext.Provider value={version}>{children}</InventoryContext.Provider>;
}
export const useInventoryVersion = () => useContext(InventoryContext);
