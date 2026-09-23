import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AppStore } from '../src/storage/store.ts';
import { SCHEMA_VERSION, parseData } from '../src/storage/schema.ts';
import { parseBackup } from '../src/storage/backup.ts';
import { key, MemoryStorage, ok } from './decision-fixtures.ts';

// Synthetic fixture emitted by the unmodified, accepted v0.2.0 AppStore.
const raw = readFileSync('tests/fixtures/v0.2-primary.json', 'utf8');
const data = parseData(raw);
function existing() {
  const port = new MemoryStorage(); port.items.set(key, raw);
  return { port, store: new AppStore(() => port, key) };
}
test('v0.2.0 schema 2 opens in v0.2.1 without migration or any primary write', () => {
  const { port, store } = existing(); assert.equal(SCHEMA_VERSION, 2);
  assert.equal(store.getSnapshot().error, null); assert.deepEqual(store.getSnapshot().data, data);
  assert.equal(port.getItem(key), raw); assert.equal(port.writes, 0);
  store.refresh(); assert.equal(port.writes, 0); assert.equal(port.getItem(key), raw);
  assert(data.projects.length && data.activity.length && data.decisions[0]!.commits.length && data.decisions[0]!.reviews.length);
});
test('v0.2 records, history, scores and project links survive backup/recovery in v0.2.1', () => {
  const { port, store } = existing(); const backup = ok(store.exportData('0.2.1'));
  assert.deepEqual(parseBackup(backup).data, data);
  ok(store.addCommand('After the update')); const beforeRestore = port.getItem(key);
  ok(store.restoreBackup(ok(store.prepareImport(backup)), '0.2.1'));
  assert.deepEqual(store.getSnapshot().data, data);
  assert.equal(store.recoveryStatus().snapshot?.rawPrimary, beforeRestore);
  ok(store.restoreBackup(ok(store.prepareRecovery()), '0.2.1'));
  assert.deepEqual(store.getSnapshot().data, parseData(beforeRestore));
});
test('a stale app seeing newer schema stays recoverable and preserves raw primary and recovery', () => {
  const port = new MemoryStorage(); const future = JSON.stringify({ ...data, schemaVersion: 3 });
  const recovery = JSON.stringify({ recoveryVersion: 1, snapshot: { rawPrimary: raw, savedAt: '2026-09-20T00:00:00.000Z', appVersion: '0.2.0' } });
  port.items.set(key, future); port.items.set(`${key}:recovery`, recovery);
  const store = new AppStore(() => port, key);
  assert.match(store.getSnapshot().error!, /nyere Logic Core.*Opdatér appen.*bevare[t]/);
  assert.equal(store.inspect().ok, false); assert.equal(store.addCommand('Must not write').ok, false);
  assert.equal(port.getItem(key), future); assert.equal(port.getItem(`${key}:recovery`), recovery); assert.equal(port.writes, 0);
  assert(ok(store.exportData('0.2.1')).includes(JSON.stringify(future).slice(1, -1)));
  // The current app can recover naturally when a compatible document is available.
  port.items.set(key, raw); store.refresh(); assert.equal(store.getSnapshot().error, null);
  assert.deepEqual(store.getSnapshot().data, data); assert.equal(port.writes, 0);
});
