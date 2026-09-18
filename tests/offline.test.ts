import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Exercise the actual shipped worker template, with an isolated Cache API fake.
// These verify cache routing/lifecycle, not a physical browser's eviction policy.
type WorkerEvent = { request?: Request; waitUntil?: (promise: Promise<unknown>) => void; respondWith?: (promise: Promise<Response>) => void };
function worker() {
  const scope = 'https://example.com/logic-core/';
  const prefix = `logic-core-shell:${scope}:`;
  const current = `${prefix}test-build`;
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const removed: string[] = [];
  const cached = new Map<string, string>([[scope, '<html>offline shell</html>'], [`${scope}assets/app.js`, 'app-code']]);
  const added: string[] = [];
  let claimed = false;
  let failInstall = false;
  let networkRequests = 0;
  const cache = {
    async addAll(urls: string[]) { if (failInstall) throw new Error('offline'); added.push(...urls); },
    async match(input: Request | string, options?: { ignoreSearch?: boolean }) {
      const url = new URL(typeof input === 'string' ? input : input.url);
      if (options?.ignoreSearch) url.search = '';
      const text = cached.get(url.href);
      return text ? new Response(text) : undefined;
    },
  };
  const code = readFileSync('scripts/sw-template.js', 'utf8')
    .replace('__BUILD_HASH__', 'test-build')
    .replace('__PRECACHE_URLS__', JSON.stringify(['/logic-core/', '/logic-core/assets/app.js']));
  runInNewContext(code, {
    URL,
    self: {
      registration: { scope }, location: { origin: 'https://example.com' },
      addEventListener(type: string, handler: (event: WorkerEvent) => void) { handlers.set(type, handler); },
      clients: { async claim() { claimed = true; } },
    },
    caches: {
      async open(name: string) { assert.equal(name, current); return cache; },
      async keys() { return [current, `${prefix}old-build`, 'other-app-cache', 'logic-core-shell:https://example.com/other/:old']; },
      async delete(name: string) { removed.push(name); return true; },
    },
    async fetch() { networkRequests++; throw new Error('offline'); },
  });
  async function lifecycle(type: string) {
    let work: Promise<unknown> | undefined;
    handlers.get(type)!({ waitUntil(promise) { work = promise; } });
    await work;
  }
  function request(url: string, mode = 'cors', method = 'GET') {
    let response: Promise<Response> | undefined;
    // Request's navigate mode is browser-only, so simulate that read-only field.
    const req = new Request(url, { method });
    Object.defineProperty(req, 'mode', { value: mode });
    handlers.get('fetch')!({ request: req, respondWith(promise) { response = promise; } });
    return response;
  }
  return { lifecycle, request, added, removed, prefix, current, setInstallFailure: () => { failInstall = true; }, get claimed() { return claimed; }, get networkRequests() { return networkRequests; } };
}

test('offline install precaches repository-scoped shell and static assets', async () => {
  const w = worker(); await w.lifecycle('install');
  assert.deepEqual(w.added, ['/logic-core/', '/logic-core/assets/app.js']);
});
test('worker activation removes only obsolete caches for this exact app scope', async () => {
  const w = worker(); await w.lifecycle('activate');
  assert.deepEqual(w.removed, [`${w.prefix}old-build`]);
  assert(w.claimed);
});
test('offline reopen returns cached index without a network request', async () => {
  const w = worker();
  const response = await w.request('https://example.com/logic-core/', 'navigate');
  assert.equal(await response?.text(), '<html>offline shell</html>');
  assert.equal(w.networkRequests, 0);
});
test('cached JavaScript is available offline, including cache-busting queries', async () => {
  const w = worker();
  const response = await w.request('https://example.com/logic-core/assets/app.js?v=1');
  assert.equal(await response?.text(), 'app-code');
  assert.equal(w.networkRequests, 0);
});
test('worker leaves other apps, external requests and write requests alone', () => {
  const w = worker();
  assert.equal(w.request('https://example.com/other/', 'navigate'), undefined);
  assert.equal(w.request('https://external.com/logic-core/'), undefined);
  assert.equal(w.request('https://example.com/logic-core/api'), undefined);
  assert.equal(w.request('https://example.com/logic-core/', 'cors', 'POST'), undefined);
});
test('failed installation does not remove a working previous cache', async () => {
  const w = worker(); w.setInstallFailure();
  await assert.rejects(w.lifecycle('install'), /offline/);
  assert.deepEqual(w.removed, []);
});
