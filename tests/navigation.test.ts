import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigationGuard } from '../src/app/navigation-guard.ts';
import { hasPendingWork, setPendingWork } from '../src/app/pending-work.ts';

function harness() {
  let hash = '#/'; let accept = false; let prompts = 0; const published: string[] = []; const replaced: string[] = [];
  const guard = createNavigationGuard({ read: () => hash, write: next => { hash = next; }, replace: next => { hash = next; replaced.push(next); },
    dirty: hasPendingWork, confirm: () => { prompts++; return accept; }, publish: next => published.push(next) });
  return { guard, get hash() { return hash; }, get prompts() { return prompts; }, published, replaced,
    accept: () => { accept = true; }, external: (next: string) => { hash = next; guard.changed(); } };
}
for (const ownerName of ['command', 'project', 'decision', 'review', 'opportunity', 'bridge-preview', 'backup-preview']) test(`dirty ${ownerName} cancels internal/back navigation and retains accepted route`, () => {
  const h = harness(); const owner = { ownerName }; setPendingWork(owner, true);
  try {
    assert.equal(h.guard.go('#/projects'), false); assert.equal(h.hash, '#/'); assert.equal(h.guard.snapshot(), '#/');
    h.external('#/more'); assert.equal(h.hash, '#/'); assert.equal(h.guard.snapshot(), '#/'); assert.deepEqual(h.published, []);
  } finally { setPendingWork(owner, false); }
});
test('clean navigation publishes once and hashchange does not double prompt', () => {
  const h = harness(); assert(h.guard.go('#/projects')); h.guard.changed();
  assert.deepEqual(h.published, ['#/projects']); assert.equal(h.prompts, 0);
});
test('confirmed departure prompts once, same-route navigation never prompts and later work remains protected', () => {
  const h = harness(); const owner = {}; setPendingWork(owner, true);
  try {
    assert(h.guard.go('#/')); assert.equal(h.prompts, 0);
    h.accept(); assert(h.guard.go('#/decisions')); h.guard.changed(); assert.equal(h.prompts, 1);
    assert.equal(h.guard.snapshot(), '#/decisions'); assert(hasPendingWork()); // no global dirty reset
    h.external('#/'); assert.equal(h.prompts, 2); assert.equal(h.guard.snapshot(), '#/');
  } finally { setPendingWork(owner, false); }
});
