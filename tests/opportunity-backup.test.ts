import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBackup } from '../src/storage/backup.ts';
import { fixture, key, ok } from './decision-fixtures.ts';
import { bridge } from './opportunity-fixtures.ts';

test('schema3 export preview restore and recovery round trip preserve Opportunities and every source version', () => {
  const { store, port } = fixture(); const doc = bridge(); ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true));
  doc.items[0]!.analysis.summary = 'Second'; ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true));
  const before = store.getSnapshot().data; const backup = ok(store.exportData('0.3.0')); const parsed = parseBackup(backup);
  assert.equal(parsed.preview.sourceSchemaVersion, 3); assert.equal(parsed.preview.schemaVersion, 3); assert.equal(parsed.preview.opportunities, 1); assert.equal(parsed.preview.backupVersion, 1);
  const other = fixture(); ok(other.store.restoreBackup(ok(other.store.prepareImport(backup)), '0.3.0')); assert.deepEqual(other.store.getSnapshot().data, before);
  ok(store.addCommand('Later')); const recoveryRaw = port.getItem(key); ok(store.restoreBackup(ok(store.prepareImport(backup)), '0.3.0'));
  assert.equal(store.recoveryStatus().snapshot!.rawPrimary, recoveryRaw); assert.equal(parseBackup(ok(store.exportRecovery('0.3.0'))).data.opportunities[0]!.sourceSnapshots.length, 2);
  ok(store.restoreBackup(ok(store.prepareRecovery()), '0.3.0')); assert.deepEqual(store.getSnapshot().data, JSON.parse(recoveryRaw!));
});
for (const version of [1, 2]) test(`old schema${version} raw/backup/recovery preview and restore migrate to3 with exact prior entities`, () => {
  const raw = readFileSync(`tests/fixtures/v0.${version}-primary.json`, 'utf8'); const old = JSON.parse(raw);
  const { store, port } = fixture(); ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(bridge()))), true));
  const before = port.getItem(key); const preview = ok(store.prepareImport(JSON.stringify({ backupVersion: 1, data: old })));
  assert.equal(preview.preview.sourceSchemaVersion, version); assert.equal(preview.preview.schemaVersion, 3); assert.equal(preview.preview.opportunities, 0); assert.equal(port.getItem(key), before);
  ok(store.restoreBackup(preview, '0.3.0'));
  assert.deepEqual(store.getSnapshot().data, { ...old, schemaVersion: 3, decisions: old.decisions ?? [], opportunities: [] });
  port.items.set(`${key}:recovery`, JSON.stringify({ recoveryVersion: 1, snapshot: { rawPrimary: raw, savedAt: '2026-01-01T00:00:00.000Z', appVersion: `0.${version}.0` } }));
  ok(store.addCommand('Ensure replacement')); const recoveryPreview = ok(store.prepareRecovery()); assert.equal(recoveryPreview.preview.sourceSchemaVersion, version);
  ok(store.restoreBackup(recoveryPreview, '0.3.0')); assert.deepEqual(store.getSnapshot().data.projects, old.projects); assert.deepEqual(store.getSnapshot().data.activity, old.activity);
});
