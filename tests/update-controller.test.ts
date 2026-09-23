import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateController, UPDATE_REPLY } from '../src/pwa/update-controller.ts';
import type { ActivationState, UpdateWorker } from '../src/pwa/update-controller.ts';

function setup() {
  let dirty = false; let controller: object | null = {}; let reloads = 0; let sends = 0; let closes = 0;
  let throwOnSend = false;
  const listeners = new Set<() => void>(); const timers = new Set<() => void>();
  const replies: ((data: unknown) => void)[] = []; const states: ActivationState[] = [];
  const worker: UpdateWorker = { postMessage() {} };
  const updater = createUpdateController({
    hasUnsaved: () => dirty,
    currentController: () => controller,
    onControllerChange: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    send: (_, reply) => { sends++; if (throwOnSend) throw new Error('closed'); replies.push(reply); return () => { closes++; }; },
    after: (ms, callback) => { assert.equal(ms, 8000); timers.add(callback); return () => { timers.delete(callback); }; },
    publish: state => { states.push(state); }, reload: () => { reloads++; },
  });
  return {
    request: () => updater.request(worker), withoutWorker: () => updater.request(null),
    dirty: () => { dirty = true; }, throwOnSend: () => { throwOnSend = true; },
    change: () => { controller = {}; [...listeners].forEach(fn => fn()); },
    ack: (ok = true, index = replies.length - 1) => replies[index]?.({ type: UPDATE_REPLY, ok }),
    wrongReply: () => replies.at(-1)?.({ type: 'something-else', ok: true }),
    timeout: () => [...timers].forEach(fn => fn()),
    get last() { return states.at(-1); }, get reloads() { return reloads; }, get sends() { return sends; },
    get listeners() { return listeners.size; }, get timers() { return timers.size; }, get closes() { return closes; },
  };
}
test('controllerchange without user intent never reloads', () => {
  const h = setup(); h.change(); assert.equal(h.reloads, 0);
});
test('unsaved input blocks activation before any message is sent', () => {
  const h = setup(); h.dirty(); h.request(); assert.equal(h.sends, 0); assert.equal(h.last?.phase, 'blocked');
});
test('missing waiting worker provides guidance without a reload', () => {
  const h = setup(); h.withoutWorker(); assert.equal(h.last?.phase, 'manual'); assert.equal(h.reloads, 0);
});
test('explicit update needs acknowledgement AND controllerchange and reloads exactly once', () => {
  const h = setup(); h.request(); assert.equal(h.last?.phase, 'requesting');
  h.ack(); assert.equal(h.reloads, 0); h.change(); h.change(); h.ack();
  assert.equal(h.reloads, 1); assert.equal(h.last?.phase, 'reloading');
  assert.equal(h.listeners, 0); assert.equal(h.timers, 0); assert.equal(h.closes, 1);
});
test('controllerchange arriving before acknowledgement is safely handled', () => {
  const h = setup(); h.request(); h.change(); assert.equal(h.reloads, 0); h.ack(); assert.equal(h.reloads, 1);
});
test('other open windows refuse activation and late events do not reload', () => {
  const h = setup(); h.request(); h.ack(false); h.change();
  assert.equal(h.last?.phase, 'blocked'); assert.equal(h.reloads, 0); assert.equal(h.listeners, 0);
});
test('legacy worker without message support times out to manual guidance', () => {
  const h = setup(); h.request(); h.timeout(); h.ack(); h.change();
  assert.equal(h.last?.phase, 'manual'); assert.equal(h.reloads, 0); assert.equal(h.closes, 1);
});
test('incorrect acknowledgement cannot authorize a reload', () => {
  const h = setup(); h.request(); h.wrongReply(); h.change(); h.timeout(); assert.equal(h.reloads, 0);
});
test('message failure cleans up and leaves a usable recovery state', () => {
  const h = setup(); h.throwOnSend(); h.request();
  assert.equal(h.last?.phase, 'error'); assert.equal(h.listeners, 0); assert.equal(h.timers, 0);
});
test('a dirty state discovered after request prevents reload even after activation', () => {
  const h = setup(); h.request(); h.ack(); h.dirty(); h.change();
  assert.equal(h.reloads, 0); assert.equal(h.last?.phase, 'blocked');
});
test('repeated taps are deduplicated and an expired reply cannot authorize a later request', () => {
  const h = setup(); h.request(); h.request(); assert.equal(h.sends, 1);
  h.timeout(); h.request(); assert.equal(h.sends, 2);
  h.ack(true, 0); h.change(); assert.equal(h.reloads, 0);
  h.ack(true, 1); assert.equal(h.reloads, 1);
});
