import { useSyncExternalStore } from 'react';
import { BASE_URL } from '../config.ts';
import { errorText } from '../utils/format.ts';
import { hasPendingWork } from '../app/pending-work.ts';
import { createUpdateController, UPDATE_MESSAGE } from './update-controller.ts';
import type { ActivationState } from './update-controller.ts';

export type PwaStatus = 'starting' | 'ready' | 'update' | 'unsupported' | 'dev' | 'error';
export interface PwaState { status: PwaStatus; detail: string; activation: ActivationState }
let state: PwaState = { status: 'starting', detail: 'Offline-laget starter…', activation: { phase: 'idle', detail: '' } };
let registration: ServiceWorkerRegistration | null = null;
let activation: ReturnType<typeof createUpdateController> | null = null;
const listeners = new Set<() => void>();
function publish(next: Partial<PwaState>) { state = { ...state, ...next }; listeners.forEach(listener => listener()); }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function usePwa() { return useSyncExternalStore(subscribe, () => state); }
export function activateUpdate(): void { activation?.request(registration?.waiting ?? null); }

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) { publish({ status: 'unsupported', detail: 'Denne browser understøtter ikke service workers.' }); return; }
  if (!import.meta.env.PROD) { publish({ status: 'dev', detail: 'Offline-cache er slået fra på udviklingsserveren. Test produktionsbuildet.' }); return; }
  try {
    const serviceWorker = navigator.serviceWorker;
    const registered = await serviceWorker.register(`${BASE_URL}sw.js`, { scope: BASE_URL, updateViaCache: 'none' });
    registration = registered;
    activation = createUpdateController({
      hasUnsaved: hasPendingWork,
      currentController: () => serviceWorker.controller,
      onControllerChange: listener => { serviceWorker.addEventListener('controllerchange', listener); return () => serviceWorker.removeEventListener('controllerchange', listener); },
      send: (worker, reply) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = event => reply(event.data);
        try { worker.postMessage({ type: UPDATE_MESSAGE }, [channel.port2]); }
        catch (error) { channel.port1.close(); channel.port2.close(); throw error; }
        return () => { channel.port1.close(); channel.port2.close(); };
      },
      after: (delay, callback) => { const timer = window.setTimeout(callback, delay); return () => window.clearTimeout(timer); },
      publish: next => publish({ activation: next }),
      reload: () => window.location.reload(),
    });
    const update = () => {
      if (registered.waiting) publish({ status: 'update', detail: 'Opdatering klar. Gem arbejdet, og vælg Opdatér og genåbn.' });
      else if (registered.active?.state === 'activated') publish({ status: 'ready', detail: 'Offline-app-shell er installeret og aktiv.' });
      else publish({ status: 'starting', detail: 'Henter app-shell til offlinebrug…' });
    };
    function watch(worker: ServiceWorker | null) {
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'redundant' && !registered.active) publish({ status: 'error', detail: 'Offline-installationen fejlede. Prøv igen, når du er online.' });
        else update();
      });
    }
    watch(registered.installing); watch(registered.active);
    registered.addEventListener('updatefound', () => { watch(registered.installing); update(); });
    serviceWorker.addEventListener('controllerchange', update); // Updates status, never reloads.
    update();
    const check = () => { if (navigator.onLine) void registered.update().catch(() => undefined); };
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    check();
  } catch (error) { publish({ status: 'error', detail: `Offline-laget kunne ikke starte: ${errorText(error)}` }); }
}
