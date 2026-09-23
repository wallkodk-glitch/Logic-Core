import { activateUpdate, usePwa } from '../pwa/register.ts';
import { usePendingWork } from '../app/useUnsavedWork.ts';

export function UpdateNotice() {
  const pwa = usePwa();
  const dirty = usePendingWork();
  if (pwa.status !== 'update' && pwa.activation.phase === 'idle') return null;
  const busy = pwa.activation.phase === 'requesting' || pwa.activation.phase === 'reloading';
  return <section className="notice update-notice" aria-label="App-opdatering">
    <div><strong>Opdatering klar</strong><p>{dirty ? 'Gem dine ændringer, før du opdaterer.' : pwa.activation.detail || 'Klar, når du er. Luk først andre Logic Core-vinduer.'}</p></div>
    <button type="button" className="button secondary" disabled={dirty || busy} onClick={activateUpdate}>{busy ? 'Opdaterer…' : 'Opdatér og genåbn'}</button>
  </section>;
}
