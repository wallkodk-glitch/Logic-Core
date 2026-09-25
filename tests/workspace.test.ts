import test from 'node:test';
import assert from 'node:assert/strict';
import { activityTarget, entityHref, recentWorkspace } from '../src/domain/workspace.ts';
import { canDecide } from '../src/domain/decision-actions.ts';
import { parseRoute } from '../src/app/router.ts';
import { hasPendingWork, setPendingWork, subscribePendingWork } from '../src/app/pending-work.ts';
import type { Activity, AppData, Project } from '../src/domain/types.ts';
import { emptyData, SCHEMA_VERSION } from '../src/storage/schema.ts';
import { fixture, completeInput, create, ok, withScores } from './decision-fixtures.ts';
const at = '2026-09-20T00:00:00.000Z';
const project = (id: string, updatedAt = at): Project => ({ id, title: id, description: '', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt });
const event = (type: Activity['type'], refs: Partial<Activity> = {}): Activity => ({ id: 'event', type, text: 'Saved', createdAt: at, ...refs });

test('project activity resolves directly to the existing project', () => {
  const data = { ...emptyData(), projects: [project('project-1')] };
  assert.deepEqual(activityTarget(event('project.updated', { projectId: 'project-1' }), data), { category: 'PROJECT', kind: 'link', href: '#/projects/project-1' });
});
test('decision classification and navigation use decisionId, including mixed historical metadata', () => {
  const { store } = fixture(); const decision = create(store);
  assert.deepEqual(activityTarget(event('decision.decided', { projectId: 'gone', decisionId: decision.id }), store.getSnapshot().data),
    { category: 'DECISION', kind: 'link', href: entityHref('decision', decision.id) });
});
test('deleted project or decision remains history without a broken link', () => {
  for (const item of [event('project.deleted', { projectId: 'gone' }), event('decision.deleted', { decisionId: 'gone' })]) {
    const result = activityTarget(item, emptyData());
    assert.equal(result.kind, 'unavailable'); assert(!('href' in result));
  }
});
test('legacy events without reference ids are safely unavailable', () => {
  assert.deepEqual(activityTarget(event('project.created'), emptyData()), { category: 'PROJECT', kind: 'unavailable' });
});
test('command classification expands locally and cannot become an entity link', () => {
  assert.deepEqual(activityTarget(event('command', { projectId: 'also-present' }), { ...emptyData(), projects: [project('also-present')] }), { category: 'COMMAND', kind: 'expand' });
});
test('entity URLs encode imported IDs and resolve via actual project/decision routes', () => {
  for (const id of ['abc-123', 'valg æ', 'a/b?#c']) {
    for (const kind of ['project', 'decision'] as const) assert.deepEqual(parseRoute(entityHref(kind, id)), { page: kind, id });
  }
});
test('recent workspace merges types, sorts newest first and caps at three', () => {
  const { store } = fixture(); const decision = create(store);
  const data = structuredClone(store.getSnapshot().data);
  data.decisions[0]!.updatedAt = '2026-09-19T00:00:00.000Z';
  data.projects = [project('latest', at), project('older', '2026-09-18T00:00:00.000Z'), project('oldest', '2026-09-17T00:00:00.000Z')];
  const items = recentWorkspace(data);
  assert.deepEqual(items.map(item => item.key), ['project:latest', `decision:${decision.id}`, 'project:older']);
  assert.equal(items[1]?.href, entityHref('decision', decision.id));
});
test('recent ties are deterministic independent of input order or locale', () => {
  const { store } = fixture(); create(store);
  const data = structuredClone(store.getSnapshot().data);
  data.decisions[0]!.updatedAt = at; data.decisions[0]!.id = 'z';
  data.projects = [project('b'), project('a')];
  const first = recentWorkspace(data);
  data.projects.reverse();
  assert.deepEqual(recentWorkspace(data), first);
  assert.deepEqual(first.map(item => item.key), ['decision:z', 'project:a', 'project:b']);
});
test('recent workspace excludes archived/closed items and never reads deleted activity references', () => {
  const { store } = fixture(); let decision = create(store, true);
  decision = ok(store.transitionDecision(decision.id, 'close', decision.updatedAt));
  const data: AppData = { ...store.getSnapshot().data, projects: [{ ...project('archive'), status: 'archived' }], activity: [event('project.deleted', { projectId: 'ghost' })] };
  assert.deepEqual(recentWorkspace(data), []);
});
test('derived workspace and activity helpers never mutate migrated records', () => {
  const { store, port } = fixture(); create(store);
  const data = store.getSnapshot().data; const before = [...port.items];
  recentWorkspace(data); activityTarget(data.activity[0]!, data);
  assert.deepEqual([...port.items], before); assert.equal(SCHEMA_VERSION, 3);
});
test('decide visibility follows the existing validator; optional scoring and incomplete drafts retain their semantics', () => {
  const input = completeInput(); assert(canDecide(input));
  assert(!canDecide({ ...input, goal: '' }));
  const scored = withScores(); assert(canDecide(scored)); scored.scores.pop(); assert(!canDecide(scored));
  assert(!canDecide({ ...input, selectedOptionId: 'missing' }));
});
test('the same store save creates the immutable commit shown by the contextual action', () => {
  const { store } = fixture(); const input = completeInput(); assert(canDecide(input));
  const result = ok(store.saveDecision(input, undefined, undefined, true));
  assert.equal(result.status, 'decided'); assert.equal(result.commits.length, 1);
  assert.equal(result.commits[0]?.snapshot.selectedOptionId, input.selectedOptionId);
});
test('unsaved-work guard combines editors, releases owners and writes no persistent state', () => {
  const a = {}; const b = {}; let notices = 0;
  const unsubscribe = subscribePendingWork(() => notices++);
  assert(!hasPendingWork()); setPendingWork(a, true); setPendingWork(b, true); setPendingWork(a, false);
  assert(hasPendingWork()); setPendingWork(b, false); assert(!hasPendingWork());
  assert.equal(notices, 4); unsubscribe();
});
