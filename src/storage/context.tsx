import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { AppStore } from './store.ts';
import { STORAGE_KEY } from '../config.ts';

const store = new AppStore(() => window.localStorage, STORAGE_KEY);
const StoreContext = createContext(store);

export function StoreProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === store.key || event.key === store.recoveryKey || event.key === null) store.refresh();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') store.refresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  return { store, ...useSyncExternalStore(store.subscribe, store.getSnapshot) };
}
