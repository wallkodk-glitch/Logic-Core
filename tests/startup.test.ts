import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Execute the actual standalone inline script without React or the main bundle.
const html = readFileSync('index.html', 'utf8');
const code = html.match(/<script id="logic-core-startup">([\s\S]*?)<\/script>/)![1]!.replaceAll('%BASE_URL%', '/Logic-Core/');
type EventHandler = (event: { type: string; error?: Error; target?: { tagName: string } }) => void;
function startup(options: { online?: boolean; supported?: boolean; registered?: boolean; hang?: boolean; fail?: boolean } = {}) {
  const nodes = new Map<string, { hidden: boolean; disabled: boolean; textContent: string; click?: () => Promise<void> | void; addEventListener(type: string, handler: () => Promise<void> | void): void }>();
  for (const id of ['startup-screen', 'startup-title', 'startup-status', 'startup-recovery', 'startup-reload', 'startup-update']) {
    nodes.set(id, { hidden: true, disabled: false, textContent: '', addEventListener(_type, handler) { this.click = handler; } });
  }
  nodes.get('startup-screen')!.hidden = false;
  let sequence = 0; let reloads = 0; let updates = 0; let storageTouches = 0;
  const timers = new Map<number, { delay: number; action: () => void }>();
  const listeners = new Map<string, Set<EventHandler>>();
  const win = {
    location: { origin: 'https://example.com', reload() { reloads++; } },
    setTimeout(action: () => void, delay: number) { timers.set(++sequence, { action, delay }); return sequence; },
    clearTimeout(id: number) { timers.delete(id); },
    addEventListener(type: string, handler: EventHandler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(handler); },
    removeEventListener(type: string, handler: EventHandler) { listeners.get(type)?.delete(handler); },
    get localStorage(): never { storageTouches++; throw new Error('Startup must not access storage'); },
  };
  const serviceWorker = { async getRegistration(scope: string) {
    assert.equal(scope, 'https://example.com/Logic-Core/');
    if (options.registered === false) return undefined;
    return { async update() { updates++; if (options.fail) throw new Error('network'); if (options.hang) await new Promise(() => {}); } };
  } };
  runInNewContext(code, { window: win, document: { getElementById(id: string) { return nodes.get(id); } },
    navigator: { onLine: options.online ?? true, ...(options.supported === false ? {} : { serviceWorker }) }, URL });
  return {
    node: (id: string) => nodes.get(`startup-${id}`)!, timers,
    fire(type: string, extra: Partial<Parameters<EventHandler>[0]> = {}) { listeners.get(type)?.forEach(listener => listener({ type, ...extra })); },
    tick(delay: number) { for (const [id, timer] of timers) if (timer.delay === delay) { timers.delete(id); timer.action(); } },
    get reloads() { return reloads; }, get updates() { return updates; }, get storageTouches() { return storageTouches; },
  };
}

test('startup timeout exposes independent accessible recovery without loading React', () => {
  const s = startup(); assert.equal(s.node('recovery').hidden, true); s.tick(12000);
  assert.equal(s.node('recovery').hidden, false); assert.match(s.node('title').textContent, /kunne ikke starte/);
  assert.equal(s.reloads, 0); assert.equal(s.storageTouches, 0);
  assert.match(html, /id="startup-status" role="status"/); assert.match(html, /sletter eller nulstiller ikke/);
});
test('failed module loading and unhandled rejection reveal recovery early', () => {
  for (const kind of ['script', 'runtime', 'rejection']) {
    const s = startup();
    if (kind === 'script') s.fire('error', { target: { tagName: 'SCRIPT' } });
    if (kind === 'runtime') s.fire('error', { error: new Error('bundle failed') });
    if (kind === 'rejection') s.fire('unhandledrejection');
    assert.equal(s.node('recovery').hidden, false); assert.equal(s.storageTouches, 0);
  }
});
test('successful React mount cancels startup recovery and its error listeners', () => {
  const s = startup(); s.fire('logic-core:mounted'); s.tick(12000); s.fire('error', { error: new Error('later') });
  assert.equal(s.node('recovery').hidden, true); assert.equal(s.node('screen').hidden, true); assert.equal(s.timers.size, 0);
  // The guard is outside React's root, so a failed/partial root render cannot remove it.
  assert.match(html, /<\/main>\s*<div id="root"><\/div>/);
});
test('reload only happens after the explicit recovery button', async () => {
  const s = startup(); s.tick(12000); assert.equal(s.reloads, 0); await s.node('reload').click!();
  assert.equal(s.reloads, 1); assert.equal(s.storageTouches, 0);
});
test('startup update checks own registration then explains manual legacy activation', async () => {
  const s = startup(); await s.node('update').click!();
  assert.equal(s.updates, 1); assert.match(s.node('status').textContent, /Luk nu alle Logic Core-vinduer/);
  assert.equal(s.node('update').disabled, false); assert.equal(s.reloads, 0); assert.equal(s.storageTouches, 0);
});
test('offline, unsupported, missing registration and update failure give usable guidance', async () => {
  for (const options of [{ online: false }, { supported: false }, { registered: false }, { fail: true }]) {
    const s = startup(options); await s.node('update').click!();
    assert.match(s.node('status').textContent, /Forbind dig til nettet/); assert.equal(s.node('update').disabled, false);
    assert.equal(s.storageTouches, 0); assert.equal(s.reloads, 0);
  }
});
test('a hung startup update request is bounded and restores the action', async () => {
  const s = startup({ hang: true }); const pending = s.node('update').click!();
  assert.equal(s.node('update').disabled, true); s.tick(8000); await pending;
  assert.equal(s.node('update').disabled, false); assert.match(s.node('status').textContent, /prøv igen/);
  assert.equal(s.storageTouches, 0);
});
