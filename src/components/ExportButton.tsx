import { useState } from 'react';
import { useStore } from '../storage/context.tsx';
import { APP_VERSION } from '../config.ts';
import { Icon } from './Icon.tsx';
import { errorText } from '../utils/format.ts';

export function ExportButton() {
  const { store } = useStore();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function exportData() {
    const result = store.exportData(APP_VERSION);
    if (!result.ok) { setNotice(result.error); return; }
    setBusy(true);
    try {
      const filename = `logic-core-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const file = new File([result.value], filename, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Logic Core · dataeksport' });
        setNotice('Eksporten er sendt til den valgte app.');
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.append(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        setNotice('JSON-eksporten er klar. Gem den i Filer / Downloads.');
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setNotice(`Eksport fejlede: ${errorText(error)}`);
    } finally { setBusy(false); }
  }
  return <div className="export-control"><button className="button secondary" onClick={() => { void exportData(); }} disabled={busy}><Icon name="export" size={18} />{busy ? 'Eksporterer…' : 'Eksportér data som JSON'}</button><p className="form-message" role="status">{notice}</p></div>;
}
