import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AppStore } from '../src/storage/store.ts';
import { opportunityInput, newOpportunityInput } from '../src/domain/opportunities.ts';
import { opportunitySignal } from '../src/domain/opportunity-intelligence.ts';
import { fixture, key, ok, completeInput, MemoryStorage } from './decision-fixtures.ts';
import { bridge } from './opportunity-fixtures.ts';

test('new Opportunity activities have IDs, manual status emits status event and signal never changes status', () => {
  const { store } = fixture(); let o = ok(store.saveOpportunity({ ...newOpportunityInput(), title: 'Manual', status: 'parked' }));
  assert.equal(store.getSnapshot().data.activity[0]!.type, 'opportunity.created');
  o = ok(store.saveOpportunity({ ...opportunityInput(o), evaluation: { upside: 5, confidence: 5, fit: 5, speed: 5, capitalEfficiency: 5, reversibility: 5, downsideRisk: 1 } }, o.id, o.updatedAt));
  assert.equal(opportunitySignal(o.evaluation), 100); assert.equal(o.status, 'parked'); assert.equal(store.getSnapshot().data.decisions.length, 0); assert.equal(store.getSnapshot().data.projects.length, 0);
  o = ok(store.saveOpportunity({ ...opportunityInput(o), status: 'candidate' }, o.id, o.updatedAt));
  assert.equal(store.getSnapshot().data.activity[0]!.type, 'opportunity.status'); assert.equal(store.getSnapshot().data.activity[0]!.opportunityId, o.id);
});
test('local input cannot smuggle a source snapshot or bridge identity into a save', () => {
  const { store, port } = fixture(); ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(bridge()))), true)); const o = store.getSnapshot().data.opportunities[0]!;
  const before = port.getItem(key);
  for (const extra of [{ sourceSnapshots: [] }, { bridgeKey: 'tampered' }, { createdAt: '2000-01-01T00:00:00.000Z' }]) {
    assert.equal(store.saveOpportunity({ ...opportunityInput(o), ...extra }, o.id, o.updatedAt).ok, false); assert.equal(port.getItem(key), before);
  }
});
test('all Opportunity writes reject stale editors, including start-decision and delete', () => {
  const { store, port } = fixture(); const o = ok(store.saveOpportunity({ ...newOpportunityInput(), title: 'Initial' })); const other = new AppStore(() => port, key);
  const latest = ok(store.saveOpportunity({ ...opportunityInput(o), title: 'New' }, o.id, o.updatedAt));
  assert.equal(other.saveOpportunity(opportunityInput(o), o.id, o.updatedAt).ok, false);
  const before = port.getItem(key); assert.equal(store.deleteOpportunity(o.id, o.updatedAt).ok, false); assert.equal(store.startOpportunityDecision(o.id, o.updatedAt).ok, false);
  assert.equal(port.getItem(key), before); assert.equal(other.getSnapshot().data.opportunities[0]!.updatedAt, latest.updatedAt);
});
for (const entity of ['project', 'decision', 'opportunity'] as const) test(`quota failure deleting ${entity} preserves every linked entity and history`, () => {
  const { store, port } = fixture(); const p = ok(store.saveProject({ title: 'P', description: '', status: 'active' }));
  const d = ok(store.saveDecision({ ...completeInput(), linkedProjectId: p.id }, undefined, undefined, true));
  const o = ok(store.saveOpportunity({ ...newOpportunityInput(), title: 'O', linkedProjectIds: [p.id], linkedDecisionIds: [d.id] }));
  const before = port.getItem(key); const visible = store.getSnapshot().data; port.failWrite = true;
  const result = entity === 'project' ? store.deleteProject(p.id, p.updatedAt) : entity === 'decision' ? store.deleteDecision(d.id, d.updatedAt) : store.deleteOpportunity(o.id, o.updatedAt);
  assert.equal(result.ok, false); assert.equal(port.getItem(key), before); assert.deepEqual(store.getSnapshot().data, visible);
});
test('save quota failure cannot publish local edit or alter frozen source', () => {
  const { store, port } = fixture(); ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(bridge()))), true)); const o = store.getSnapshot().data.opportunities[0]!;
  const before = port.getItem(key); port.failWrite = true; assert.equal(store.saveOpportunity({ ...opportunityInput(o), notes: 'Unwritten' }, o.id, o.updatedAt).ok, false);
  assert.equal(port.getItem(key), before); assert.equal(store.getSnapshot().data.opportunities[0]!.notes, '');
});
test('Opportunity -> Decision prefill is bounded, attributed, preserves local nextAction and makes no selection', () => {
  const { store } = fixture(); const doc = bridge(); doc.items[0]!.analysis.summary = 's'.repeat(2000); doc.items[0]!.analysis.evidence = Array(8).fill('e'.repeat(500));
  doc.items[0]!.analysis.assumptions = Array(8).fill('a'.repeat(500));
  ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true)); let o = store.getSnapshot().data.opportunities[0]!;
  o = ok(store.saveOpportunity({ ...opportunityInput(o), title: 't'.repeat(120), nextAction: 'My test' }, o.id, o.updatedAt));
  const d = ok(store.startOpportunityDecision(o.id, o.updatedAt)); assert.equal(d.title.length, 120); assert.equal(d.reality.length, 4000); assert.equal(d.assumptions.length, 4000);
  assert(d.reality.includes(o.sourceSnapshots[0]!.id)); assert(d.reality.includes(o.bridgeKey!)); assert.equal(d.nextAction, 'My test'); assert.equal(d.status, 'draft'); assert.equal(d.selectedOptionId, undefined);
  assert.equal(d.options.length, 2); assert(d.options.every(option => option.title === ''));
});
test('Opportunity -> Decision respects decision-link cap and never half-creates', () => {
  const { store, port } = fixture(); const ids = Array.from({ length: 10 }, () => ok(store.saveDecision(completeInput())).id);
  const o = ok(store.saveOpportunity({ ...newOpportunityInput(), title: 'O', linkedDecisionIds: ids })); const before = port.getItem(key);
  assert.equal(store.startOpportunityDecision(o.id, o.updatedAt).ok, false); assert.equal(port.getItem(key), before); assert.equal(store.getSnapshot().data.decisions.length, 10);
});
test('source timestamp remains monotonic after a clock rollback and local edit', () => {
  const { store, port } = fixture(); const doc = bridge(); ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true));
  const data = structuredClone(store.getSnapshot().data); data.opportunities[0]!.updatedAt = '2099-01-01T00:00:00.000Z'; port.items.set(key, JSON.stringify(data)); store.refresh();
  doc.items[0]!.analysis.summary = 'Future-clock reimport'; ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true));
  const o = store.getSnapshot().data.opportunities[0]!; assert.equal(o.updatedAt, '2099-01-01T00:00:00.001Z'); assert.equal(o.sourceSnapshots.at(-1)!.importedAt, o.updatedAt);
});
test('v2 migration failure and success both preserve exact existing recovery bytes', () => {
  const port = new MemoryStorage(); const raw = readFileSync('tests/fixtures/v0.2-primary.json', 'utf8');
  const recovery = JSON.stringify({ recoveryVersion: 1, snapshot: { rawPrimary: raw, savedAt: '2026-01-01T00:00:00.000Z', appVersion: '0.2.1' } }, null, 2);
  port.items.set(key, raw); port.items.set(`${key}:recovery`, recovery); port.failWrite = true; const store = new AppStore(() => port, key);
  assert.equal(port.getItem(key), raw); assert.equal(port.getItem(`${key}:recovery`), recovery);
  port.failWrite = false; store.refresh(); assert.equal(store.getSnapshot().error, null); assert.equal(port.getItem(`${key}:recovery`), recovery);
});
test('Opportunity operations retain the activity cap without modifying prior retained entries', () => {
  const { store } = fixture(); let o = ok(store.saveOpportunity({ ...newOpportunityInput(), title: 'O' }));
  for (let i = 0; i < 305; i++) o = ok(store.saveOpportunity({ ...opportunityInput(o), notes: `Edit ${i}` }, o.id, o.updatedAt));
  assert.equal(store.getSnapshot().data.activity.length, 300);
});
