import { useSyncExternalStore } from 'react';
import { BASE_URL } from '../config.ts';
import { errorText } from '../utils/format.ts';

export type PwaStatus = 'starting' | 'ready' | 'update' | 'unsupported' | 'dev' | 'error';
export interface PwaState { status: PwaStatus; detail: string }
let state: PwaState = { status: 'starting', detail: 'Offline-laget starter…' };
const listeners = new Set<() => void>();
function publish(next: PwaState) { state = next; listeners.forEach(listener => listener()); }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function usePwa() { return useSyncExternalStore(subscribe, () => state); }

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) { publish({ status: 'unsupported', detail: 'Denne browser understøtter ikke service workers.' }); return; }
  if (!import.meta.env.PROD) { publish({ status: 'dev', detail: 'Offline-cache er slået fra på udviklingsserveren. Test produktionsbuildet.' }); return; }
  try {
    const registration = await navigator.serviceWorker.register(`${BASE_URL}sw.js`, { scope: BASE_URL, updateViaCache: 'none' });
    const update = () => {
      if (registration.waiting) publish({ status: 'update', detail: 'Opdatering klar. Gem arbejdet, luk alle app-vinduer, og åbn igen.' });
      else if (registration.active?.state === 'activated') publish({ status: 'ready', detail: 'Offline-app-shell er installeret og aktiv.' });
      else publish({ status: 'starting', detail: 'Henter app-shell til offlinebrug…' });
    };
    function watch(worker: ServiceWorker | null) {
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'redundant' && !registration.active) publish({ status: 'error', detail: 'Offline-installationen fejlede. Prøv igen, når du er online.' });
        else update();
      });
    }
    watch(registration.installing);
    watch(registration.active);
    registration.addEventListener('updatefound', () => { watch(registration.installing); update(); });
    navigator.serviceWorker.addEventListener('controllerchange', update);
    update();
    // Update checks must never block loading or erase the current offline cache.
    const check = () => { void registration.update().catch(() => undefined); };
    window.addEventListener('online', check);
    if (navigator.onLine) check();
  } catch (error) { publish({ status: 'error', detail: `Offline-laget kunne ikke starte: ${errorText(error)}` }); }
}
