import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { UPDATE_MESSAGE, UPDATE_REPLY } from '../src/pwa/update-controller.ts';

const scope = 'https://example.com/Logic-Core/';
type Event = { data?: unknown; source?: { id: string } | undefined; ports?: { postMessage(value: unknown): void }[]; request?: Request;
  waitUntil?(work: Promise<unknown>): void; respondWith?(work: Promise<Response>): void };
function worker(options: { clients?: { id: string; url: string }[]; offline?: boolean; empty?: boolean; partial?: boolean; cacheError?: boolean; clientsError?: boolean; skipError?: boolean } = {}) {
  const handlers = new Map<string, (event: Event) => void>();
  const files = new Map([[scope, '<html>cached shell with startup recovery</html>'], [`${scope}assets/app.js`, 'code'], [`${scope}assets/app.css`, 'css']]);
  if (options.empty) files.clear(); else if (options.partial) files.delete(`${scope}assets/app.js`);
  let skips = 0; let requests = 0;
  const replies: unknown[] = [];
  const code = readFileSync('scripts/sw-template.js', 'utf8').replace('__BUILD_HASH__', 'test')
    .replace('__PRECACHE_URLS__', JSON.stringify(['/Logic-Core/', '/Logic-Core/assets/app.js', '/Logic-Core/assets/app.css']));
  runInNewContext(code, {
    URL, Response, AbortSignal,
    self: { registration: { scope }, location: { origin: 'https://example.com' },
      addEventListener(type: string, handler: (event: Event) => void) { handlers.set(type, handler); },
      async skipWaiting() { if (options.skipError) throw new Error('activation'); skips++; },
      clients: { async matchAll(arg: { type: string; includeUncontrolled: boolean }) {
        assert.equal(arg.type, 'window'); assert.equal(arg.includeUncontrolled, true);
        if (options.clientsError) throw new Error('clients');
        return options.clients ?? [{ id: 'caller', url: `${scope}#/` }];
      } },
    },
    caches: { async open() { if (options.cacheError) throw new Error('cache'); return {
      async addAll() {}, async match(input: Request | string) { const value = files.get(typeof input === 'string' ? input : input.url); return value ? new Response(value) : undefined; },
    }; } },
    async fetch(_input: Request, init?: RequestInit) {
      requests++; if (init) { assert.equal(init.cache, 'no-store'); assert(init.signal); } if (options.offline) throw new Error('offline');
      return new Response('<html>current network shell</html>');
    },
  });
  async function dispatch(type: string, event: Event) { let pending: Promise<unknown> | undefined;
    handlers.get(type)!({ ...event, waitUntil(p) { pending = p; } }); await pending;
  }
  return {
    replies, dispatch,
    async activate(extra: Partial<Event> = {}) { await dispatch('message', { data: { type: UPDATE_MESSAGE }, source: { id: 'caller' }, ports: [{ postMessage(value) { replies.push(value); } }], ...extra }); },
    async navigate() {
      const request = new Request(scope); Object.defineProperty(request, 'mode', { value: 'navigate' });
      let response: Promise<Response> | undefined; handlers.get('fetch')!({ request, respondWith(p) { response = p; } });
      return (await response!)!.text();
    },
    async asset() {
      let response: Promise<Response> | undefined;
      handlers.get('fetch')!({ request: new Request(`${scope}assets/app.js`), respondWith(p) { response = p; } });
      return (await response!)!.text();
    },
    get skips() { return skips; }, get requests() { return requests; },
  };
}

test('worker install never activates an update without consent', async () => {
  const w = worker(); await w.dispatch('install', {}); assert.equal(w.skips, 0); assert.equal(w.replies.length, 0);
});
test('explicit protocol from the only in-scope window acknowledges then activates', async () => {
  const w = worker({ clients: [{ id: 'caller', url: `${scope}#/decisions` }, { id: 'other-app', url: 'https://example.com/elsewhere/' }] });
  await w.activate(); assert.equal(w.skips, 1); assert.equal(JSON.stringify(w.replies), JSON.stringify([{ type: UPDATE_REPLY, ok: true }]));
});
test('another open app window prevents early activation and protects its unsaved work', async () => {
  const w = worker({ clients: [{ id: 'caller', url: scope }, { id: 'other', url: `${scope}#/projects` }] });
  await w.activate(); assert.equal(w.skips, 0); assert.match(JSON.stringify(w.replies), /"ok":false/);
});
test('unknown protocol, missing reply port and missing source never activate', async () => {
  for (const extra of [{ data: { type: 'SKIP_WAITING' } }, { ports: [] }, { source: undefined }]) {
    const w = worker(); await w.activate(extra); assert.equal(w.skips, 0); assert.equal(w.replies.length, 0);
  }
});
test('a different source, missing client or client lookup failure refuses activation', async () => {
  for (const options of [{ clients: [] }, { clients: [{ id: 'not-caller', url: scope }] }, { clientsError: true }]) {
    const w = worker(options); await w.activate(); assert.equal(w.skips, 0); assert.match(JSON.stringify(w.replies), /"ok":false/);
  }
});
test('failed skipWaiting returns a refusal without claiming activation success', async () => {
  const w = worker({ skipError: true }); await w.activate(); assert.equal(w.skips, 0);
  assert.match(JSON.stringify(w.replies.at(-1)), /"ok":false/);
});
test('complete offline shell remains cache-first without network', async () => {
  const w = worker({ offline: true }); assert.match(await w.navigate(), /cached shell/); assert.equal(w.requests, 0);
});
test('partial cache fetches coherent current HTML online with a bounded no-store request', async () => {
  const w = worker({ partial: true }); assert.match(await w.navigate(), /current network shell/); assert.equal(w.requests, 1);
});
test('partial offline cache retains the independent cached startup guard', async () => {
  const w = worker({ partial: true, offline: true }); assert.match(await w.navigate(), /startup recovery/); assert.equal(w.requests, 1);
});
test('fully evicted offline shell returns useful recovery HTML, not a frozen loading label', async () => {
  const w = worker({ empty: true, offline: true }); const html = await w.navigate();
  assert.match(html, /kunne ikke starte/); assert.match(html, /Genindlæs/); assert.match(html, /ikke blevet nulstillet/);
  assert.doesNotMatch(html, /localStorage|indexedDB|\.clear\(/);
});
test('Cache API failure still offers an online or offline recovery path', async () => {
  assert.match(await worker({ cacheError: true }).navigate(), /current network shell/);
  assert.match(await worker({ cacheError: true, offline: true }).navigate(), /kunne ikke starte/);
});
test('Cache API failure cannot prevent online JavaScript from loading', async () => {
  const w = worker({ cacheError: true }); assert.match(await w.asset(), /current network shell/); assert.equal(w.requests, 1);
});
