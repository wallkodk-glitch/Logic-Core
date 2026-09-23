import { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { StoreProvider } from './storage/context.tsx';
import { registerServiceWorker } from './pwa/register.ts';
import './styles.css';

function Mounted() {
  useLayoutEffect(() => { window.dispatchEvent(new Event('logic-core:mounted')); }, []);
  return null;
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<><Mounted /><ErrorBoundary><StoreProvider><App /></StoreProvider></ErrorBoundary></>);
  void registerServiceWorker();
}
