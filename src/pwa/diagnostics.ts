import { APP_VERSION, BASE_URL } from '../config.ts';
import { SCHEMA_VERSION } from '../storage/schema.ts';
import type { AppStore } from '../storage/store.ts';
import { errorText } from '../utils/format.ts';

export interface Diagnostic { label: string; pass: boolean; detail: string }

export async function runDiagnostics(store: AppStore): Promise<Diagnostic[]> {
  const probe = store.probe();
  const inspection = store.inspect();
  const rows: Diagnostic[] = [
    { label: 'App loaded', pass: true, detail: 'React og app-shell er startet.' },
    { label: 'Storage available', pass: probe.available, detail: probe.available ? 'Browserens lokale lager kan tilgås.' : probe.detail },
    { label: 'Test write / read', pass: probe.roundTrip, detail: probe.detail },
    { label: 'Persistence layer version', pass: inspection.ok && inspection.value.schemaVersion === SCHEMA_VERSION, detail: inspection.ok ? `Schema v${SCHEMA_VERSION} · revision ${inspection.value.revision}` : inspection.error },
    { label: 'Current app version', pass: /^\d+\.\d+\.\d+$/.test(APP_VERSION), detail: `Logic Core v${APP_VERSION}` },
  ];
  try {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) throw new Error('Manifest-link mangler.');
    const response = await fetch(link.href, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Manifest svarede HTTP ${response.status}.`);
    const manifest: unknown = await response.json();
    if (typeof manifest !== 'object' || !manifest || !('display' in manifest) || manifest.display !== 'standalone' || !('start_url' in manifest) || typeof manifest.start_url !== 'string' || !('scope' in manifest) || typeof manifest.scope !== 'string') throw new Error('Manifest er ikke gyldigt til standalone.');
    const expectedScope = new URL(BASE_URL, window.location.origin).href;
    const scope = new URL(manifest.scope, link.href).href;
    const start = new URL(manifest.start_url, link.href).href;
    if (scope !== expectedScope || !start.startsWith(scope)) throw new Error('Manifest scope matcher ikke appens base path.');
    rows.push({ label: 'PWA manifest detected', pass: true, detail: `Standalone · scope ${new URL(scope).pathname}` });
  } catch (error) { rows.push({ label: 'PWA manifest detected', pass: false, detail: errorText(error) }); }
  return rows;
}
