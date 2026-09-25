import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AppStore } from '../src/storage/store.ts';
import type { StoragePort } from '../src/storage/store.ts';
import { MAX_BACKUP_BYTES, parseBackup } from '../src/storage/backup.ts';
import { parseRecovery } from '../src/storage/recovery.ts';
import { migrateData } from '../src/storage/schema.ts';

const key = 'logic-core:/Logic-Core/:data';
const recoveryKey = `${key}:recovery`;
const legacyRaw = readFileSync('tests/fixtures/v0.1-primary.json', 'utf8');
const legacyBackup = readFileSync('tests/fixtures/v0.1-backup.json', 'utf8');
const migratedLegacy = migrateData(JSON.parse(legacyRaw));
const migratedRaw = JSON.stringify(migratedLegacy);
const incomingData = structuredClone(migratedLegacy);
incomingData.projects[0]!.title = 'Imported project';
const incoming = JSON.stringify({ app: 'Logic Core', appVersion: '0.1.1', backupVersion: 1, data: incomingData });

class FaultStorage implements StoragePort {
  items = new Map<string, string>();
  writes = new Map<string, number>();
  fail: ((key: string, count: number) => boolean) | null = null;
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) {
    const count = (this.writes.get(key) ?? 0) + 1; this.writes.set(key, count);
    if (this.fail?.(key, count)) throw new DOMException('full', 'QuotaExceededError');
    this.items.set(key, value);
  }
  removeItem(key: string) {
    if (this.fail?.(key, -1)) throw new DOMException('denied', 'SecurityError');
    this.items.delete(key);
  }
}
function fixture() {
  const port = new FaultStorage(); port.setItem(key, legacyRaw);
  const store = new AppStore(() => port, key);
  return { port, store };
}
function prepare(store: AppStore, source = incoming) {
  const result = store.prepareImport(source); assert(result.ok, result.ok ? '' : result.error); return result.value;
}
function restore(store: AppStore, source = incoming) {
  const result = store.restoreBackup(prepare(store, source), '0.1.1'); assert(result.ok, result.ok ? '' : result.error); return result.value;
}

test('v0.1 primary migrates at boot without changing projects, activities or revision', () => {
  const { store, port } = fixture();
  assert.equal(store.getSnapshot().error, null);
  assert.deepEqual(store.getSnapshot().data, migratedLegacy);
  assert.equal(port.getItem(key), migratedRaw);
  assert.equal(port.getItem(recoveryKey), null);
  assert.equal(store.getSnapshot().data.schemaVersion, 3);
});
test('v0.1 JSON export and raw schema v1 both remain import-compatible', () => {
  assert.deepEqual(parseBackup(legacyBackup).data, migratedLegacy);
  assert.deepEqual(parseBackup(legacyRaw).data, migratedLegacy);
  assert.equal(parseBackup(legacyBackup).preview.appVersion, '0.1.0');
});
test('valid export previews counts/metadata without writing and restores the entire document', () => {
  const { store, port } = fixture(); const before = [...port.items];
  const preview = prepare(store);
  assert.equal(preview.preview.projects, 1); assert.equal(preview.preview.activities, 2);
  assert.equal(preview.preview.schemaVersion, 3); assert.equal(preview.preview.backupVersion, 1);
  assert.deepEqual([...port.items], before);
  assert(store.restoreBackup(preview, '0.1.1').ok);
  assert.deepEqual(store.getSnapshot().data, incomingData);
  assert.deepEqual(new AppStore(() => port, key).getSnapshot().data, incomingData);
});

const invalid: [string, () => string][] = [
  ['malformed JSON', () => '{"data":'],
  ['null document', () => 'null'],
  ['array document', () => '[]'],
  ['wrong envelope', () => '{"projects":[]}'],
  ['partial document', () => JSON.stringify({ ...incomingData, activity: undefined })],
  ['wrong array shape', () => JSON.stringify({ ...incomingData, projects: {} })],
  ['invalid project', () => JSON.stringify({ ...incomingData, projects: [{ title: 'partial' }] })],
  ['invalid activity', () => JSON.stringify({ ...incomingData, activity: [{ ...incomingData.activity[0], type: 'unknown' }] })],
  ['invalid status', () => JSON.stringify({ ...incomingData, projects: [{ ...incomingData.projects[0], status: 'published' }] })],
  ['numeric ID', () => JSON.stringify({ ...incomingData, projects: [{ ...incomingData.projects[0], id: 42 }] })],
  ['blank ID', () => JSON.stringify({ ...incomingData, projects: [{ ...incomingData.projects[0], id: '  ' }] })],
  ['duplicate IDs', () => JSON.stringify({ ...incomingData, projects: [incomingData.projects[0], incomingData.projects[0]] })],
  ['invalid timestamp', () => JSON.stringify({ ...incomingData, activity: [{ ...incomingData.activity[0], createdAt: 'yesterday' }] })],
  ['rollover timestamp', () => JSON.stringify({ ...incomingData, activity: [{ ...incomingData.activity[0], createdAt: '2026-02-30T12:00:00.000Z' }] })],
  ['reversed project timestamps', () => JSON.stringify({ ...incomingData, projects: [{ ...incomingData.projects[0], updatedAt: '2000-01-01T00:00:00.000Z' }] })],
  ['negative revision', () => JSON.stringify({ ...incomingData, revision: -1 })],
  ['future schema', () => JSON.stringify({ ...incomingData, schemaVersion: 4 })],
  ['future backup format', () => JSON.stringify({ backupVersion: 2, data: incomingData })],
  ['unknown object fields', () => JSON.stringify({ ...incomingData, extra: true })],
  ['wrong metadata type', () => JSON.stringify({ data: incomingData, appVersion: 42 })],
  ['partial export metadata', () => JSON.stringify({ data: incomingData, exportedAt: 'invalid' })],
  ['emergency raw export', () => JSON.stringify({ app: 'Logic Core', recovery: true, rawData: '{broken' })],
];
for (const [name, source] of invalid) {
  test(`import rejects ${name}; primary and existing recovery are unchanged`, () => {
    const { store, port } = fixture(); restore(store);
    const good = prepare(store, legacyBackup); const before = [...port.items];
    assert.equal(store.prepareImport(source()).ok, false);
    assert.equal(store.restoreBackup({ ...good, source: source() }, '0.1.1').ok, false);
    assert.deepEqual([...port.items], before);
  });
}
test('oversized import is rejected before parsing', () => {
  assert.throws(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1)), /8 MiB/);
});
test('pre-restore snapshot keeps the exact raw primary bytes', () => {
  const { store, port } = fixture(); const raw = `\n${JSON.stringify(migratedLegacy, null, 2)}\n`;
  port.setItem(key, raw); store.refresh(); restore(store);
  assert.equal(store.recoveryStatus().snapshot?.rawPrimary, raw);
  assert.equal(parseRecovery(port.getItem(recoveryKey)).pending, undefined);
});
test('exported recovery contains the original document and is valid for import', () => {
  const { store } = fixture(); restore(store);
  const result = store.exportRecovery('0.1.1'); assert(result.ok);
  assert.deepEqual(parseBackup(result.value).data, migratedLegacy);
});
test('recovery restore swaps in the previous data and backs up the replaced primary', () => {
  const { store, port } = fixture(); restore(store);
  const recovery = store.prepareRecovery(); assert(recovery.ok);
  assert(store.restoreBackup(recovery.value, '0.1.1').ok);
  assert.equal(port.getItem(key), migratedRaw);
  assert.deepEqual(JSON.parse(store.recoveryStatus().snapshot!.rawPrimary!), incomingData);
});
test('explicit recovery delete preserves primary and unrelated application data', () => {
  const { store, port } = fixture(); restore(store); port.setItem('other-app', 'untouched');
  const primary = port.getItem(key); const token = store.recoveryStatus().token!;
  assert(store.deleteRecovery(token).ok);
  assert.equal(port.getItem(recoveryKey), null); assert.equal(port.getItem(key), primary);
  assert.equal(port.getItem('other-app'), 'untouched');
});
test('stale preview and stale recovery deletion are rejected', () => {
  const { store, port } = fixture(); const preview = prepare(store); store.addCommand('Changed after preview');
  const before = [...port.items]; assert.equal(store.restoreBackup(preview, '0.1.1').ok, false);
  assert.deepEqual([...port.items], before);
  restore(store); assert.equal(store.deleteRecovery('stale-token').ok, false);
  assert(store.recoveryStatus().exists);
});
test('backup write failure prevents primary replacement', () => {
  const { store, port } = fixture(); const before = [...port.items]; const preview = prepare(store);
  port.fail = name => name === recoveryKey;
  assert.equal(store.restoreBackup(preview, '0.1.1').ok, false);
  assert.deepEqual([...port.items], before);
});
test('primary write failure restores the original recovery bytes', () => {
  const { store, port } = fixture(); restore(store); const preview = prepare(store, legacyBackup);
  const before = [...port.items]; port.fail = name => name === key;
  assert.equal(store.restoreBackup(preview, '0.1.1').ok, false);
  assert.deepEqual([...port.items], before);
});
test('failed primary plus failed rollback preserves prior recovery inside the journal', () => {
  const { store, port } = fixture(); restore(store);
  const previous = store.recoveryStatus().snapshot;
  const start = port.writes.get(recoveryKey)!;
  const preview = prepare(store, legacyBackup);
  port.fail = (name, count) => name === key || (name === recoveryKey && count > start + 1);
  assert.equal(store.restoreBackup(preview, '0.1.1').ok, false);
  assert.deepEqual(store.recoveryStatus().snapshot, previous);
  assert.deepEqual(JSON.parse(port.getItem(key)!), incomingData);
  port.fail = null;
  const reopened = new AppStore(() => port, key);
  assert.equal(reopened.recoveryStatus().pending, false);
  assert.deepEqual(reopened.recoveryStatus().snapshot, previous);
});
test('cleanup failure reports committed restore honestly and completes on reopen', () => {
  const { store, port } = fixture(); const preview = prepare(store);
  port.fail = (name, count) => name === recoveryKey && count === 2;
  const result = store.restoreBackup(preview, '0.1.1'); assert(result.ok); assert(result.value.warning);
  assert.deepEqual(store.getSnapshot().data, incomingData);
  assert.equal(store.recoveryStatus().snapshot?.rawPrimary, migratedRaw);
  assert.equal(store.addCommand('blocked until cleanup').ok, false);
  port.fail = null; const reopened = new AppStore(() => port, key);
  assert.equal(reopened.recoveryStatus().pending, false);
  assert.equal(reopened.recoveryStatus().snapshot?.rawPrimary, migratedRaw);
  assert(reopened.addCommand('cleanup completed').ok);
});
test('ambiguous journal protects all raw data and blocks further writes', () => {
  const { store, port } = fixture(); const before = legacyRaw;
  const candidate = { rawPrimary: before, savedAt: new Date().toISOString(), appVersion: '0.1.1' };
  port.setItem(recoveryKey, JSON.stringify({ recoveryVersion: 1, snapshot: null, pending: { before, after: JSON.stringify(incomingData), candidate } }));
  port.setItem(key, JSON.stringify({ ...incomingData, revision: 99 }));
  const bytes = [...port.items]; store.refresh();
  assert(store.getSnapshot().error); assert.equal(store.addCommand('no').ok, false);
  assert.deepEqual([...port.items], bytes);
  assert(store.exportRecovery('0.1.1').ok);
});
test('explicit restore from corrupt primary preserves raw bytes; corrupt recovery cannot be restored', () => {
  const { store, port } = fixture(); port.setItem(key, '{broken-primary'); store.refresh();
  restore(store);
  assert.equal(store.recoveryStatus().snapshot?.rawPrimary, '{broken-primary');
  assert.equal(store.prepareRecovery().ok, false);
  const exported = store.exportRecovery('0.1.1'); assert(exported.ok);
  assert.equal(JSON.parse(exported.value).rawData, '{broken-primary');
  assert.deepEqual(store.getSnapshot().data, incomingData);
});
test('malformed recovery is preserved, can be exported and explicitly deleted', () => {
  const { store, port } = fixture(); port.setItem(recoveryKey, '{broken-recovery'); store.refresh();
  const before = [...port.items]; assert.equal(store.restoreBackup(prepare(store), '0.1.1').ok, false);
  assert.deepEqual([...port.items], before);
  const exported = store.exportRecovery('0.1.1'); assert(exported.ok);
  assert.equal(JSON.parse(exported.value).recoveryJournal, '{broken-recovery');
  assert(store.deleteRecovery('{broken-recovery').ok);
  assert.equal(port.getItem(key), migratedRaw);
});
test('same-data restore does not replace the recovery snapshot', () => {
  const { store, port } = fixture(); restore(store); const before = [...port.items];
  assert.equal(store.restoreBackup(prepare(store), '0.1.1').ok, false);
  assert.deepEqual([...port.items], before);
});

test('current export round-trips in a separate empty store', () => {
  const { store } = fixture(); const exported = store.exportData('0.1.1'); assert(exported.ok);
  const port = new FaultStorage(); const empty = new AppStore(() => port, key);
  restore(empty, exported.value);
  assert.deepEqual(empty.getSnapshot().data, store.getSnapshot().data);
  assert.equal(empty.recoveryStatus().snapshot?.rawPrimary, null);
  const previous = empty.prepareRecovery(); assert(previous.ok);
  assert(empty.restoreBackup(previous.value, '0.1.1').ok);
  assert.equal(empty.getSnapshot().data.projects.length, 0);
});
test('crash before primary commit retains the older recovery on reopen', () => {
  const { store, port } = fixture(); restore(store);
  const record = parseRecovery(port.getItem(recoveryKey));
  const before = port.getItem(key);
  port.setItem(recoveryKey, JSON.stringify({ ...record, pending: { before, after: legacyRaw,
    candidate: { rawPrimary: before, savedAt: new Date().toISOString(), appVersion: '0.1.1' } } }));
  const reopened = new AppStore(() => port, key);
  assert.deepEqual(reopened.recoveryStatus().snapshot, record.snapshot);
  assert.equal(reopened.recoveryStatus().pending, false);
  assert.equal(port.getItem(key), before);
});
test('invalid restore metadata cannot create an invalid recovery journal', () => {
  const { store, port } = fixture(); const before = [...port.items];
  assert.equal(store.restoreBackup(prepare(store), 'invalid-version').ok, false);
  assert.deepEqual([...port.items], before);
});
test('recovery deletion failure preserves both documents', () => {
  const { store, port } = fixture(); restore(store); const before = [...port.items];
  port.fail = (name, count) => name === recoveryKey && count === -1;
  assert.equal(store.deleteRecovery(store.recoveryStatus().token!).ok, false);
  assert.deepEqual([...port.items], before);
});
