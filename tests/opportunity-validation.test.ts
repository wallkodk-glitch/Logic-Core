import test from 'node:test';
import assert from 'node:assert/strict';
import type { AppData } from '../src/domain/types.ts';
import { OPPORTUNITY_LIMITS as L } from '../src/domain/opportunities.ts';
import { validateData } from '../src/storage/schema.ts';
import { fixture, ok } from './decision-fixtures.ts';
import { bridge } from './opportunity-fixtures.ts';

function imported() {
  const f = fixture(); ok(f.store.importBridge(ok(f.store.prepareBridge(JSON.stringify(bridge()))), true)); return f;
}
const malformed: [string, (data: AppData) => void][] = [
  ['unknown property', d => { Object.assign(d.opportunities[0]!, { arbitrary: {} }); }],
  ['invalid status', d => { Object.assign(d.opportunities[0]!, { status: 'accepted' }); }],
  ['blank ID', d => { d.opportunities[0]!.id = ' '; }],
  ['numeric ID', d => { Object.assign(d.opportunities[0]!, { id: 2 }); }],
  ['reserved new ID', d => { d.opportunities[0]!.id = 'new'; }],
  ['reserved import ID', d => { d.opportunities[0]!.id = 'import'; }],
  ['duplicate IDs', d => { d.opportunities.push(structuredClone(d.opportunities[0]!)); }],
  ['duplicate bridgeKey', d => { d.opportunities.push({ ...structuredClone(d.opportunities[0]!), id: 'other' }); }],
  ['invalid bridgeKey', d => { d.opportunities[0]!.bridgeKey = 'Bad Key'; }],
  ['dangling project', d => { d.opportunities[0]!.linkedProjectIds = ['missing']; }],
  ['dangling decision', d => { d.opportunities[0]!.linkedDecisionIds = ['missing']; }],
  ['duplicate project refs', d => { d.opportunities[0]!.linkedProjectIds = ['same', 'same']; }],
  ['duplicate decision refs', d => { d.opportunities[0]!.linkedDecisionIds = ['same', 'same']; }],
  ['excess project links', d => { d.opportunities[0]!.linkedProjectIds = Array.from({ length: 11 }, (_, i) => `p${i}`); }],
  ['excess decision links', d => { d.opportunities[0]!.linkedDecisionIds = Array.from({ length: 11 }, (_, i) => `d${i}`); }],
  ['excess tags', d => { d.opportunities[0]!.tags = Array.from({ length: 13 }, (_, i) => `tag${i}`); }],
  ['duplicate tags', d => { d.opportunities[0]!.tags = ['AI', 'AI']; }],
  ['long tag', d => { d.opportunities[0]!.tags = ['x'.repeat(33)]; }],
  ['empty tag', d => { d.opportunities[0]!.tags = ['']; }],
  ['long title', d => { d.opportunities[0]!.title = 'x'.repeat(121); }],
  ['long domain', d => { d.opportunities[0]!.domain = 'x'.repeat(65); }],
  ['long notes', d => { d.opportunities[0]!.notes = 'x'.repeat(4001); }],
  ['long action', d => { d.opportunities[0]!.nextAction = 'x'.repeat(2001); }],
  ['fractional evaluation', d => { d.opportunities[0]!.evaluation.upside = 2.5; }],
  ['zero evaluation', d => { d.opportunities[0]!.evaluation.confidence = 0; }],
  ['high risk', d => { d.opportunities[0]!.evaluation.downsideRisk = 6; }],
  ['unknown evaluation', d => { Object.assign(d.opportunities[0]!.evaluation, { profit: 5 }); }],
  ['invalid date', d => { d.opportunities[0]!.reviewAt = '2026-02-30T00:00:00.000Z'; }],
  ['reversed timestamps', d => { d.opportunities[0]!.updatedAt = '2000-01-01T00:00:00.000Z'; }],
  ['partial snapshot', d => { Reflect.deleteProperty(d.opportunities[0]!.sourceSnapshots[0]!, 'payload'); }],
  ['snapshot without bridgeKey', d => { delete d.opportunities[0]!.bridgeKey; }],
  ['bridgeKey without snapshots', d => { d.opportunities[0]!.sourceSnapshots = []; }],
  ['mismatched source key', d => { d.opportunities[0]!.sourceSnapshots[0]!.payload.bridgeKey = 'another'; }],
  ['mismatched source date', d => { d.opportunities[0]!.sourceSnapshots[0]!.payload.generatedAt = '2020-01-01T00:00:00.000Z'; }],
  ['mismatched source run', d => { d.opportunities[0]!.sourceSnapshots[0]!.payload.sourceRunId = 'different'; }],
  ['duplicate snapshot ID', d => { d.opportunities[0]!.sourceSnapshots.push(structuredClone(d.opportunities[0]!.sourceSnapshots[0]!)); }],
  ['snapshot before creation', d => { Object.assign(d.opportunities[0]!.sourceSnapshots[0]!, { importedAt: '2000-01-01T00:00:00.000Z' }); }],
  ['long source title', d => { d.opportunities[0]!.sourceSnapshots[0]!.payload.analysis.title = 'x'.repeat(121); }],
  ['oversized snapshot', d => { const a = d.opportunities[0]!.sourceSnapshots[0]!.payload.analysis; a.summary = '😀'.repeat(1000); a.thesis = a.summary; a.upside = a.summary; a.downside = a.summary; a.whyNow = a.summary; }],
  ['too many snapshots', d => { d.opportunities[0]!.sourceSnapshots = Array.from({ length: 9 }, (_, i) => ({ ...structuredClone(d.opportunities[0]!.sourceSnapshots[0]!), id: `s${i}` })); }],
  ['too many opportunities', d => { d.opportunities = Array.from({ length: 51 }, (_, i) => ({ ...structuredClone(d.opportunities[0]!), id: `o${i}`, bridgeKey: `key:${i}` })); }],
  ['opportunity activity without reference', d => { delete d.activity[0]!.opportunityId; }],
];
for (const [name, mutate] of malformed) test(`invalid Opportunity ${name} blocks restore before any primary/recovery mutation`, () => {
  const { store, port } = imported(); const data = structuredClone(store.getSnapshot().data); const valid = JSON.stringify({ ...data, revision: data.revision + 1 });
  ok(store.restoreBackup(ok(store.prepareImport(valid)), '0.3.0'));
  const prepared = ok(store.prepareImport(JSON.stringify(data))); mutate(data); const before = [...port.items];
  assert.throws(() => validateData(data)); assert.equal(store.prepareImport(JSON.stringify(data)).ok, false);
  assert.equal(store.restoreBackup({ ...prepared, source: JSON.stringify(data) }, '0.3.0').ok, false); assert.deepEqual([...port.items], before);
});
test('Opportunity collection byte cap rejects otherwise valid records before write', () => {
  const { store, port } = fixture(); const doc = bridge();
  doc.items[0]!.analysis.summary = 's'.repeat(2000); doc.items[0]!.analysis.thesis = 't'.repeat(2000); doc.items[0]!.analysis.upside = 'u'.repeat(2000);
  for (let i = 0; i < 7; i++) {
    doc.items[0]!.bridgeKey = `key:${i}`;
    ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true));
    for (let j = 1; j < 8; j++) { doc.items[0]!.analysis.nextTest = `test ${j}`; ok(store.importBridge(ok(store.prepareBridge(JSON.stringify(doc))), true)); }
  }
  const data = structuredClone(store.getSnapshot().data);
  // Keep all IDs/keys/timestamps/references valid while repeating bounded records.
  const seed = data.opportunities[0]!;
  data.opportunities = Array.from({ length: 30 }, (_, i) => {
    const o = structuredClone(seed); o.id = `opp:${i}`; o.bridgeKey = `key:${i}`;
    o.sourceSnapshots.forEach((s, j) => { Object.assign(s, { id: `snap:${i}:${j}` }); s.payload.bridgeKey = o.bridgeKey!; }); return o;
  });
  assert(new TextEncoder().encode(JSON.stringify(data.opportunities)).byteLength > L.collectionBytes);
  const before = [...port.items]; assert.equal(store.prepareImport(JSON.stringify(data)).ok, false); assert.deepEqual([...port.items], before);
});
