import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionInput, DECISION_LIMITS, isReviewDue, newDecisionInput, reviewDateFromInput, reviewDateInput, weightedScore } from '../src/domain/decisions.ts';
import { validateData } from '../src/storage/schema.ts';
import { validateDecisionInput } from '../src/storage/decision-validation.ts';
import { AppStore } from '../src/storage/store.ts';
import { completeInput, create, fixture, key, ok, withScores } from './decision-fixtures.ts';

test('decision draft create/update/reload persists IDs and timestamps without a project', () => {
  const { store, port } = fixture(); const input = newDecisionInput(); input.title = 'Partial draft';
  const first = ok(store.saveDecision(input));
  assert.equal(first.status, 'draft'); assert.equal(first.commits.length, 0); assert.equal(first.selectedOptionId, undefined);
  const updated = ok(store.saveDecision({ ...decisionInput(first), goal: 'Clarify this later' }, first.id, first.updatedAt));
  assert.equal(updated.id, first.id); assert.equal(updated.createdAt, first.createdAt); assert(updated.updatedAt > first.updatedAt);
  assert.deepEqual(new AppStore(() => port, key).getSnapshot().data.decisions, [updated]);
  assert.equal(store.getSnapshot().data.activity[0]?.type, 'decision.updated');
  assert.equal(store.getSnapshot().data.activity[0]?.decisionId, first.id);
});
test('decision delete persists and keeps historical activity', () => {
  const { store, port } = fixture(); const decision = create(store);
  ok(store.deleteDecision(decision.id, decision.updatedAt));
  assert.equal(new AppStore(() => port, key).getSnapshot().data.decisions.length, 0);
  assert.equal(store.getSnapshot().data.activity[0]?.type, 'decision.deleted');
  assert.equal(store.getSnapshot().data.activity[0]?.decisionId, decision.id);
});
test('linked project deletion atomically unlinks a decided decision and preserves history', () => {
  const { store } = fixture(); const project = ok(store.saveProject({ title: 'Linked', description: '', status: 'active' }));
  const decision = ok(store.saveDecision({ ...completeInput(), linkedProjectId: project.id }, undefined, undefined, true));
  const commits = JSON.stringify(decision.commits);
  ok(store.deleteProject(project.id, project.updatedAt));
  const kept = store.getSnapshot().data.decisions[0]!;
  assert.equal(kept.linkedProjectId, undefined); assert.equal(kept.status, 'decided'); assert(kept.updatedAt > decision.updatedAt);
  assert.equal(JSON.stringify(kept.commits), commits); assert.equal(store.getSnapshot().data.projects.length, 0);
  assert.equal(store.transitionDecision(kept.id, 'reopen', decision.updatedAt).ok, false);
});
test('project deletion failure preserves project and decision link together', () => {
  const { store, port } = fixture(); const project = ok(store.saveProject({ title: 'Linked', description: '', status: 'active' }));
  ok(store.saveDecision({ ...completeInput(), linkedProjectId: project.id }));
  const before = port.getItem(key); port.failWrite = true;
  assert.equal(store.deleteProject(project.id, project.updatedAt).ok, false); assert.equal(port.getItem(key), before);
  assert.equal(store.getSnapshot().data.decisions[0]?.linkedProjectId, project.id);
});
test('dangling project link is rejected without mutation', () => {
  const { store, port } = fixture(); const before = [...port.items];
  assert.equal(store.saveDecision({ ...completeInput(), linkedProjectId: 'missing' }).ok, false);
  assert.deepEqual([...port.items], before);
});
test('decide snapshots all beliefs; reopen/edit/re-decide appends without rewriting history', () => {
  const { store } = fixture(); const first = create(store, true);
  const historical = JSON.stringify(first.commits);
  assert.equal(first.commits.length, 1); assert.deepEqual(first.commits[0]?.snapshot, decisionInput(first));
  assert.equal(store.saveDecision(decisionInput(first), first.id, first.updatedAt).ok, false);
  const reopened = ok(store.transitionDecision(first.id, 'reopen', first.updatedAt));
  const changed = ok(store.saveDecision({ ...decisionInput(reopened), reality: 'New evidence', goal: 'Changed goal' }, reopened.id, reopened.updatedAt));
  assert.equal(JSON.stringify(changed.commits), historical);
  const second = ok(store.decideDecision(changed.id, changed.updatedAt));
  assert.equal(second.commits.length, 2); assert.equal(JSON.stringify(second.commits.slice(0, 1)), historical);
  assert.equal(second.commits[1]?.snapshot.reality, 'New evidence');
  assert(second.commits[1]!.createdAt > second.commits[0]!.createdAt);
});
test('public snapshots and returned decisions cannot mutate committed history or current data', () => {
  const { store } = fixture(); const input = completeInput(); const decision = ok(store.saveDecision(input, undefined, undefined, true));
  input.options[0]!.title = 'External mutation';
  assert.notEqual(decision.options[0]!.title, input.options[0]!.title);
  assert.throws(() => Object.assign(decision.commits[0]!.snapshot, { goal: 'tampered' }), TypeError);
  assert.throws(() => decision.commits[0]!.snapshot.options.push(input.options[0]!), TypeError);
  assert.throws(() => store.getSnapshot().data.decisions.pop(), TypeError);
});
test('scoring never auto-selects the strongest option', () => {
  const { store } = fixture(); const input = withScores();
  assert.equal(weightedScore(input, input.options[0]!.id), 7.5);
  assert.equal(weightedScore(input, input.options[1]!.id), 2.5);
  const selected = input.selectedOptionId;
  const decision = ok(store.saveDecision(input, undefined, undefined, true));
  assert.equal(decision.selectedOptionId, selected); assert.equal(decision.commits[0]?.snapshot.selectedOptionId, selected);
});
test('no criteria is a valid committed decision and produces no numeric signal', () => {
  const { store } = fixture(); const decision = create(store, true);
  assert.equal(weightedScore(decision, decision.options[0]!.id), null);
  assert.equal(decision.criteria.length, 0); assert.equal(decision.scores.length, 0);
});
test('weighted score ties are valid and remain a human choice', () => {
  const { store } = fixture(); const input = withScores();
  input.scores = input.scores.map(score => ({ ...score, score: 7 }));
  const decision = ok(store.saveDecision(input, undefined, undefined, true));
  assert.equal(weightedScore(decision, decision.options[0]!.id), 7);
  assert.equal(weightedScore(decision, decision.options[1]!.id), 7);
});
test('incomplete scoring saves as draft but cannot be decided and has no partial total', () => {
  const { store, port } = fixture(); const input = withScores(); input.scores.pop();
  const draft = ok(store.saveDecision(input)); const before = port.getItem(key);
  assert.equal(weightedScore(draft, draft.options[1]!.id), null);
  assert.equal(store.decideDecision(draft.id, draft.updatedAt).ok, false); assert.equal(port.getItem(key), before);
});
test('invalid numeric weights/scores are not silently clamped or normalized', () => {
  for (const value of [0, 6, 1.5, NaN, Infinity]) {
    const input = withScores(); input.criteria[0]!.weight = value;
    assert.throws(() => validateDecisionInput(input));
    assert.equal(weightedScore(input, input.options[0]!.id), null);
  }
  for (const value of [0, 11, 3.5, NaN, Infinity]) {
    const input = withScores(); input.scores[0]!.score = value;
    assert.throws(() => validateDecisionInput(input));
    assert.equal(weightedScore(input, input.options[0]!.id), null);
  }
});
test('decide requirements are enforced without changing primary', () => {
  const mutations = [
    (input: ReturnType<typeof completeInput>) => { input.title = ' '; },
    (input: ReturnType<typeof completeInput>) => { input.goal = ''; },
    (input: ReturnType<typeof completeInput>) => { input.options = input.options.slice(1); },
    (input: ReturnType<typeof completeInput>) => { input.options[0]!.title = ''; },
    (input: ReturnType<typeof completeInput>) => { delete input.selectedOptionId; },
    (input: ReturnType<typeof completeInput>) => { input.rationale = ''; },
    (input: ReturnType<typeof completeInput>) => { input.nextAction = ''; },
  ];
  for (const change of mutations) {
    const { store, port } = fixture(); const input = completeInput(); change(input);
    assert.equal(store.saveDecision(input, undefined, undefined, true).ok, false); assert.equal(port.getItem(key), null);
  }
});
test('reviews append to the current commit; keep/reopen/re-decide/close preserve prior records', () => {
  const { store } = fixture(); let decision = create(store, true); const firstCommit = JSON.stringify(decision.commits[0]);
  decision = ok(store.reviewDecision(decision.id, { outcome: 'Still holds', whatChanged: '', lessons: 'Patience', action: 'keep' }, decision.updatedAt));
  const firstReview = JSON.stringify(decision.reviews[0]);
  assert.equal(decision.status, 'decided'); assert.equal(decision.reviews[0]?.commitId, decision.commits[0]?.id);
  decision = ok(store.reviewDecision(decision.id, { outcome: 'Conditions changed', whatChanged: 'New tools', lessons: '', action: 'reopen' }, decision.updatedAt));
  assert.equal(decision.status, 'draft'); assert.equal(decision.reviews.length, 2);
  decision = ok(store.decideDecision(decision.id, decision.updatedAt));
  decision = ok(store.reviewDecision(decision.id, { outcome: 'Done', whatChanged: '', lessons: 'Learned', action: 'close' }, decision.updatedAt));
  assert.equal(decision.status, 'closed'); assert.equal(decision.reviews.length, 3);
  assert.equal(decision.reviews[2]?.commitId, decision.commits[1]?.id);
  assert.equal(JSON.stringify(decision.commits[0]), firstCommit); assert.equal(JSON.stringify(decision.reviews[0]), firstReview);
});
test('close/archive/reopen transitions preserve history and enforce status requirements', () => {
  const { store } = fixture(); let decision = create(store);
  assert.equal(store.transitionDecision(decision.id, 'close', decision.updatedAt).ok, false);
  decision = ok(store.transitionDecision(decision.id, 'archive', decision.updatedAt)); assert.equal(decision.status, 'archived');
  decision = ok(store.transitionDecision(decision.id, 'reopen', decision.updatedAt));
  decision = ok(store.decideDecision(decision.id, decision.updatedAt));
  decision = ok(store.transitionDecision(decision.id, 'close', decision.updatedAt)); assert.equal(decision.status, 'closed');
  decision = ok(store.transitionDecision(decision.id, 'archive', decision.updatedAt)); assert.equal(decision.commits.length, 1);
  decision = ok(store.transitionDecision(decision.id, 'reopen', decision.updatedAt)); assert.equal(decision.status, 'draft');
});
test('review of a draft or empty review outcome fails without mutation', () => {
  const { store, port } = fixture(); let decision = create(store); let before = port.getItem(key);
  assert.equal(store.reviewDecision(decision.id, { outcome: 'Invalid phase', whatChanged: '', lessons: '', action: 'keep' }, decision.updatedAt).ok, false);
  assert.equal(port.getItem(key), before);
  decision = ok(store.decideDecision(decision.id, decision.updatedAt)); before = port.getItem(key);
  assert.equal(store.reviewDecision(decision.id, { outcome: ' ', whatChanged: '', lessons: '', action: 'keep' }, decision.updatedAt).ok, false);
  assert.equal(port.getItem(key), before);
});
test('all decision write paths reject stale editors and detect other tabs', () => {
  const { store, port } = fixture(); const first = create(store); const other = new AppStore(() => port, key);
  const newer = ok(store.saveDecision({ ...decisionInput(first), title: 'Newer' }, first.id, first.updatedAt));
  assert.equal(other.saveDecision(decisionInput(first), first.id, first.updatedAt).ok, false);
  assert.equal(other.getSnapshot().data.decisions[0]?.updatedAt, newer.updatedAt);
  const before = port.getItem(key);
  assert.equal(other.saveDecision(decisionInput(first), first.id, first.updatedAt).ok, false);
  assert.equal(other.decideDecision(first.id, first.updatedAt).ok, false);
  assert.equal(other.transitionDecision(first.id, 'archive', first.updatedAt).ok, false);
  assert.equal(other.reviewDecision(first.id, { outcome: 'Old', whatChanged: '', lessons: '', action: 'keep' }, first.updatedAt).ok, false);
  assert.equal(other.deleteDecision(first.id, first.updatedAt).ok, false);
  assert.equal(port.getItem(key), before);
});
test('failed decision writes never publish phantom commits or reviews', () => {
  const { store, port } = fixture(); let decision = create(store); const before = port.getItem(key);
  port.failWrite = true;
  assert.equal(store.decideDecision(decision.id, decision.updatedAt).ok, false);
  assert.equal(port.getItem(key), before); assert.equal(store.getSnapshot().data.decisions[0]?.commits.length, 0);
  port.failWrite = false; decision = ok(store.decideDecision(decision.id, decision.updatedAt)); port.failWrite = true;
  assert.equal(store.reviewDecision(decision.id, { outcome: 'No write', whatChanged: '', lessons: '', action: 'reopen' }, decision.updatedAt).ok, false);
  assert.equal(store.getSnapshot().data.decisions[0]?.status, 'decided'); assert.equal(store.getSnapshot().data.decisions[0]?.reviews.length, 0);
});
test('review due is derived from timestamp/status and a review of the same commit', () => {
  const { store } = fixture(); let decision = ok(store.saveDecision({ ...completeInput(), reviewAt: '2020-01-01T23:59:59.999Z' }, undefined, undefined, true));
  assert(isReviewDue(decision)); assert(!Object.hasOwn(decision, 'reviewDue'));
  assert(!isReviewDue(decision, Date.parse('2019-01-01T00:00:00.000Z')));
  decision = ok(store.reviewDecision(decision.id, { outcome: 'Reviewed', whatChanged: '', lessons: '', action: 'keep' }, decision.updatedAt));
  assert(!isReviewDue(decision));
  decision = ok(store.transitionDecision(decision.id, 'reopen', decision.updatedAt)); assert(!isReviewDue(decision));
  decision = ok(store.decideDecision(decision.id, decision.updatedAt)); assert(isReviewDue(decision));
});
test('review date input round-trips in device timezone and rejects rolled-over dates', () => {
  const iso = reviewDateFromInput('2026-09-19'); assert(iso); assert.equal(reviewDateInput(iso), '2026-09-19');
  assert.equal(reviewDateFromInput(''), undefined); assert.equal(reviewDateInput(undefined), '');
  assert.throws(() => reviewDateFromInput('2026-02-30')); assert.throws(() => reviewDateFromInput('tomorrow'));
});
test('decision/option/criterion/text limits are enforced', () => {
  const input = completeInput(); input.options = Array.from({ length: DECISION_LIMITS.options + 1 }, (_, index) => ({ ...input.options[0]!, id: `option-${index}` }));
  assert.throws(() => validateDecisionInput(input));
  const criteria = withScores(); criteria.criteria = Array.from({ length: DECISION_LIMITS.criteria + 1 }, (_, index) => ({ id: `criterion-${index}`, title: 'C', weight: 1 }));
  assert.throws(() => validateDecisionInput(criteria));
  assert.throws(() => validateDecisionInput({ ...completeInput(), goal: 'a'.repeat(4001) }));
  const { store } = fixture(); const decision = create(store); const data = structuredClone(store.getSnapshot().data);
  data.decisions = Array.from({ length: 101 }, (_, index) => ({ ...structuredClone(decision), id: `decision-${index}` }));
  assert.throws(() => validateData(data));
});

test('history bounds reject new records without dropping the oldest snapshot or review', () => {
  const { store, port } = fixture(); let decision = create(store, true);
  for (let i = 1; i < DECISION_LIMITS.commits; i++) {
    decision = ok(store.transitionDecision(decision.id, 'reopen', decision.updatedAt));
    decision = ok(store.decideDecision(decision.id, decision.updatedAt));
  }
  decision = ok(store.transitionDecision(decision.id, 'reopen', decision.updatedAt));
  const before = port.getItem(key);
  assert.equal(store.decideDecision(decision.id, decision.updatedAt).ok, false);
  assert.equal(port.getItem(key), before); assert.equal(decision.commits.length, 50);
  let reviewed = create(store, true);
  for (let i = 0; i < DECISION_LIMITS.reviews; i++) {
    reviewed = ok(store.reviewDecision(reviewed.id, { outcome: `Review ${i}`, whatChanged: '', lessons: '', action: 'keep' }, reviewed.updatedAt));
  }
  const reviewedBefore = port.getItem(key);
  assert.equal(store.reviewDecision(reviewed.id, { outcome: 'Too many', whatChanged: '', lessons: '', action: 'keep' }, reviewed.updatedAt).ok, false);
  assert.equal(port.getItem(key), reviewedBefore); assert.equal(reviewed.reviews[0]?.outcome, 'Review 0');
});
test('decision activity stays bounded at 300 records', () => {
  const { store } = fixture(); let decision = create(store);
  for (let i = 0; i < 305; i++) decision = ok(store.saveDecision(decisionInput(decision), decision.id, decision.updatedAt));
  assert.equal(store.getSnapshot().data.activity.length, 300);
});
test('decision history deletion is explicit, complete and atomic on failure', () => {
  const { store, port } = fixture(); let decision = create(store, true);
  decision = ok(store.reviewDecision(decision.id, { outcome: 'Keep', whatChanged: '', lessons: '', action: 'keep' }, decision.updatedAt));
  const before = port.getItem(key); port.failWrite = true;
  assert.equal(store.deleteDecision(decision.id, decision.updatedAt).ok, false); assert.equal(port.getItem(key), before);
  port.failWrite = false; ok(store.deleteDecision(decision.id, decision.updatedAt));
  assert.equal(store.getSnapshot().data.decisions.length, 0); assert.equal(store.getSnapshot().data.activity[0]?.type, 'decision.deleted');
});
test('import cannot attach later reviews to obsolete commits or continue after a closing review', () => {
  const { store } = fixture(); let decision = create(store, true);
  decision = ok(store.reviewDecision(decision.id, { outcome: 'Reconsider', whatChanged: '', lessons: '', action: 'reopen' }, decision.updatedAt));
  decision = ok(store.decideDecision(decision.id, decision.updatedAt));
  decision = ok(store.reviewDecision(decision.id, { outcome: 'Current', whatChanged: '', lessons: '', action: 'keep' }, decision.updatedAt));
  const data = structuredClone(store.getSnapshot().data);
  Object.assign(data.decisions[0]!.reviews[1]!, { commitId: decision.commits[0]!.id });
  assert.throws(() => validateData(data));
  const closed = structuredClone(store.getSnapshot().data);
  Object.assign(closed.decisions[0]!.reviews[1]!, { action: 'close' });
  assert.throws(() => validateData(closed));
  closed.decisions[0]!.status = 'closed'; assert.doesNotThrow(() => validateData(closed));
});
