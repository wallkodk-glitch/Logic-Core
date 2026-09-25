import { OPPORTUNITY_LIMITS as L } from '../domain/opportunities.ts';
import type { BridgeDocument, BridgeItem, Opportunity, SourceSnapshot } from '../domain/opportunities.ts';
import { canonical, hasShape, isDate, isRecord, isText } from './validation.ts';
import { isBridgeItem, jsonBytes } from './opportunity-validation.ts';

export interface BridgePreview { items: number; created: number; updated: number; unchanged: number; source: string; generatedAt: string }
export interface PreparedBridge { readonly source: string; readonly primaryAtPreview: string | null; readonly preview: BridgePreview }
export function parseBridge(source: string): BridgeDocument {
  if (new TextEncoder().encode(source).byteLength > L.bridgeBytes) throw new Error('Bridge JSON må være højst 128 KiB. Del analysen i mindre importer.');
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new Error('Bridge er ikke gyldig JSON. Intet er importeret.'); }
  if (!isRecord(value) || !hasShape(value, ['format', 'bridgeVersion', 'generatedAt', 'source', 'items']) ||
      value.format !== 'logic-core-opportunity-bridge' || value.bridgeVersion !== 1 || !isDate(value.generatedAt) || !isText(value.source, L.source, true) ||
      !Array.isArray(value.items) || value.items.length < 1 || value.items.length > L.batch) throw new Error('Bridge-formatet kræver version 1, kilde, ISO-dato og 1–20 items.');
  const keys = new Set<string>();
  for (const [index, item] of value.items.entries()) {
    if (!isBridgeItem(item)) throw new Error(`Item ${index + 1} er ugyldigt. Kontrollér felter, datoer, tekstgrænser og http/https-links. Hele importen er afvist.`);
    if (keys.has(item.bridgeKey)) throw new Error(`Item ${index + 1} gentager bridgeKey. Hver nøgle må kun forekomme én gang pr. batch.`);
    keys.add(item.bridgeKey);
    // Use fixed-length metadata to enforce the exact persisted snapshot size before preview.
    makeSourceSnapshot(item, value as unknown as BridgeDocument, '00000000-0000-0000-0000-000000000000', '2000-01-01T00:00:00.000Z');
  }
  return value as unknown as BridgeDocument;
}
export const sourceUnchanged = (opportunity: Opportunity, item: BridgeItem): boolean =>
  opportunity.sourceSnapshots.some(snapshot => canonical(snapshot.payload.analysis) === canonical(item.analysis));
export function previewBridge(document: BridgeDocument, opportunities: readonly Opportunity[]): BridgePreview {
  const preview: BridgePreview = { items: document.items.length, created: 0, updated: 0, unchanged: 0, source: document.source, generatedAt: document.generatedAt };
  for (const item of document.items) {
    const existing = opportunities.find(opportunity => opportunity.bridgeKey === item.bridgeKey);
    if (!existing) preview.created++;
    else if (sourceUnchanged(existing, item)) preview.unchanged++;
    else {
      if (existing.sourceSnapshots.length >= L.snapshots) throw new Error(`“${existing.title}” har allerede 8 kildeversioner. Intet slettes automatisk; hele importen er afvist.`);
      preview.updated++;
    }
  }
  if (opportunities.length + preview.created > L.opportunities) throw new Error('Importen overskrider grænsen på 50 muligheder. Eksportér og ryd op først.');
  return preview;
}
export function makeSourceSnapshot(item: BridgeItem, document: BridgeDocument, id: string, importedAt: string): SourceSnapshot {
  const snapshot: SourceSnapshot = { id, importedAt, sourceLabel: document.source, bridgeGeneratedAt: document.generatedAt,
    generatedAt: item.generatedAt, payload: structuredClone(item), ...(item.sourceRunId !== undefined ? { sourceRunId: item.sourceRunId } : {}) };
  if (jsonBytes(snapshot) > L.snapshotBytes) throw new Error('En kildeversion må være højst 16 KiB. Forkort analysen.');
  return snapshot;
}
