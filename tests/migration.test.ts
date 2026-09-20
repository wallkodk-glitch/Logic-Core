import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AppStore } from '../src/storage/store.ts';
import { emptyData, migrateData, parseData, validateData } from '../src/storage/schema.ts';
import { parseBackup } from '../src/storage/backup.ts';
import type { AppData } from '../src/domain/types.ts';
import { create, fixture, key, MemoryStorage, ok, withScores } from './decision-fixtures.ts';

const legacyRaw = readFileSync('tests/fixtures/v0.1-primary.json', 'utf8');
const legacyExport = readFileSync('tests/fixtures/v0.1-backup.json', 'utf8');
const legacy: unknown = JSON.parse(legacyRaw);
const recoveryKey = `${key}:recovery`;
const legacySnapshot = (raw: string) => JSON.stringify({ recoveryVersion: 1, snapshot: { rawPrimary: raw, savedAt: '2026-01-01T00:00:00.000Z', appVersion: '0.1.2' } });

test('fresh schema 2 document has projects, activity and decisions with no writes', () => {
  const { store, port } = fixture(); assert.deepEqual(store.getSnapshot().data, emptyData());
  assert.equal(store.getSnapshot().data.schemaVersion, 2); assert.deepEqual(store.getSnapshot().data.decisions, []); assert.equal(port.writes, 0);
});
test('v1 migration is deterministic, pure, and preserves exact logical projects/activity/revision', () => {
  const before = JSON.stringify(legacy);
  const first = migrateData(legacy); const second = migrateData(legacy);
  assert.deepEqual(first, second); assert.equal(JSON.stringify(legacy), before);
  const original = JSON.parse(legacyRaw) as { projects: unknown; activity: unknown; revision: number };
  assert.equal(JSON.stringify(first.projects), JSON.stringify(original.projects));
  assert.equal(JSON.stringify(first.activity), JSON.stringify(original.activity));
  assert.equal(first.revision, original.revision); assert.deepEqual(first.decisions, []); assert.equal(first.schemaVersion, 2);
});
test('v1 boot atomically persists v2 once without replacing existing recovery', () => {
  const port = new MemoryStorage(); port.items.set(key, legacyRaw); const snapshot = legacySnapshot(legacyRaw); port.items.set(recoveryKey, snapshot);
  const store = new AppStore(() => port, key);
  assert.equal(store.getSnapshot().error, null); assert.equal(port.writes, 1); assert.equal(port.getItem(recoveryKey), snapshot);
  assert.deepEqual(JSON.parse(port.getItem(key)!), migrateData(legacy));
  new AppStore(() => port, key); assert.equal(port.writes, 1);
});
test('migration write failure preserves raw v1 and shows read-only data instead of an empty reset', () => {
  const port = new MemoryStorage(); port.items.set(key, legacyRaw); port.failWrite = true;
  const store = new AppStore(() => port, key);
  assert.equal(port.getItem(key), legacyRaw); assert(store.getSnapshot().error);
  assert.equal(store.inspect().ok, false); // Diagnostics must not claim a persisted v2.
  assert.deepEqual(store.getSnapshot().data.projects, migrateData(legacy).projects);
  assert.equal(store.addCommand('must not write').ok, false); assert.equal(port.getItem(key), legacyRaw);
  port.failWrite = false; store.refresh(); assert.equal(store.getSnapshot().error, null);
  assert.equal(store.inspect().ok, true);
  assert.equal(JSON.parse(port.getItem(key)!).schemaVersion, 2);
});
test('migration never repairs or resets malformed v1 or unknown schemas', () => {
  for (const raw of ['{broken', '{"schemaVersion":1,"projects":[],"activity":[]}', JSON.stringify({ ...migrateData(legacy), schemaVersion: 1 }), '{"schemaVersion":3,"future":true}']) {
    const port = new MemoryStorage(); port.items.set(key, raw); const snapshot = legacySnapshot(legacyRaw); port.items.set(recoveryKey, snapshot);
    const store = new AppStore(() => port, key); assert(store.getSnapshot().error);
    assert.equal(port.getItem(key), raw); assert.equal(port.getItem(recoveryKey), snapshot); assert.equal(port.writes, 0);
  }
});
test('v1 backup preview is read-only, explains migration, and restores atomically into v2', () => {
  const { store, port } = fixture(); create(store, true); const before = [...port.items];
  const prepared = ok(store.prepareImport(legacyExport));
  assert.equal(prepared.preview.sourceSchemaVersion, 1); assert.equal(prepared.preview.schemaVersion, 2); assert.equal(prepared.preview.decisions, 0);
  assert.deepEqual([...port.items], before);
  ok(store.restoreBackup(prepared, '0.2.0'));
  assert.deepEqual(store.getSnapshot().data, migrateData(legacy));
  assert.equal(store.recoveryStatus().snapshot?.rawPrimary, before[0]?.[1]);
});
test('schema 2 export/import round trip preserves commits, reviews and scores', () => {
  const { store } = fixture(); let decision = ok(store.saveDecision(withScores(), undefined, undefined, true));
  decision = ok(store.reviewDecision(decision.id, { outcome: 'Review fact', whatChanged: 'Evidence', lessons: 'Lesson', action: 'keep' }, decision.updatedAt));
  const exported = ok(store.exportData('0.2.0')); assert.equal(parseBackup(exported).preview.sourceSchemaVersion, 2);
  const other = fixture(); ok(other.store.restoreBackup(ok(other.store.prepareImport(exported)), '0.2.0'));
  assert.deepEqual(other.store.getSnapshot().data, store.getSnapshot().data);
  assert.equal(other.store.getSnapshot().data.decisions[0]?.reviews[0]?.outcome, 'Review fact');
});
test('old v0.1.x recovery snapshot previews schema migration and restores into v0.2', () => {
  const { store, port } = fixture(); create(store);
  const before = port.getItem(key); port.items.set(recoveryKey, legacySnapshot(legacyRaw)); store.refresh();
  assert.equal(store.recoveryStatus().snapshot?.rawPrimary, legacyRaw);
  const prepared = ok(store.prepareRecovery()); assert.equal(prepared.preview.sourceSchemaVersion, 1); assert.equal(prepared.preview.schemaVersion, 2);
  ok(store.restoreBackup(prepared, '0.2.0'));
  assert.deepEqual(store.getSnapshot().data, migrateData(legacy)); assert.equal(store.recoveryStatus().snapshot?.rawPrimary, before);
});
test('pending legacy journal is settled BEFORE boot migration and retains pre-restore v1 bytes', () => {
  const port = new MemoryStorage();
  const before = JSON.stringify({ schemaVersion: 1, revision: 0, projects: [], activity: [] });
  port.items.set(key, legacyRaw);
  port.items.set(recoveryKey, JSON.stringify({ recoveryVersion: 1, snapshot: null, pending: {
    before, after: legacyRaw, candidate: { rawPrimary: before, savedAt: '2026-01-01T00:00:00.000Z', appVersion: '0.1.2' },
  } }));
  const store = new AppStore(() => port, key);
  assert.equal(store.getSnapshot().error, null); assert.equal(store.recoveryStatus().pending, false);
  assert.equal(store.recoveryStatus().snapshot?.rawPrimary, before); assert.equal(JSON.parse(port.getItem(key)!).schemaVersion, 2);
});
test('failed legacy journal retains older recovery before migration', () => {
  const port = new MemoryStorage(); const after = JSON.stringify({ schemaVersion: 1, revision: 0, projects: [], activity: [] });
  const record = JSON.parse(legacySnapshot(after)) as { recoveryVersion: 1; snapshot: { rawPrimary: string; savedAt: string; appVersion: string } };
  port.items.set(key, legacyRaw); port.items.set(recoveryKey, JSON.stringify({ ...record, pending: {
    before: legacyRaw, after, candidate: { rawPrimary: legacyRaw, savedAt: '2026-01-01T00:00:00.000Z', appVersion: '0.1.2' },
  } }));
  const store = new AppStore(() => port, key);
  assert.equal(store.getSnapshot().error, null); assert.equal(store.recoveryStatus().snapshot?.rawPrimary, after);
  assert.deepEqual(store.getSnapshot().data, migrateData(legacy));
});
test('current schema parser refuses derived totals and does not rewrite valid schema 2 on boot', () => {
  const { store, port } = fixture(); create(store, true); const raw = port.getItem(key)!; const writes = port.writes;
  const reopened = new AppStore(() => port, key); assert.equal(port.getItem(key), raw); assert.equal(port.writes, writes);
  const bad = structuredClone(reopened.getSnapshot().data); Object.assign(bad.decisions[0]!, { totalScore: 9 });
  assert.throws(() => validateData(bad)); assert.deepEqual(parseData(raw), store.getSnapshot().data);
});

const malformed: [string, (data: AppData) => void][] = [
  ['missing decisions array', data => { Reflect.deleteProperty(data, 'decisions'); }],
  ['future schema', data => { Object.assign(data, { schemaVersion: 3 }); }],
  ['missing decision field', data => { Reflect.deleteProperty(data.decisions[0]!, 'goal'); }],
  ['duplicate decision IDs', data => { data.decisions.push(structuredClone(data.decisions[0]!)); }],
  ['reserved route ID', data => { data.decisions[0]!.id = 'new'; }],
  ['blank decision ID', data => { data.decisions[0]!.id = ' '; }],
  ['invalid date', data => { data.decisions[0]!.createdAt = '2026-02-30T00:00:00.000Z'; }],
  ['reversed dates', data => { data.decisions[0]!.updatedAt = '2000-01-01T00:00:00.000Z'; }],
  ['invalid decision enum', data => { Object.assign(data.decisions[0]!, { status: 'review-due' }); }],
  ['missing project reference', data => { data.decisions[0]!.linkedProjectId = 'deleted-project'; }],
  ['missing selected option', data => { data.decisions[0]!.selectedOptionId = 'missing'; }],
  ['duplicate option IDs', data => { const options = data.decisions[0]!.options; options[1]!.id = options[0]!.id; }],
  ['bad reversibility', data => { Object.assign(data.decisions[0]!.options[0]!, { reversibility: 'impossible' }); }],
  ['oversized option text', data => { data.decisions[0]!.options[0]!.description = 'x'.repeat(2001); }],
  ['duplicate criterion IDs', data => { const criteria = data.decisions[0]!.criteria; criteria[1]!.id = criteria[0]!.id; }],
  ['bad criterion weight', data => { data.decisions[0]!.criteria[0]!.weight = 6; }],
  ['noninteger weight', data => { data.decisions[0]!.criteria[0]!.weight = 1.5; }],
  ['bad option score reference', data => { data.decisions[0]!.scores[0]!.optionId = 'missing'; }],
  ['bad criterion score reference', data => { data.decisions[0]!.scores[0]!.criterionId = 'missing'; }],
  ['duplicate score pair', data => { const scores = data.decisions[0]!.scores; scores.push({ ...scores[0]! }); }],
  ['score out of range', data => { data.decisions[0]!.scores[0]!.score = 11; }],
  ['fractional score', data => { data.decisions[0]!.scores[0]!.score = 4.5; }],
  ['incomplete decided score grid', data => { data.decisions[0]!.scores.pop(); }],
  ['missing commit on decided record', data => { data.decisions[0]!.commits = []; }],
  ['duplicate commit', data => { const commits = data.decisions[0]!.commits; commits.push(structuredClone(commits[0]!)); }],
  ['bad commit timestamp', data => { Object.assign(data.decisions[0]!.commits[0]!, { createdAt: 'invalid' }); }],
  ['bad commit snapshot reference', data => { Object.assign(data.decisions[0]!.commits[0]!.snapshot, { selectedOptionId: 'missing' }); }],
  ['bad commit snapshot score', data => { data.decisions[0]!.commits[0]!.snapshot.scores[0]!.score = 12; }],
  ['incomplete commit snapshot', data => { Reflect.deleteProperty(data.decisions[0]!.commits[0]!.snapshot, 'assumptions'); }],
  ['decided content differs from last commit', data => { data.decisions[0]!.goal = 'Changed without reopening'; }],
  ['review references missing commit', data => { Object.assign(data.decisions[0]!.reviews[0]!, { commitId: 'missing' }); }],
  ['review before commit', data => { Object.assign(data.decisions[0]!.reviews[0]!, { createdAt: data.decisions[0]!.createdAt }); }],
  ['duplicate review', data => { const reviews = data.decisions[0]!.reviews; reviews.push(structuredClone(reviews[0]!)); }],
  ['bad review action', data => { Object.assign(data.decisions[0]!.reviews[0]!, { action: 'delete' }); }],
  ['blank review outcome', data => { Object.assign(data.decisions[0]!.reviews[0]!, { outcome: ' ' }); }],
  ['decision activity without decision ID', data => { Reflect.deleteProperty(data.activity[0]!, 'decisionId'); }],
];
for (const [label, mutate] of malformed) {
  test(`invalid v2 ${label} rejects import and write-boundary restore without changing either key`, () => {
    const { store, port } = fixture(); const decision = ok(store.saveDecision(withScores(), undefined, undefined, true));
    ok(store.reviewDecision(decision.id, { outcome: 'Observed', whatChanged: '', lessons: '', action: 'keep' }, decision.updatedAt));
    const valid = structuredClone(store.getSnapshot().data);
    ok(store.restoreBackup(ok(store.prepareImport(JSON.stringify({ ...valid, revision: valid.revision + 1 }))), '0.2.0'));
    const prepared = ok(store.prepareImport(JSON.stringify(valid)));
    const bad = structuredClone(valid); mutate(bad); const source = JSON.stringify(bad); const before = [...port.items];
    assert.equal(store.prepareImport(source).ok, false);
    assert.equal(store.restoreBackup({ ...prepared, source }, '0.2.0').ok, false);
    assert.deepEqual([...port.items], before);
  });
}
