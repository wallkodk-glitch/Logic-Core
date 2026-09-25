import { ACTIVITY_TYPES, V2_ACTIVITY_TYPES, LEGACY_ACTIVITY_TYPES, PROJECT_STATUSES } from '../domain/types.ts';
import type { Activity, AppData, Project } from '../domain/types.ts';
import { DECISION_LIMITS } from '../domain/decisions.ts';
import { isDecision } from './decision-validation.ts';
import { hasShape, integer, isDate, isId, isRecord, uniqueIds } from './validation.ts';
import { OPPORTUNITY_LIMITS } from '../domain/opportunities.ts';
import { isOpportunity, jsonBytes } from './opportunity-validation.ts';
export { hasShape, isDate, isRecord } from './validation.ts';

export const SCHEMA_VERSION = 3;
export const ACTIVITY_LIMIT = 300;
export const emptyData = (): AppData => ({ schemaVersion: SCHEMA_VERSION, revision: 0, projects: [], activity: [], decisions: [], opportunities: [] });

function isProject(value: unknown): value is Project {
  return isRecord(value) && hasShape(value, ['id', 'title', 'description', 'status', 'createdAt', 'updatedAt']) && isId(value.id) && typeof value.title === 'string' &&
    value.title.trim().length > 0 && value.title.length <= 120 &&
    typeof value.description === 'string' && value.description.length <= 10000 &&
    PROJECT_STATUSES.some(status => status === value.status) &&
    isDate(value.createdAt) && isDate(value.updatedAt) && value.updatedAt >= value.createdAt;
}
function isActivity(value: unknown, version: number): value is Activity {
  return isRecord(value) && hasShape(value, ['id', 'type', 'text', 'createdAt'], version === 1 ? ['projectId'] : version === 2 ? ['projectId', 'decisionId'] : ['projectId', 'decisionId', 'opportunityId']) &&
    isId(value.id) && (version === 1 ? LEGACY_ACTIVITY_TYPES : version === 2 ? V2_ACTIVITY_TYPES : ACTIVITY_TYPES).some(type => type === value.type) &&
    typeof value.text === 'string' && value.text.trim().length > 0 && value.text.length <= 4000 && isDate(value.createdAt) &&
    (value.projectId === undefined || isId(value.projectId)) && (value.decisionId === undefined || isId(value.decisionId)) &&
    // Historical IDs may refer to deleted records, but new decision events need a valid ID.
    (typeof value.type !== 'string' || !value.type.startsWith('decision.') || isId(value.decisionId)) &&
    (value.opportunityId === undefined || isId(value.opportunityId)) &&
    (typeof value.type !== 'string' || !value.type.startsWith('opportunity.') || isId(value.opportunityId));
}
function validCore(value: Record<string, unknown>, version: number): boolean {
  return integer(value.revision, 0, Number.MAX_SAFE_INTEGER) &&
    Array.isArray(value.projects) && value.projects.every(isProject) && uniqueIds(value.projects) &&
    Array.isArray(value.activity) && value.activity.every(item => isActivity(item, version)) && uniqueIds(value.activity);
}
function invalidData(): never {
  throw new Error('De gemte data har et ugyldigt format. Eksportér dem fra Diagnostics før gendannelse. Intet er overskrevet.');
}

export function validateData(value: unknown): AppData {
  if (!isRecord(value) || !hasShape(value, ['schemaVersion', 'revision', 'projects', 'activity', 'decisions', 'opportunities']) ||
      value.schemaVersion !== SCHEMA_VERSION || !validCore(value, 3) ||
      !Array.isArray(value.decisions) || value.decisions.length > DECISION_LIMITS.decisions ||
      !value.decisions.every(isDecision) || !uniqueIds(value.decisions) ||
      !Array.isArray(value.opportunities) || value.opportunities.length > OPPORTUNITY_LIMITS.opportunities ||
      !value.opportunities.every(isOpportunity) || !uniqueIds(value.opportunities) || jsonBytes(value.opportunities) > OPPORTUNITY_LIMITS.collectionBytes) invalidData();
  const data = value as unknown as AppData;
  const projects = new Set(data.projects.map(project => project.id));
  if (data.decisions.some(decision => decision.linkedProjectId !== undefined && !projects.has(decision.linkedProjectId))) invalidData();
  const decisions = new Set(data.decisions.map(decision => decision.id));
  const bridgeKeys = new Set<string>();
  for (const opportunity of data.opportunities) {
    if (opportunity.linkedProjectIds.some(id => !projects.has(id)) || opportunity.linkedDecisionIds.some(id => !decisions.has(id))) invalidData();
    if (opportunity.bridgeKey !== undefined) {
      if (bridgeKeys.has(opportunity.bridgeKey)) invalidData();
      bridgeKeys.add(opportunity.bridgeKey);
    }
  }
  return data;
}

// Explicit, deterministic v1 → v2 → v3. No guessed/default fields, link cleanup,
// timestamp changes, revision bump, or mutation of the source document.
export function migrateData(value: unknown): AppData {
  if (isRecord(value) && typeof value.schemaVersion === 'number' && value.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Disse data kommer fra en nyere Logic Core. Opdatér appen. Dine data er bevaret.');
  }
  if (isRecord(value) && value.schemaVersion === 1) {
    if (!hasShape(value, ['schemaVersion', 'revision', 'projects', 'activity']) || !validCore(value, 1)) invalidData();
    return migrateData({ ...structuredClone(value), schemaVersion: 2, decisions: [] });
  }
  if (isRecord(value) && value.schemaVersion === 2) {
    if (!hasShape(value, ['schemaVersion', 'revision', 'projects', 'activity', 'decisions']) || !validCore(value, 2)) invalidData();
    return validateData({ ...structuredClone(value), schemaVersion: 3, opportunities: [] });
  }
  return validateData(value);
}

export function readDocument(raw: string | null): { data: AppData; migrated: boolean } {
  if (raw === null) return { data: emptyData(), migrated: false };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('De gemte data kunne ikke læses. Eksportér en kopi i Diagnostics. Intet er overskrevet.'); }
  return { data: migrateData(parsed), migrated: isRecord(parsed) && (parsed.schemaVersion === 1 || parsed.schemaVersion === 2) };
}
export function parseData(raw: string | null): AppData { return readDocument(raw).data; }
