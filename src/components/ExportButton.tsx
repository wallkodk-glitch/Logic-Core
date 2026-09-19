import { useState } from 'react';
import { useStore } from '../storage/context.tsx';
import { APP_VERSION } from '../config.ts';
import { Icon } from './Icon.tsx';
import { errorText } from '../utils/format.ts';
import { saveJsonFile } from '../utils/download.ts';

export function ExportButton({ source = 'backup' }: { source?: 'backup' | 'recovery' }) {
  const { store } = useStore();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function exportData() {
    const result = source === 'recovery' ? store.exportRecovery(APP_VERSION) : store.exportData(APP_VERSION);
    if (!result.ok) { setNotice(result.error); return; }
    setBusy(true);
    try {
      setNotice(await saveJsonFile(result.value, source));
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setNotice(`Eksport fejlede: ${errorText(error)}`);
    } finally { setBusy(false); }
  }
  return <div className="export-control"><button className="button secondary" onClick={() => { void exportData(); }} disabled={busy}><Icon name="export" size={18} />{busy ? 'Eksporterer…' : source === 'recovery' ? 'Eksportér recovery' : 'Eksportér data som JSON'}</button><p className="form-message" role="status">{notice}</p></div>;
}
