import { hasShape, isDate, isRecord, parseData } from './schema.ts';
import type { StoragePort } from './store.ts';

export interface RecoverySnapshot { rawPrimary: string | null; savedAt: string; appVersion: string }
export interface RecoveryRecord {
  recoveryVersion: 1;
  snapshot: RecoverySnapshot | null;
  pending?: { before: string | null; after: string; candidate: RecoverySnapshot };
}
export interface RecoveryStatus {
  exists: boolean;
  token: string | null;
  snapshot: RecoverySnapshot | null;
  pending: boolean;
  error: string | null;
}

function isSnapshot(value: unknown): value is RecoverySnapshot {
  return isRecord(value) && hasShape(value, ['rawPrimary', 'savedAt', 'appVersion']) &&
    (value.rawPrimary === null || typeof value.rawPrimary === 'string') && isDate(value.savedAt) &&
    typeof value.appVersion === 'string' && /^\d+\.\d+\.\d+$/.test(value.appVersion);
}

export function parseRecovery(raw: string | null): RecoveryRecord {
  if (raw === null) return { recoveryVersion: 1, snapshot: null };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('Recovery-snapshot kan ikke læses. Eksportér det før en eventuel sletning.'); }
  if (!isRecord(value) || !hasShape(value, ['recoveryVersion', 'snapshot'], ['pending']) || value.recoveryVersion !== 1 ||
      (value.snapshot !== null && !isSnapshot(value.snapshot))) throw new Error('Recovery-formatet er ugyldigt eller nyere. Originalen er beskyttet.');
  if (value.pending !== undefined) {
    const pending = value.pending;
    if (!isRecord(pending) || !hasShape(pending, ['before', 'after', 'candidate']) ||
        (pending.before !== null && typeof pending.before !== 'string') || typeof pending.after !== 'string' ||
        !isSnapshot(pending.candidate) || pending.candidate.rawPrimary !== pending.before || pending.before === pending.after) {
      throw new Error('Recovery-journalen er ugyldig. Eksportér den, og undgå yderligere ændringer.');
    }
    parseData(pending.after);
  }
  return value as unknown as RecoveryRecord;
}

export function resolveRecovery(record: RecoveryRecord, primary: string | null): RecoverySnapshot | null {
  if (!record.pending) return record.snapshot;
  if (primary === record.pending.after) return record.pending.candidate;
  if (primary === record.pending.before) return record.snapshot;
  throw new Error('Data er ændret under en gendannelse. Recovery-journalen er bevaret. Eksportér data og recovery før flere ændringer.');
}

export function writeRaw(port: StoragePort, key: string, raw: string | null): void {
  if (raw === null) port.removeItem(key); else port.setItem(key, raw);
}

export function settleRecovery(port: StoragePort, primaryKey: string, recoveryKey: string): void {
  const record = parseRecovery(port.getItem(recoveryKey));
  if (!record.pending) return;
  const snapshot = resolveRecovery(record, port.getItem(primaryKey));
  writeRaw(port, recoveryKey, snapshot ? JSON.stringify({ recoveryVersion: 1, snapshot }) : null);
}
