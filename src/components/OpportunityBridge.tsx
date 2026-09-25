import { useEffect, useRef, useState } from 'react';
import { useStore } from '../storage/context.tsx';
import { useUnsavedWork } from '../app/useUnsavedWork.ts';
import { OPPORTUNITY_LIMITS } from '../domain/opportunities.ts';
import type { PreparedBridge } from '../storage/opportunity-bridge.ts';
import { errorText, formatTime } from '../utils/format.ts';
import { BASE_URL } from '../config.ts';

export function OpportunityBridge() {
  const { store } = useStore();
  const [source, setSource] = useState(''); const [prepared, setPrepared] = useState<PreparedBridge | null>(null);
  const [confirmed, setConfirmed] = useState(false); const [reading, setReading] = useState(false); const [notice, setNotice] = useState('');
  const generation = useRef(0);
  useUnsavedWork(!!source || reading || prepared !== null);
  useEffect(() => () => { generation.current++; }, []);
  function resetPreview() { setPrepared(null); setConfirmed(false); }
  function preview(text = source) {
    resetPreview(); setNotice('');
    const result = store.prepareBridge(text);
    if (result.ok) setPrepared(result.value); else setNotice(result.error);
  }
  async function choose(file: File | undefined) {
    const request = ++generation.current; resetPreview(); setNotice('');
    if (!file) { setReading(false); return; }
    setReading(true);
    try {
      if (file.size > OPPORTUNITY_LIMITS.bridgeBytes) throw new Error('Bridge-filen må være højst 128 KiB.');
      const text = await file.text();
      if (request !== generation.current) return;
      setSource(text); preview(text);
    } catch (error) { if (request === generation.current) setNotice(errorText(error)); }
    finally { if (request === generation.current) setReading(false); }
  }
  function commit() {
    if (!prepared || !confirmed || reading) return;
    const result = store.importBridge(prepared, confirmed);
    if (!result.ok) { setNotice(result.error); return; }
    const p = result.value;
    setSource(''); resetPreview();
    setNotice(`${p.created} nye muligheder · ${p.updated} nye kildeversioner · ${p.unchanged} uændrede. Dine lokale felter er bevaret.`);
  }
  return <div className="opportunity-bridge">
    <p className="muted">Indsæt JSON fra ChatGPT / Logic Hunter, eller vælg den i Filer. Importen behandles kun på denne enhed.</p>
    <div className="project-form"><label htmlFor="bridge-json">Opportunity Bridge JSON</label><textarea id="bridge-json" rows={8} spellCheck={false} autoCapitalize="off" autoCorrect="off" maxLength={OPPORTUNITY_LIMITS.bridgeBytes} disabled={reading} value={source} onChange={event => { setSource(event.target.value); resetPreview(); setNotice(''); }} placeholder='{"format":"logic-core-opportunity-bridge", …}' /></div>
    <label className="file-label" htmlFor="bridge-file">Eller vælg en JSON-fil</label><input id="bridge-file" type="file" className="backup-file" accept=".json,application/json" disabled={reading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void choose(file); }} />
    <div className="form-actions"><button className="button secondary" disabled={reading || !source.trim()} onClick={() => preview()}>Kontrollér import</button>{(source || prepared) && <button className="button secondary" disabled={reading} onClick={() => { setSource(''); resetPreview(); setNotice(''); }}>Ryd import</button>}</div>
    {reading && <p role="status">Læser og validerer…</p>}
    {prepared && <section className="backup-preview" aria-label="Forhåndsvisning af Opportunity-import"><h2>Kontrollér mulighederne</h2>
      <dl><div><dt>Kilde</dt><dd>{prepared.preview.source}</dd></div><div><dt>Genereret</dt><dd>{formatTime(prepared.preview.generatedAt)}</dd></div><div><dt>Items</dt><dd>{prepared.preview.items}</dd></div><div><dt>Nye muligheder</dt><dd>{prepared.preview.created}</dd></div><div><dt>Nye kildeversioner</dt><dd>{prepared.preview.updated}</dd></div><div><dt>Allerede importeret</dt><dd>{prepared.preview.unchanged}</dd></div></dl>
      <p>Hele batchen er valideret. Eksisterende lokale titler, noter, vurderinger, status og links bevares. Uændrede analyser giver ingen ekstra kildeversion.</p>
      <label className="confirmation"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Jeg vil importere disse muligheder og kildeversioner.</span></label>
      <button className="button bridge-confirm" disabled={!confirmed || reading} onClick={commit}>Bekræft import</button>
    </section>}
    <p className="form-message" role="status">{notice}</p>
    <details className="decision-section"><summary>Sådan får du et gyldigt AI-output</summary>
      <a className="text-link" href={`${BASE_URL}opportunity-bridge-example.json`} download="opportunity-bridge-example.json">Hent et komplet JSON-eksempel</a>
      <p className="field-help">Bed om Logic Core Opportunity Bridge v1 som ren JSON, med alle obligatoriske felter, stabile bridgeKeys og ISO-datoer med millisekunder i UTC. Højst 20 items, 128 KiB pr. fil og 16 KiB pr. kildeversion. Format og et komplet eksempel følger med i release-pakkens docs/OPPORTUNITY_BRIDGE.md.</p>
      <p className="field-help">Appen kontakter aldrig en AI-tjeneste. Kildetekst er en importeret analyse, ikke verificerede fakta eller en automatisk anbefaling.</p>
    </details>
  </div>;
}
