import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../storage/context.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { ExportButton } from '../components/ExportButton.tsx';
import { runDiagnostics } from '../pwa/diagnostics.ts';
import type { Diagnostic } from '../pwa/diagnostics.ts';
import { usePwa } from '../pwa/register.ts';
import { isStandalone, useOnline } from '../app/useDevice.ts';
import { errorText } from '../utils/format.ts';

export function DiagnosticsPage() {
  const { store } = useStore();
  const [rows, setRows] = useState<Diagnostic[]>([]);
  const [running, setRunning] = useState(true);
  const [failure, setFailure] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const online = useOnline();
  const pwa = usePwa();
  const run = useCallback(async () => {
    setRunning(true); setFailure('');
    try {
      setRows(await runDiagnostics(store));
      setCheckedAt(new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }));
    } catch (error) { setFailure(errorText(error)); }
    finally { setRunning(false); }
  }, [store]);
  useEffect(() => { void run(); }, [run]);
  const live: Diagnostic[] = [
    { label: 'Service worker', pass: pwa.status === 'ready' || pwa.status === 'update', detail: pwa.detail },
    { label: 'Online / offline state', pass: true, detail: `${online ? 'Online' : 'Offline'} ifølge browseren. Lokal lagring kræver ikke netværk.` },
  ];
  const allRows = [...rows, ...live];
  const failures = allRows.filter(row => !row.pass).length;
  return <><PageHeader eyebrow="SYSTEM / DIAGNOSTICS" title="Systemcheck" /><div className="diagnostic-summary"><span className={`big-status${failures || failure ? ' warning' : ''}`}>{running ? 'TESTER' : failures || failure ? 'TJEK' : 'PASS'}</span><p>{running ? 'Undersøger kernesystemerne…' : `${allRows.length - failures} / ${allRows.length} checks bestået · ${checkedAt}`}</p><button className="button secondary" disabled={running} onClick={() => { void run(); }}>{running ? 'Tester…' : 'Kør checks igen'}</button></div>{failure && <p className="notice error" role="alert">{failure}</p>}<ul className="diagnostic-list" aria-label="Diagnostikresultater">{allRows.map(row => <li key={row.label}><div className="diagnostic-heading"><h2>{row.label}</h2><span className={`test-status ${row.pass ? 'pass' : 'fail'}`}>{row.pass ? 'PASS' : 'FAIL'}</span></div><p>{row.detail}</p></li>)}</ul><div className="notice"><strong>{isStandalone() ? 'Kører som installeret web-app' : 'Kører i et browservindue'}</strong><p>Checks bruger en separat testnøgle. Ingen projekter eller aktiviteter slettes.</p><p>For at bevise lagring efter lukning: Opret et projekt, luk appen helt, og åbn den igen. Test også åbning i flytilstand, efter service worker viser PASS.</p></div><ExportButton /><a className="text-link" href="#/settings">Import og recovery i Indstillinger</a></>;
}
