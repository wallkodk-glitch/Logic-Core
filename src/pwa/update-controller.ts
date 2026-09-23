export const UPDATE_MESSAGE = 'LOGIC_CORE_ACTIVATE_V1';
export const UPDATE_REPLY = 'LOGIC_CORE_UPDATE_RESULT_V1';
export type ActivationPhase = 'idle' | 'requesting' | 'reloading' | 'blocked' | 'manual' | 'error';
export interface ActivationState { phase: ActivationPhase; detail: string }
export interface UpdateWorker { postMessage(message: unknown, transfer: Transferable[]): void }
export interface UpdateEnvironment {
  hasUnsaved(): boolean;
  currentController(): object | null;
  onControllerChange(listener: () => void): () => void;
  send(worker: UpdateWorker, reply: (data: unknown) => void): () => void;
  after(milliseconds: number, callback: () => void): () => void;
  publish(state: ActivationState): void;
  reload(): void;
}

// A controllerchange alone is never permission to reload. Permission expires on
// timeout/rejection, so a late legacy-worker activation cannot discard later edits.
export function createUpdateController(env: UpdateEnvironment) {
  let pending = false;
  let reloaded = false;
  let generation = 0;
  return {
    request(worker: UpdateWorker | null): void {
      if (pending || reloaded) return;
      if (env.hasUnsaved()) { env.publish({ phase: 'blocked', detail: 'Gem dine ændringer, før du opdaterer.' }); return; }
      if (!worker) { env.publish({ phase: 'manual', detail: 'Ingen ventende opdatering. Prøv igen online, eller luk alle Logic Core-vinduer og åbn appen igen.' }); return; }
      pending = true;
      const requestId = ++generation;
      const current = () => pending && generation === requestId;
      let acknowledged = false;
      const before = env.currentController();
      let unwatch = () => {}; let close = () => {}; let cancel = () => {};
      const cleanup = () => { pending = false; unwatch(); close(); cancel(); };
      const fail = (phase: ActivationPhase, detail: string) => { if (current()) { cleanup(); env.publish({ phase, detail }); } };
      const changed = () => {
        if (!current() || !acknowledged || reloaded || !env.currentController() || env.currentController() === before) return;
        if (env.hasUnsaved()) { fail('blocked', 'Gem arbejdet, og genåbn appen for at bruge opdateringen.'); return; }
        cleanup(); reloaded = true;
        env.publish({ phase: 'reloading', detail: 'Åbner opdateringen…' });
        env.reload();
      };
      env.publish({ phase: 'requesting', detail: 'Aktiverer opdateringen…' });
      unwatch = env.onControllerChange(changed);
      cancel = env.after(8000, () => fail('manual', 'Opdateringen svarede ikke. Gem arbejdet, luk alle Logic Core-vinduer, og åbn igen online. Ingen data er slettet.'));
      try {
        close = env.send(worker, data => {
          if (!current() || typeof data !== 'object' || data === null || !('type' in data) || data.type !== UPDATE_REPLY) return;
          if (!('ok' in data) || data.ok !== true) {
            fail('blocked', 'Luk andre Logic Core-vinduer, og prøv igen. Gem først arbejdet i de andre vinduer.');
          } else { acknowledged = true; changed(); }
        });
      } catch { fail('error', 'Opdateringen kunne ikke aktiveres. Luk alle Logic Core-vinduer, og åbn igen online.'); }
    },
  };
}
