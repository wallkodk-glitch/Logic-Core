import { ACTIVITY_TYPES, LEGACY_ACTIVITY_TYPES, PROJECT_STATUSES } from '../domain/types.ts';
import type { Activity, AppData, Project } from '../domain/types.ts';
import { DECISION_LIMITS } from '../domain/decisions.ts';
import { isDecision } from './decision-validation.ts';
import { hasShape, integer, isDate, isId, isRecord, uniqueIds } from './validation.ts';
export { hasShape, isDate, isRecord } from './validation.ts';

export const SCHEMA_VERSION = 2;
export const ACTIVITY_LIMIT = 300;
export const emptyData = (): AppData => ({ schemaVersion: SCHEMA_VERSION, revision: 0, projects: [], activity: [], decisions: [] });

function isProject(value: unknown): value is Project {
  return isRecord(value) && hasShape(value, ['id', 'title', 'description', 'status', 'createdAt', 'updatedAt']) && isId(value.id) && typeof value.title === 'string' &&
    value.title.trim().length > 0 && value.title.length <= 120 &&
    typeof value.description === 'string' && value.description.length <= 10000 &&
    PROJECT_STATUSES.some(status => status === value.status) &&
    isDate(value.createdAt) && isDate(value.updatedAt) && value.updatedAt >= value.createdAt;
}
function isActivity(value: unknown, legacy: boolean): value is Activity {
  return isRecord(value) && hasShape(value, ['id', 'type', 'text', 'createdAt'], legacy ? ['projectId'] : ['projectId', 'decisionId']) &&
    isId(value.id) && (legacy ? LEGACY_ACTIVITY_TYPES : ACTIVITY_TYPES).some(type => type === value.type) &&
    typeof value.text === 'string' && value.text.trim().length > 0 && value.text.length <= 4000 && isDate(value.createdAt) &&
    (value.projectId === undefined || isId(value.projectId)) && (value.decisionId === undefined || isId(value.decisionId)) &&
    // Historical IDs may refer to deleted records, but new decision events need a valid ID.
    (typeof value.type !== 'string' || !value.type.startsWith('decision.') || isId(value.decisionId));
}
function validCore(value: Record<string, unknown>, legacy: boolean): boolean {
  return integer(value.revision, 0, Number.MAX_SAFE_INTEGER) &&
    Array.isArray(value.projects) && value.projects.every(isProject) && uniqueIds(value.projects) &&
    Array.isArray(value.activity) && value.activity.every(item => isActivity(item, legacy)) && uniqueIds(value.activity);
}
function invalidData(): never {
  throw new Error('De gemte data har et ugyldigt format. Eksportér dem fra Diagnostics før gendannelse. Intet er overskrevet.');
}

export function validateData(value: unknown): AppData {
  if (!isRecord(value) || !hasShape(value, ['schemaVersion', 'revision', 'projects', 'activity', 'decisions']) ||
      value.schemaVersion !== SCHEMA_VERSION || !validCore(value, false) ||
      !Array.isArray(value.decisions) || value.decisions.length > DECISION_LIMITS.decisions ||
      !value.decisions.every(isDecision) || !uniqueIds(value.decisions)) invalidData();
  const data = value as unknown as AppData;
  const projects = new Set(data.projects.map(project => project.id));
  if (data.decisions.some(decision => decision.linkedProjectId !== undefined && !projects.has(decision.linkedProjectId))) invalidData();
  return data;
}

// Explicit, deterministic v1 → v2. No guessed/default fields, link cleanup,
// timestamp changes, revision bump, or mutation of the source document.
export function migrateData(value: unknown): AppData {
  if (isRecord(value) && typeof value.schemaVersion === 'number' && value.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Disse data kommer fra en nyere Logic Core. Opdatér appen. Dine data er bevaret.');
  }
  if (isRecord(value) && value.schemaVersion === 1) {
    if (!hasShape(value, ['schemaVersion', 'revision', 'projects', 'activity']) || !validCore(value, true)) invalidData();
    return validateData({ ...structuredClone(value), schemaVersion: 2, decisions: [] });
  }
  return validateData(value);
}

export function readDocument(raw: string | null): { data: AppData; migrated: boolean } {
  if (raw === null) return { data: emptyData(), migrated: false };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('De gemte data kunne ikke læses. Eksportér en kopi i Diagnostics. Intet er overskrevet.'); }
  return { data: migrateData(parsed), migrated: isRecord(parsed) && parsed.schemaVersion === 1 };
}
export function parseData(raw: string | null): AppData { return readDocument(raw).data; }
