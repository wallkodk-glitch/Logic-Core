import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/storage/store.ts';
import { parseBridge } from '../src/storage/opportunity-bridge.ts';
import { newOpportunityInput, opportunityInput } from '../src/domain/opportunities.ts';
import type { BridgeDocument } from '../src/domain/opportunities.ts';
import { fixture, key, ok, completeInput } from './decision-fixtures.ts';
import { bridge } from './opportunity-fixtures.ts';

const bad: [string, (doc: BridgeDocument) => void][] = [
  ['format', d => { Object.assign(d, { format: 'other' }); }],
  ['future version', d => { Object.assign(d, { bridgeVersion: 2 }); }],
  ['extra top-level object', d => { Object.assign(d, { instructions: { execute: true } }); }],
  ['empty source', d => { d.source = ''; }],
  ['missing metadata', d => { Reflect.deleteProperty(d, 'generatedAt'); }],
  ['invalid date', d => { d.items[0]!.generatedAt = 'tomorrow'; }],
  ['empty batch', d => { d.items = []; }],
  ['duplicate batch keys', d => { d.items.push(structuredClone(d.items[0]!)); }],
  ['missing analysis field', d => { Reflect.deleteProperty(d.items[0]!.analysis, 'evidence'); }],
  ['unknown analysis property', d => { Object.assign(d.items[0]!.analysis, { html: '<script/>' }); }],
  ['arbitrary evidence object', d => { Object.assign(d.items[0]!.analysis, { evidence: [{ data: 'not text' }] }); }],
  ['too much evidence', d => { d.items[0]!.analysis.evidence = Array(9).fill('Evidence'); }],
  ['long list item', d => { d.items[0]!.analysis.assumptions = ['x'.repeat(501)]; }],
  ['javascript URL', d => { d.items[0]!.analysis.sourceLinks = ['javascript:alert(1)']; }],
  ['data URL', d => { d.items[0]!.analysis.sourceLinks = ['data:text/html,<h1>Bad</h1>']; }],
  ['relative URL', d => { d.items[0]!.analysis.sourceLinks = ['/Logic-Core/']; }],
  ['URL credentials', d => { d.items[0]!.analysis.sourceLinks = ['https://user:password@example.com']; }],
  ['URL control characters', d => { d.items[0]!.analysis.sourceLinks = ['https://ex\nample.com']; }],
  ['long URL', d => { d.items[0]!.analysis.sourceLinks = ['https://example.com/' + 'x'.repeat(2048)]; }],
  ['duplicate URL', d => { d.items[0]!.analysis.sourceLinks = ['https://example.com', 'https://example.com']; }],
];
for (const [label, mutate] of bad) test(`bridge rejects ${label} in preview and at commit boundary without writes`, () => {
  const { store, port } = fixture(); const prepared = ok(store.prepareBridge(JSON.stringify(bridge()))); const doc = bridge(); mutate(doc);
  const source = JSON.stringify(doc); const before = [...port.items];
  assert.equal(store.prepareBridge(source).ok, false); assert.equal(store.importBridge({ ...prepared, source }, true).ok, false); assert.deepEqual([...port.items], before);
});
test('malformed/oversized JSON, over-limit batch and partial-invalid batch leave data unchanged', () => {
  const { store, port } = fixture(); const doc = bridge(2); doc.items[1]!.analysis.domain = '';
  for (const raw of ['{broken', 'null', '[]', ' '.repeat(131073), JSON.stringify(bridge(21)), JSON.stringify(doc)]) {
    assert.equal(store.prepareBridge(raw).ok, false); assert.equal(port.writes, 0);
  }
});
test('maximum 20-item valid batch commits once with distinct IDs and immutable snapshots', () => {
  const { store, port } = fixture(); const doc = bridge(20); ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true));
  assert.equal(port.writes, 1); const items = store.getSnapshot().data.opportunities; assert.equal(items.length, 20);
  assert.equal(new Set(items.map(o => o.id)).size, 20); assert.equal(new Set(items.map(o => o.sourceSnapshots[0]!.id)).size, 20);
  doc.items[0]!.analysis.summary = 'Afterwards'; assert.notEqual(items.find(o => o.bridgeKey === doc.items[0]!.bridgeKey)!.sourceSnapshots[0]!.payload.analysis.summary, 'Afterwards');
});
test('canonical object-key reordering and delivery metadata changes do not create duplicates', () => {
  const { store, port } = fixture(); const doc = bridge();
  ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true));
  doc.source = 'Renamed sender'; doc.generatedAt = '2026-09-21T00:00:00.000Z'; doc.items[0]!.generatedAt = doc.generatedAt;
  doc.items[0]!.analysis = Object.fromEntries(Object.entries(doc.items[0]!.analysis).reverse()) as unknown as typeof doc.items[0]['analysis'];
  const before = port.getItem(key); const preview = ok(store.prepareBridge(JSON.stringify(doc)));
  assert.equal(preview.preview.unchanged, 1); ok(store.importBridge(preview, true)); assert.equal(port.getItem(key), before);
});
test('re-import of an older known analysis is unchanged, not a rollback of latest source', () => {
  const { store, port } = fixture(); const first = bridge(); const changed = bridge(); changed.items[0]!.analysis.thesis = 'New thesis';
  for (const doc of [first, changed]) ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true));
  const before = port.getItem(key); const prepared = ok(store.prepareBridge(JSON.stringify(first)));
  assert.equal(prepared.preview.unchanged, 1); ok(store.importBridge(prepared, true)); assert.equal(port.getItem(key), before);
  assert.equal(store.getSnapshot().data.opportunities[0]!.sourceSnapshots.at(-1)!.payload.analysis.thesis, 'New thesis');
});
test('re-import preserves evaluation, review date, tags, project/decision links and local status exactly', () => {
  const { store } = fixture(); const p = ok(store.saveProject({ title: 'P', description: '', status: 'active' })); const d = ok(store.saveDecision(completeInput()));
  const doc = bridge(); ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true)); const o = store.getSnapshot().data.opportunities[0]!;
  const local = { ...opportunityInput(o), linkedProjectIds: [p.id], linkedDecisionIds: [d.id], reviewAt: '2027-01-01T00:00:00.000Z', evaluation: { upside: 4, confidence: 2 }, tags: ['keep'], status: 'rejected' as const };
  ok(store.saveOpportunity(local, o.id, o.updatedAt)); doc.items[0]!.analysis.title = 'Source renamed'; doc.items[0]!.analysis.domain = 'Tools';
  ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true)); assert.deepEqual(opportunityInput(store.getSnapshot().data.opportunities[0]!), local);
});
test('stale preview fails after local edit and after another window changes primary', () => {
  const { store, port } = fixture(); const source = JSON.stringify(bridge()); const prepared = ok(store.prepareBridge(source));
  ok(store.addCommand('changed')); const before = port.getItem(key); assert.equal(store.importBridge(prepared, true).ok, false); assert.equal(port.getItem(key), before);
  const next = ok(store.prepareBridge(source)); const other = new AppStore(() => port, key); ok(other.addCommand('another window'));
  const latest = port.getItem(key); assert.equal(store.importBridge(next, true).ok, false); assert.equal(port.getItem(key), latest);
});
test('snapshot cap does not evict history and duplicates still work at the cap', () => {
  const { store, port } = fixture(); const doc = bridge();
  for (let i = 0; i < 8; i++) { doc.items[0]!.analysis.summary = `Version ${i}`; ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true)); }
  const before = port.getItem(key); const duplicate = ok(store.prepareBridge(JSON.stringify(doc))); ok(store.importBridge(duplicate, true)); assert.equal(port.getItem(key), before);
  doc.items[0]!.analysis.summary = 'Version 9'; assert.equal(store.prepareBridge(JSON.stringify(doc)).ok, false); assert.equal(port.getItem(key), before);
  assert.equal(store.getSnapshot().data.opportunities[0]!.sourceSnapshots[0]!.payload.analysis.summary, 'Version 0');
});
test('opportunity limit blocks manual and batch additions without discarding current records', () => {
  const { store, port } = fixture();
  for (let i = 0; i < 50; i++) ok(store.saveOpportunity({ ...newOpportunityInput(), title: `O ${i}` }));
  const before = port.getItem(key); assert.equal(store.saveOpportunity({ ...newOpportunityInput(), title: 'Too many' }).ok, false);
  assert.equal(store.prepareBridge(JSON.stringify(bridge())).ok, false); assert.equal(port.getItem(key), before);
});
test('mixed batch new/version/unchanged is one transaction and reports exact counts', () => {
  const { store, port } = fixture(); ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(bridge(2)))), true));
  const doc = bridge(3); doc.items[0]!.analysis.summary = 'Changed'; const prepared = ok(store.prepareBridge(JSON.stringify(doc)));
  assert.deepEqual([prepared.preview.created, prepared.preview.updated, prepared.preview.unchanged], [1, 1, 1]);
  const writes = port.writes; ok(store.importBridge(prepared, true)); assert.equal(port.writes, writes + 1);
});
test('bridge parser retains original plain text and http/https links without executing them', () => {
  const doc = bridge(); doc.items[0]!.analysis.summary = '<script>alert(1)</script> **plain markdown**';
  doc.items[0]!.analysis.sourceLinks = ['http://example.com', 'https://example.org'];
  assert.deepEqual(parseBridge(JSON.stringify(doc)), doc);
});
test('invalid bridge is rejected before even settling an unrelated pending recovery journal', () => {
  const { store, port } = fixture(); ok(store.addCommand('Current')); const prepared = ok(store.prepareBridge(JSON.stringify(bridge())));
  const raw = port.getItem(key)!;
  const journal = JSON.stringify({ recoveryVersion: 1, snapshot: null, pending: { before: raw,
    after: JSON.stringify({ ...store.getSnapshot().data, revision: 99 }), candidate: { rawPrimary: raw, savedAt: '2026-01-01T00:00:00.000Z', appVersion: '0.3.0' } } });
  port.items.set(`${key}:recovery`, journal); const before = [...port.items];
  assert.equal(store.importBridge({ ...prepared, source: '{invalid' }, true).ok, false); assert.deepEqual([...port.items], before);
});
