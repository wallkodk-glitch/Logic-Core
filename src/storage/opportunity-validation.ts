import { EVALUATION_FIELDS, OPPORTUNITY_LIMITS as L, OPPORTUNITY_STATUSES } from '../domain/opportunities.ts';
import type { BridgeItem, Opportunity, OpportunityAnalysis, OpportunityInput, SourceSnapshot } from '../domain/opportunities.ts';
import { canonical, hasShape, integer, isDate, isId, isRecord, isText, uniqueIds } from './validation.ts';

export const jsonBytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength;
export const isBridgeKey = (value: unknown): value is string => isId(value) && /^[a-z0-9][a-z0-9:._-]*$/.test(value);
const strings = (value: unknown, count: number, length: number): value is string[] =>
  Array.isArray(value) && value.length <= count && value.every(item => isText(item, length, true));
const refs = (value: unknown): value is string[] => Array.isArray(value) && value.length <= L.links && value.every(isId) && new Set(value).size === value.length;
function safeUrl(value: unknown): value is string {
  if (!isText(value, L.url, true) || value !== value.trim() || /[\u0000-\u0020\u007f]/.test(value)) return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}
export function isAnalysis(value: unknown): value is OpportunityAnalysis {
  return isRecord(value) && hasShape(value, ['title', 'domain', 'summary', 'thesis', 'evidence', 'whyNow', 'upside', 'downside', 'constraints', 'assumptions', 'unknowns', 'nextTest', 'sourceLinks']) &&
    isText(value.title, L.title, true) && isText(value.domain, L.domain, true) &&
    ['summary', 'thesis', 'whyNow', 'upside', 'downside', 'nextTest'].every(field => isText(value[field], L.text, field === 'summary')) &&
    ['evidence', 'constraints', 'assumptions', 'unknowns'].every(field => strings(value[field], L.list, L.listText)) &&
    Array.isArray(value.sourceLinks) && value.sourceLinks.length <= L.list && value.sourceLinks.every(safeUrl) && new Set(value.sourceLinks).size === value.sourceLinks.length;
}
export function isBridgeItem(value: unknown): value is BridgeItem {
  return isRecord(value) && hasShape(value, ['bridgeKey', 'generatedAt', 'analysis'], ['sourceRunId']) &&
    isBridgeKey(value.bridgeKey) && isDate(value.generatedAt) && (value.sourceRunId === undefined || isId(value.sourceRunId)) && isAnalysis(value.analysis);
}
const inputFields = ['title', 'domain', 'tags', 'status', 'notes', 'evaluation', 'nextAction', 'linkedProjectIds', 'linkedDecisionIds'];
function validWorkspace(value: Record<string, unknown>): boolean {
  return isText(value.title, L.title, true) && isText(value.domain, L.domain, true) && isText(value.notes, L.notes) && isText(value.nextAction, L.text) &&
    OPPORTUNITY_STATUSES.some(status => value.status === status) && (value.reviewAt === undefined || isDate(value.reviewAt)) &&
    strings(value.tags, L.tags, L.tag) && new Set(value.tags).size === value.tags.length && value.tags.every(tag => tag === tag.trim()) &&
    isRecord(value.evaluation) && hasShape(value.evaluation, [], EVALUATION_FIELDS) && Object.values(value.evaluation).every(score => integer(score, 1, 5)) &&
    refs(value.linkedProjectIds) && refs(value.linkedDecisionIds);
}
export function validateOpportunityInput(value: unknown): OpportunityInput {
  if (!isRecord(value) || !hasShape(value, inputFields, ['reviewAt']) || !validWorkspace(value)) {
    throw new Error('Mulighedens felter er ugyldige. Kontrollér titel, domæne, grænser, unikke links og scores på 1–5.');
  }
  return value as unknown as OpportunityInput;
}
function isSnapshot(value: unknown): value is SourceSnapshot {
  return isRecord(value) && hasShape(value, ['id', 'importedAt', 'sourceLabel', 'bridgeGeneratedAt', 'generatedAt', 'payload'], ['sourceRunId']) &&
    isId(value.id) && isDate(value.importedAt) && isDate(value.bridgeGeneratedAt) && isDate(value.generatedAt) && isText(value.sourceLabel, L.source, true) &&
    (value.sourceRunId === undefined || isId(value.sourceRunId)) && isBridgeItem(value.payload) &&
    value.payload.generatedAt === value.generatedAt && value.payload.sourceRunId === value.sourceRunId && jsonBytes(value) <= L.snapshotBytes;
}
export function isOpportunity(value: unknown): value is Opportunity {
  if (!isRecord(value) || !hasShape(value, [...inputFields, 'id', 'sourceSnapshots', 'createdAt', 'updatedAt'], ['reviewAt', 'bridgeKey']) ||
      !validWorkspace(value) || !isId(value.id) || value.id === 'new' || value.id === 'import' ||
      !isDate(value.createdAt) || !isDate(value.updatedAt) || value.updatedAt < value.createdAt ||
      !Array.isArray(value.sourceSnapshots) || value.sourceSnapshots.length > L.snapshots || !value.sourceSnapshots.every(isSnapshot) || !uniqueIds(value.sourceSnapshots)) return false;
  if (value.bridgeKey === undefined) return value.sourceSnapshots.length === 0;
  if (!isBridgeKey(value.bridgeKey) || value.sourceSnapshots.length === 0) return false;
  let previous = '';
  const payloads = new Set<string>();
  for (const snapshot of value.sourceSnapshots) {
    const payload = canonical(snapshot.payload.analysis);
    if (snapshot.payload.bridgeKey !== value.bridgeKey || snapshot.importedAt < value.createdAt || snapshot.importedAt > value.updatedAt ||
        snapshot.importedAt <= previous || payloads.has(payload)) return false;
    previous = snapshot.importedAt; payloads.add(payload);
  }
  return true;
}
