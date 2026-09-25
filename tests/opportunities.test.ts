import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AppStore } from '../src/storage/store.ts';
import { emptyData, migrateData, validateData } from '../src/storage/schema.ts';
import { newOpportunityInput, opportunityInput } from '../src/domain/opportunities.ts';
import { opportunitySignal } from '../src/domain/opportunity-intelligence.ts';
import { fixture, key, MemoryStorage, ok, completeInput } from './decision-fixtures.ts';
import { bridge } from './opportunity-fixtures.ts';

test('v2 -> v3 preserves all records/revision exactly and is deterministic/idempotent', () => {
  const old = JSON.parse(readFileSync('tests/fixtures/v0.2-primary.json', 'utf8'));
  const before = JSON.stringify(old); const data = migrateData(old);
  assert.equal(data.schemaVersion, 3); assert.deepEqual(data.opportunities, []);
  for (const field of ['projects', 'decisions', 'activity', 'revision'] as const) assert.equal(JSON.stringify(data[field]), JSON.stringify(old[field]));
  assert.deepEqual(migrateData(old), data); assert.deepEqual(migrateData(data), data); assert.equal(JSON.stringify(old), before);
});
test('v1 -> v3 adds two empty collections without changing legacy records', () => {
  const old = JSON.parse(readFileSync('tests/fixtures/v0.1-primary.json', 'utf8')); const data = migrateData(old);
  assert.deepEqual(data, { ...old, schemaVersion: 3, decisions: [], opportunities: [] });
});
test('failed v2 migration write preserves raw source and recovery then succeeds once', () => {
  const port = new MemoryStorage(); const raw = readFileSync('tests/fixtures/v0.2-primary.json', 'utf8');
  port.items.set(key, raw); port.failWrite = true; const store = new AppStore(() => port, key);
  assert(store.getSnapshot().error); assert.equal(port.getItem(key), raw); assert.equal(store.addCommand('blocked').ok, false);
  assert.deepEqual(store.getSnapshot().data.decisions, JSON.parse(raw).decisions);
  port.failWrite = false; store.refresh(); store.refresh(); assert.equal(port.writes, 1); assert.equal(store.getSnapshot().error, null);
});
test('manual Opportunity CRUD reload/stale/status/delete stays atomic', () => {
  const { store, port } = fixture(); const input = { ...newOpportunityInput(), title: 'Local', domain: 'Robotics' };
  const first = ok(store.saveOpportunity(input)); assert.equal(first.sourceSnapshots.length, 0);
  const saved = ok(store.saveOpportunity({ ...opportunityInput(first), status: 'active', notes: 'My work' }, first.id, first.updatedAt));
  assert(saved.updatedAt > first.updatedAt); assert.equal(store.saveOpportunity(input, first.id, first.updatedAt).ok, false);
  assert.deepEqual(new AppStore(() => port, key).getSnapshot().data.opportunities, [saved]);
  const archived = ok(store.saveOpportunity({ ...opportunityInput(saved), status: 'archived' }, saved.id, saved.updatedAt));
  ok(store.deleteOpportunity(archived.id, archived.updatedAt)); assert.deepEqual(store.getSnapshot().data.opportunities, []);
  assert.equal(store.getSnapshot().data.activity[0]?.type, 'opportunity.deleted');
});
test('bridge preview writes nothing and commit requires explicit confirmation', () => {
  const { store, port } = fixture(); const prepared = ok(store.prepareBridge(JSON.stringify(bridge(2))));
  assert.deepEqual(prepared.preview, { items: 2, created: 2, updated: 0, unchanged: 0, source: 'Logic Hunter', generatedAt: '2026-09-20T12:00:00.000Z' });
  assert.equal(port.writes, 0); assert.equal(store.importBridge(prepared, false).ok, false); assert.equal(port.writes, 0);
  ok(store.importBridge(prepared, true)); assert.equal(port.writes, 1); assert.equal(store.getSnapshot().data.opportunities.length, 2);
});
test('the downloadable Bridge example passes the actual preview and import contract', () => {
  const { store, port } = fixture();
  const prepared = ok(store.prepareBridge(readFileSync('public/opportunity-bridge-example.json', 'utf8')));
  assert.equal(prepared.preview.created, 1); assert.equal(port.writes, 0);
  ok(store.importBridge(prepared, true));
  assert.equal(store.getSnapshot().data.opportunities[0]?.bridgeKey, 'business:example-001');
  validateData(store.getSnapshot().data);
});
test('re-import appends immutable source and preserves all local fields; duplicate analysis never writes', () => {
  const { store, port } = fixture(); const doc = bridge();
  ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true));
  const first = store.getSnapshot().data.opportunities[0]!;
  const edited = ok(store.saveOpportunity({ ...opportunityInput(first), title: 'My title', domain: 'Dogs', notes: 'Keep', tags: ['local'], status: 'parked', nextAction: 'Mine', evaluation: { upside: 3 } }, first.id, first.updatedAt));
  const history = JSON.stringify(edited.sourceSnapshots); const local = opportunityInput(edited);
  doc.items[0]!.analysis.summary = 'New finding';
  ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true));
  const newer = store.getSnapshot().data.opportunities[0]!;
  assert.deepEqual(opportunityInput(newer), local); assert.equal(JSON.stringify(newer.sourceSnapshots.slice(0, 1)), history);
  assert.equal(newer.sourceSnapshots.length, 2); assert.throws(() => { newer.sourceSnapshots[0]!.payload.analysis.summary = 'overwrite'; }, TypeError);
  const before = port.getItem(key); const writes = port.writes; doc.items[0]!.sourceRunId = 'another-run';
  const duplicate = ok(store.prepareBridge(JSON.stringify(doc))); assert.equal(duplicate.preview.unchanged, 1);
  ok(store.importBridge(duplicate, true)); assert.equal(port.getItem(key), before); assert.equal(port.writes, writes);
});
test('partial-invalid bridge and quota failure never publish either half', () => {
  const { store, port } = fixture(); const bad = bridge(2); bad.items[1]!.analysis.sourceLinks = ['javascript:alert(1)'];
  assert.equal(store.prepareBridge(JSON.stringify(bad)).ok, false); assert.equal(port.writes, 0);
  const prepared = ok(store.prepareBridge(JSON.stringify(bridge(2)))); port.failWrite = true;
  assert.equal(store.importBridge(prepared, true).ok, false); assert.equal(port.getItem(key), null); assert.deepEqual(store.getSnapshot().data.opportunities, []);
});
test('signal uses all seven inputs, inverts downside, and does not choose status', () => {
  assert.equal(opportunitySignal({}), null);
  assert.equal(opportunitySignal({ upside: 5, confidence: 5, fit: 5, speed: 5, capitalEfficiency: 5, reversibility: 5, downsideRisk: 1 }), 100);
  assert.equal(opportunitySignal({ upside: 1, confidence: 1, fit: 1, speed: 1, capitalEfficiency: 1, reversibility: 1, downsideRisk: 5 }), 0);
  assert.equal(opportunitySignal({ upside: 3, confidence: 3, fit: 3, speed: 3, capitalEfficiency: 3, reversibility: 3, downsideRisk: 3 }), 50);
});
test('Opportunity -> Decision creates one unselected draft and backlink in one write', () => {
  const { store, port } = fixture(); const project = ok(store.saveProject({ title: 'Project', description: '', status: 'active' }));
  ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(bridge()))), true));
  let opp = store.getSnapshot().data.opportunities[0]!;
  opp = ok(store.saveOpportunity({ ...opportunityInput(opp), linkedProjectIds: [project.id] }, opp.id, opp.updatedAt));
  const before = port.getItem(key); port.failWrite = true;
  assert.equal(store.startOpportunityDecision(opp.id, opp.updatedAt).ok, false); assert.equal(port.getItem(key), before); assert.equal(store.getSnapshot().data.decisions.length, 0);
  port.failWrite = false; const writes = port.writes; const decision = ok(store.startOpportunityDecision(opp.id, opp.updatedAt));
  assert.equal(port.writes, writes + 1); assert.equal(decision.status, 'draft'); assert.equal(decision.selectedOptionId, undefined); assert.deepEqual(decision.commits, []);
  assert.equal(decision.linkedProjectId, project.id); assert.deepEqual(store.getSnapshot().data.opportunities[0]!.linkedDecisionIds, [decision.id]);
});
test('deleting project/decision cleans links atomically and deleting opportunity preserves other entities', () => {
  const { store } = fixture(); const p = ok(store.saveProject({ title: 'P', description: '', status: 'active' }));
  const d = ok(store.saveDecision({ ...completeInput(), linkedProjectId: p.id }, undefined, undefined, true));
  let o = ok(store.saveOpportunity({ ...newOpportunityInput(), title: 'O', domain: 'AI', linkedProjectIds: [p.id], linkedDecisionIds: [d.id] }));
  ok(store.deleteProject(p.id, p.updatedAt)); o = store.getSnapshot().data.opportunities[0]!;
  assert.deepEqual(o.linkedProjectIds, []); assert.equal(store.getSnapshot().data.decisions[0]!.linkedProjectId, undefined);
  const updated = store.getSnapshot().data.decisions[0]!; ok(store.deleteDecision(updated.id, updated.updatedAt));
  o = store.getSnapshot().data.opportunities[0]!; assert.deepEqual(o.linkedDecisionIds, []); validateData(store.getSnapshot().data);
  const kept = ok(store.saveDecision(completeInput())); ok(store.deleteOpportunity(o.id, o.updatedAt)); assert.equal(store.getSnapshot().data.decisions[0]?.id, kept.id);
});
test('fresh schema requires opportunities and refuses future or unknown top-level data', () => {
  const data = emptyData(); assert.equal(data.schemaVersion, 3); assert.deepEqual(data.opportunities, []);
  assert.throws(() => migrateData({ ...data, schemaVersion: 4 }), /nyere/);
  assert.throws(() => validateData({ ...data, opportunitySignal: 50 }));
  Reflect.deleteProperty(data, 'opportunities'); assert.throws(() => validateData(data));
});
