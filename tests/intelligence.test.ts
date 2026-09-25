import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionDrift } from '../src/domain/decision-intelligence.ts';
import { attentionItems } from '../src/domain/attention.ts';
import { activityTarget, entityHref, recentWorkspace } from '../src/domain/workspace.ts';
import { parseRoute } from '../src/app/router.ts';
import { decisionInput } from '../src/domain/decisions.ts';
import { newOpportunityInput } from '../src/domain/opportunities.ts';
import { fixture, create, ok } from './decision-fixtures.ts';

test('one commit has no comparison; identical re-decision has no drift', () => {
  const { store } = fixture(); let d = create(store, true); const first = decisionDrift(d);
  assert.equal(first.versions, 1); assert.equal(first.latest, null);
  d = ok(store.transitionDecision(d.id, 'reopen', d.updatedAt)); d = ok(store.decideDecision(d.id, d.updatedAt));
  const before = JSON.stringify(d); const drift = decisionDrift(d);
  assert.equal(drift.versions, 2); assert.deepEqual(drift.latest?.changed, []); assert.deepEqual(drift.fromFirst?.changed, []); assert.equal(JSON.stringify(d), before);
});
for (const field of ['goal', 'reality', 'constraints', 'assumptions', 'rationale', 'biggestRisk', 'changeConditions', 'nextAction'] as const) {
  test(`drift names changed ${field} without rewriting history`, () => {
    const { store } = fixture(); let d = create(store, true); const history = JSON.stringify(d.commits[0]);
    d = ok(store.transitionDecision(d.id, 'reopen', d.updatedAt));
    d = ok(store.saveDecision({ ...decisionInput(d), [field]: 'Changed' }, d.id, d.updatedAt, true));
    assert.deepEqual(decisionDrift(d).latest?.changed, [field]); assert.equal(JSON.stringify(d.commits[0]), history);
  });
}
test('drift compares choice/options/criteria/scores/review date and first vs latest', () => {
  const { store } = fixture(); let d = create(store, true);
  d = ok(store.transitionDecision(d.id, 'reopen', d.updatedAt)); const input = decisionInput(d);
  input.selectedOptionId = input.options[0]!.id; input.options[0]!.title = 'Changed option';
  input.criteria = [{ id: 'c', title: 'Signal', weight: 1 }]; input.scores = input.options.map(o => ({ optionId: o.id, criterionId: 'c', score: 5 }));
  input.reviewAt = '2000-01-01T00:00:00.000Z';
  d = ok(store.saveDecision(input, d.id, d.updatedAt, true));
  assert.deepEqual(decisionDrift(d).latest?.changed, ['selectedOptionId', 'options', 'criteria', 'scores', 'reviewAt']);
  assert.equal(decisionDrift(d).reviewDue, true);
  d = ok(store.reviewDecision(d.id, { outcome: 'Checked', lessons: '', whatChanged: '', action: 'keep' }, d.updatedAt));
  assert.equal(decisionDrift(d).reviews, 1); assert.equal(decisionDrift(d).reviewDue, false);
  d = ok(store.transitionDecision(d.id, 'reopen', d.updatedAt)); d = ok(store.saveDecision({ ...decisionInput(d), nextAction: 'New step' }, d.id, d.updatedAt, true));
  assert.deepEqual(decisionDrift(d).latest?.changed, ['nextAction']); assert(decisionDrift(d).fromFirst?.changed.includes('options'));
});
test('Opportunity activity routes encode IDs and deleted entities stay unavailable', () => {
  const { store } = fixture(); const o = ok(store.saveOpportunity({ ...newOpportunityInput(), title: 'O' }));
  const data = store.getSnapshot().data; const activity = data.activity[0]!;
  assert.deepEqual(activityTarget(activity, data), { category: 'OPPORTUNITY', kind: 'link', href: `#/opportunities/${o.id}` });
  assert.deepEqual(parseRoute(entityHref('opportunity', 'a/b?# æ')), { page: 'opportunity', id: 'a/b?# æ' });
  ok(store.deleteOpportunity(o.id, o.updatedAt)); assert.deepEqual(activityTarget(activity, store.getSnapshot().data), { category: 'OPPORTUNITY', kind: 'unavailable' });
});
test('Fortsæt includes only current Opportunities, caps three and deterministically breaks ties', () => {
  const { store } = fixture();
  for (const status of ['inbox', 'active', 'candidate', 'parked', 'rejected', 'archived'] as const) ok(store.saveOpportunity({ ...newOpportunityInput(), title: status, status }));
  const data = structuredClone(store.getSnapshot().data);
  data.opportunities.forEach(o => { o.updatedAt = '2026-01-01T00:00:00.000Z'; });
  const recent = recentWorkspace(data); assert.equal(recent.length, 3);
  assert.deepEqual(recent.map(i => i.title).sort(), ['active', 'candidate', 'inbox']);
  data.opportunities.reverse(); assert.deepEqual(recentWorkspace(data), recent);
});
test('Attention is derived, due-first deterministic, includes inbox once and excludes inactive reviews', () => {
  const { store, port } = fixture(); let d = create(store, true); d = ok(store.transitionDecision(d.id, 'reopen', d.updatedAt));
  ok(store.saveDecision({ ...decisionInput(d), reviewAt: '2000-01-01T00:00:00.000Z' }, d.id, d.updatedAt, true));
  ok(store.saveOpportunity({ ...newOpportunityInput(), title: 'Due', reviewAt: '2001-01-01T00:00:00.000Z' }));
  ok(store.saveOpportunity({ ...newOpportunityInput(), title: 'Inbox' }));
  ok(store.saveOpportunity({ ...newOpportunityInput(), title: 'Hidden', status: 'rejected', reviewAt: '1999-01-01T00:00:00.000Z' }));
  const before = [...port.items]; const items = attentionItems(store.getSnapshot().data, Date.parse('2026-01-01'));
  assert.deepEqual(items.map(i => i.reason), ['decision-review', 'opportunity-review', 'opportunity-inbox']);
  assert.deepEqual([...port.items], before); assert(items.every(i => i.href.startsWith('#/')));
});
