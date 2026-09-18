import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/storage/store.ts';
import type { StoragePort } from '../src/storage/store.ts';
import { ACTIVITY_LIMIT, emptyData, parseData } from '../src/storage/schema.ts';
import { PROJECT_STATUSES } from '../src/domain/types.ts';
import type { Project } from '../src/domain/types.ts';

class MemoryStorage implements StoragePort {
  items = new Map<string, string>();
  failWrite = false;
  getItem(key: string) { return this.items.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failWrite) throw new DOMException('full', 'QuotaExceededError');
    this.items.set(key, value);
  }
  removeItem(key: string) { this.items.delete(key); }
}
const key = 'logic-core:/test/:data';
function fixture() {
  const port = new MemoryStorage();
  const store = new AppStore(() => port, key);
  return { port, store };
}
function create(store: AppStore): Project {
  const result = store.saveProject({ title: '  Testprojekt  ', description: 'En beskrivelse', status: 'active' });
  assert(result.ok);
  return result.value;
}

test('empty storage loads without creating or overwriting any data', () => {
  const { store, port } = fixture();
  assert.deepEqual(store.getSnapshot().data, emptyData());
  assert.equal(port.items.size, 0);
});

test('create → close store → reopen preserves project, ID, dates and activity', () => {
  const { store, port } = fixture();
  const project = create(store);
  assert.equal(project.title, 'Testprojekt');
  assert.match(project.id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
  const reopened = new AppStore(() => port, key);
  assert.deepEqual(reopened.getSnapshot().data.projects, [project]);
  assert.equal(reopened.getSnapshot().data.activity[0]?.type, 'project.created');
  assert.equal(reopened.getSnapshot().data.revision, 1);
});

test('all six statuses can be saved; edits preserve identity and creation time', () => {
  const { store } = fixture();
  let project = create(store);
  const original = { ...project };
  for (const status of PROJECT_STATUSES) {
    const result = store.saveProject({ title: 'Opdateret', description: 'Ændret', status }, project.id, project.updatedAt);
    assert(result.ok);
    assert.equal(result.value.id, original.id);
    assert.equal(result.value.createdAt, original.createdAt);
    assert(result.value.updatedAt > project.updatedAt);
    assert.equal(result.value.status, status);
    project = result.value;
  }
  assert.equal(store.getSnapshot().data.projects.length, 1);
});

test('delete persists and preserves an activity entry', () => {
  const { port, store } = fixture();
  const project = create(store);
  assert(store.deleteProject(project.id, project.updatedAt).ok);
  const reopened = new AppStore(() => port, key);
  assert.equal(reopened.getSnapshot().data.projects.length, 0);
  assert.equal(reopened.getSnapshot().data.activity[0]?.type, 'project.deleted');
});

test('invalid input does not mutate data or increment revision', () => {
  const { store, port } = fixture();
  create(store);
  const before = port.getItem(key);
  assert.equal(store.saveProject({ title: ' ', description: '', status: 'active' }).ok, false);
  assert.equal(store.saveProject({ title: 'x'.repeat(121), description: '', status: 'active' }).ok, false);
  assert.equal(store.addCommand(' ').ok, false);
  assert.equal(store.addCommand('x'.repeat(4001)).ok, false);
  assert.equal(port.getItem(key), before);
});

test('quota failure keeps both the disk and visible data unchanged', () => {
  const { store, port } = fixture();
  const project = create(store);
  const before = port.getItem(key);
  const snapshot = store.getSnapshot().data;
  port.failWrite = true;
  const result = store.deleteProject(project.id, project.updatedAt);
  assert.equal(result.ok, false);
  assert.equal(port.getItem(key), before);
  assert.deepEqual(store.getSnapshot().data, snapshot);
  assert.match(store.getSnapshot().error ?? '', /fyldt/);
  port.failWrite = false;
  assert(store.deleteProject(project.id, project.updatedAt).ok);
});

test('corrupt data remains untouched and can be exported for recovery', () => {
  const { port } = fixture();
  port.setItem(key, '{broken-json');
  const store = new AppStore(() => port, key);
  assert(store.getSnapshot().error);
  assert.equal(store.addCommand('Never overwrite').ok, false);
  assert.equal(port.getItem(key), '{broken-json');
  const exported = store.exportData('0.1.0');
  assert(exported.ok);
  assert.equal(JSON.parse(exported.value).rawData, '{broken-json');
});

test('future schemas block writes instead of downgrading data', () => {
  const { port } = fixture();
  const raw = JSON.stringify({ schemaVersion: 2, future: 'preserve me' });
  port.setItem(key, raw);
  const store = new AppStore(() => port, key);
  assert.match(store.getSnapshot().error ?? '', /nyere/);
  assert.equal(store.addCommand('No downgrade').ok, false);
  assert.equal(port.getItem(key), raw);
});

test('v1 validation rejects duplicate IDs, bad dates and missing required fields', () => {
  const { store } = fixture();
  const project = create(store);
  assert.throws(() => parseData(JSON.stringify({ ...emptyData(), projects: [project, project] })));
  assert.throws(() => parseData(JSON.stringify({ ...emptyData(), projects: [{ ...project, status: 'unknown' }] })));
  assert.throws(() => parseData(JSON.stringify({ ...emptyData(), projects: [{ ...project, createdAt: 'invalid' }] })));
  assert.throws(() => parseData('{}'));
});

test('diagnostics uses a disposable key and never changes user or unrelated data', () => {
  const { store, port } = fixture();
  create(store); port.setItem('unrelated', 'untouched');
  const before = [...port.items.entries()];
  assert.equal(store.probe().roundTrip, true);
  assert.deepEqual([...port.items.entries()], before);
  port.failWrite = true;
  assert.equal(store.probe().roundTrip, false);
  assert.deepEqual([...port.items.entries()], before);
});

test('blocked storage renders a recoverable error instead of throwing at startup', () => {
  const store = new AppStore(() => { throw new DOMException('blocked', 'SecurityError'); }, key);
  assert(store.getSnapshot().error);
  assert.equal(store.probe().available, false);
  assert.equal(store.exportData('0.1.0').ok, false);
  assert.equal(store.addCommand('test').ok, false);
});

test('stale tab detects another write; stale editor cannot overwrite a newer edit', () => {
  const { store, port } = fixture();
  const project = create(store);
  const other = new AppStore(() => port, key);
  assert(store.saveProject({ ...project, title: 'Nyere titel' }, project.id, project.updatedAt).ok);
  assert.equal(other.saveProject({ ...project, title: 'Gammel titel' }, project.id, project.updatedAt).ok, false);
  assert.equal(other.getSnapshot().data.projects[0]?.title, 'Nyere titel');
  assert.equal(other.saveProject({ ...project, title: 'Gammel titel' }, project.id, project.updatedAt).ok, false);
  assert.equal(other.deleteProject(project.id, project.updatedAt).ok, false);
  assert.equal(JSON.parse(port.getItem(key)!).projects[0].title, 'Nyere titel');
});

test('command events persist and bound the activity log without dropping projects', () => {
  const { store, port } = fixture();
  const project = create(store);
  for (let i = 0; i <= ACTIVITY_LIMIT; i++) assert(store.addCommand(`Kommando ${i}`).ok);
  const reopened = new AppStore(() => port, key);
  assert.equal(reopened.getSnapshot().data.activity.length, ACTIVITY_LIMIT);
  assert.equal(reopened.getSnapshot().data.activity[0]?.text, `Kommando ${ACTIVITY_LIMIT}`);
  assert.deepEqual(reopened.getSnapshot().data.projects, [project]);
});

test('JSON export is parseable and includes the latest stored version', () => {
  const { store, port } = fixture();
  const other = new AppStore(() => port, key);
  const project = create(store);
  const result = other.exportData('0.1.0');
  assert(result.ok);
  const exported = JSON.parse(result.value);
  assert.equal(exported.appVersion, '0.1.0');
  assert.deepEqual(exported.data.projects, [project]);
});
