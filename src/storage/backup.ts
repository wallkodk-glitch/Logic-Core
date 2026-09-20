import type { AppData } from '../domain/types.ts';
import { hasShape, isDate, isRecord, migrateData, parseData } from './schema.ts';

export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

export interface BackupPreview {
  backupVersion: number | null;
  schemaVersion: number;
  sourceSchemaVersion: 1 | 2;
  projects: number;
  activities: number;
  decisions: number;
  appVersion: string | null;
  exportedAt: string | null;
}

export interface ParsedBackup { data: AppData; preview: BackupPreview }
export interface PreparedRestore {
  readonly source: string;
  readonly primaryAtPreview: string | null;
  readonly recoveryAtPreview: string | null;
  readonly preview: BackupPreview;
}

export function parseBackup(text: string): ParsedBackup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error('Backup-filen må være højst 8 MiB.');
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new Error('Filen er ikke gyldig JSON. Ingen data er ændret.'); }
  if (!isRecord(value)) throw new Error('Backup skal være et helt JSON-dokument.');
  let appVersion: string | null = null;
  let exportedAt: string | null = null;
  let backupVersion: number | null = null;
  let data: AppData;
  let sourceSchemaVersion: 1 | 2;
  if (Object.hasOwn(value, 'schemaVersion')) {
    data = migrateData(value);
    sourceSchemaVersion = value.schemaVersion === 1 ? 1 : 2;
  } else {
    if (!hasShape(value, ['data'], ['backupVersion', 'app', 'appVersion', 'exportedAt', 'storageKey'])) {
      throw new Error('Ukendt eller ufuldstændigt backup-format. Rå fejl-eksporter kan ikke gendannes direkte.');
    }
    if (value.backupVersion !== undefined && value.backupVersion !== BACKUP_VERSION) throw new Error('Backup-versionen understøttes ikke.');
    if (value.app !== undefined && value.app !== 'Logic Core') throw new Error('Backup kommer ikke fra Logic Core.');
    if (value.appVersion !== undefined && (typeof value.appVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(value.appVersion))) throw new Error('Ugyldig appversion i backup.');
    if (value.exportedAt !== undefined && !isDate(value.exportedAt)) throw new Error('Ugyldigt eksporttidspunkt.');
    if (value.storageKey !== undefined && (typeof value.storageKey !== 'string' || value.storageKey.length > 1024)) throw new Error('Ugyldig storage-metadata.');
    data = migrateData(value.data);
    sourceSchemaVersion = isRecord(value.data) && value.data.schemaVersion === 1 ? 1 : 2;
    appVersion = typeof value.appVersion === 'string' ? value.appVersion : null;
    exportedAt = typeof value.exportedAt === 'string' ? value.exportedAt : null;
    backupVersion = typeof value.backupVersion === 'number' ? value.backupVersion : null;
  }
  return { data, preview: { backupVersion, schemaVersion: data.schemaVersion, sourceSchemaVersion, projects: data.projects.length, activities: data.activity.length, decisions: data.decisions.length, appVersion, exportedAt } };
}

export function serializeBackup(raw: string | null, appVersion: string, storageKey: string, preserveSourceSchema = false): string {
  const metadata = { app: 'Logic Core', backupVersion: BACKUP_VERSION, appVersion, exportedAt: new Date().toISOString(), storageKey };
  try {
    const data = parseData(raw); // Validate/migrate before any serialization.
    // Internal recovery preview may retain v1 to explain the pending migration.
    return JSON.stringify({ ...metadata, data: preserveSourceSchema && raw !== null ? JSON.parse(raw) as unknown : data }, null, 2);
  }
  catch { return JSON.stringify({ ...metadata, recovery: true, rawData: raw }, null, 2); }
}
