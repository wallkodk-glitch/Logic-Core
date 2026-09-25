import { useUnsavedWork } from '../app/useUnsavedWork.ts';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../storage/context.tsx';
import { APP_VERSION } from '../config.ts';
import { MAX_BACKUP_BYTES } from '../storage/backup.ts';
import type { PreparedRestore } from '../storage/backup.ts';
import { ExportButton } from './ExportButton.tsx';
import { errorText, formatTime } from '../utils/format.ts';

export function DataTools() {
  const { store } = useStore();
  const [prepared, setPrepared] = useState<PreparedRestore | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState('');
  const [reading, setReading] = useState(false);
  const [deleteToken, setDeleteToken] = useState<string | null>(null);
  const generation = useRef(0);
  useUnsavedWork(reading || prepared !== null || deleteToken !== null);
  useEffect(() => () => { generation.current++; }, []);
  const recovery = store.recoveryStatus();

  function cancelPreview() { setPrepared(null); setConfirmed(false); }
  async function choose(file: File | undefined) {
    const request = ++generation.current;
    cancelPreview(); setDeleteToken(null); setNotice('');
    if (!file) { setReading(false); return; }
    setReading(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup-filen må være højst 8 MiB.');
      const source = await file.text();
      if (request !== generation.current) return;
      const result = store.prepareImport(source);
      if (!result.ok) throw new Error(result.error);
      setPrepared(result.value);
    } catch (error) { if (request === generation.current) setNotice(errorText(error)); }
    finally { if (request === generation.current) setReading(false); }
  }
  function previewRecovery() {
    cancelPreview(); setDeleteToken(null); setNotice('');
    const result = store.prepareRecovery();
    if (result.ok) setPrepared(result.value); else setNotice(result.error);
  }
  function restore() {
    if (!prepared || !confirmed) return;
    const result = store.restoreBackup(prepared, APP_VERSION);
    if (result.ok) {
      cancelPreview();
      setNotice(result.value.warning ?? 'Data er gendannet. Det tidligere datasæt er gemt som recovery. Gem også gerne en kopi i Filer.');
    } else setNotice(result.error);
  }
  function removeRecovery() {
    if (deleteToken === null) return;
    const result = store.deleteRecovery(deleteToken);
    setNotice(result.ok ? 'Recovery-snapshot er slettet. Dine nuværende data er bevaret.' : result.error);
    setDeleteToken(null);
  }

  return <div className="data-tools">
    <ExportButton />
    <div className="data-block"><h3>Importér backup</h3><p className="muted">Vælg en Logic Core JSON-fil fra Filer. Du ser indholdets omfang, før noget erstattes.</p><label className="file-label" htmlFor="backup-file">Vælg JSON-fil</label><input id="backup-file" className="backup-file" type="file" accept=".json,application/json" disabled={reading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void choose(file); }} />{reading && <p role="status">Læser og validerer backup…</p>}</div>
    {prepared && <section className="backup-preview" aria-label="Forhåndsvisning af backup"><h3>Kontrollér gendannelsen</h3><dl><div><dt>Backup-format</dt><dd>{prepared.preview.backupVersion === null ? 'Legacy / v0.1' : `v${prepared.preview.backupVersion}`}</dd></div><div><dt>Dataskema</dt><dd>v{prepared.preview.sourceSchemaVersion}{prepared.preview.sourceSchemaVersion !== prepared.preview.schemaVersion ? ` → v${prepared.preview.schemaVersion} ved restore` : ''} </dd></div><div><dt>Projekter</dt><dd>{prepared.preview.projects}</dd></div><div><dt>Beslutninger</dt><dd>{prepared.preview.decisions}</dd></div><div><dt>Muligheder</dt><dd>{prepared.preview.opportunities}</dd></div><div><dt>Aktiviteter</dt><dd>{prepared.preview.activities}</dd></div>{prepared.preview.appVersion && <div><dt>Appversion ved eksport</dt><dd>{prepared.preview.appVersion}</dd></div>}{prepared.preview.exportedAt && <div><dt>Eksporteret</dt><dd>{formatTime(prepared.preview.exportedAt)}</dd></div>}</dl><p><strong>Alle dine nuværende lokale projekter, beslutninger, muligheder, historik og aktiviteter erstattes.</strong> Der oprettes et lokalt recovery-snapshot først. Et tidligere recovery-snapshot bliver erstattet ved en vellykket gendannelse.</p><p className="field-help">Luk andre Logic Core-faner før gendannelse. Brug eksport-knappen ovenfor, hvis du også vil gemme dine nuværende data i Filer.</p><label className="confirmation"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Jeg vil erstatte mine lokale data med denne backup.</span></label><div className="form-actions"><button className="button danger" disabled={!confirmed || reading} onClick={restore}>Gendan og erstat data</button><button className="button secondary" onClick={cancelPreview}>Fortryd</button></div></section>}
    <p className="form-message" role="status">{notice}</p>
    <section className="data-block" aria-label="Recovery-snapshot"><h3>Seneste recovery-snapshot</h3>{recovery.error ? <p className="notice error" role="alert">{recovery.error}</p> : recovery.snapshot ? <p className="muted">Gemt {formatTime(recovery.snapshot.savedAt)} før en gendannelse.</p> : <p className="muted">Intet tidligere snapshot. Det oprettes automatisk, når du gendanner en backup.</p>}{recovery.pending && <p className="notice">Recovery-journalen er bevaret. Genåbn appen for at afslutte den afbrudte handling.</p>}{recovery.exists && <><div className="data-actions"><button className="button secondary" disabled={!recovery.snapshot || !!recovery.error || recovery.pending || reading} onClick={previewRecovery}>Gendan tidligere snapshot</button><ExportButton source="recovery" /></div>{deleteToken !== null ? <div className="delete-confirm"><p><strong>Slet recovery-snapshot permanent?</strong></p><p>Det tidligere datasæt og en eventuel recovery-journal kan ikke gendannes bagefter. Dine nuværende data ændres ikke.</p><div className="form-actions"><button className="button danger" onClick={removeRecovery}>Slet recovery permanent</button><button className="button secondary" onClick={() => setDeleteToken(null)}>Behold snapshot</button></div></div> : <button className="danger-link" onClick={() => { cancelPreview(); setDeleteToken(recovery.token); }}>Slet recovery-snapshot</button>}</>}</section>
  </div>;
}
