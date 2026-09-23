/* Generated at build time. Cache contains static application files only. */
const CACHE_PREFIX = `logic-core-shell:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}__BUILD_HASH__`;
const APP_URL = new URL('./', self.registration.scope).href;
const PRECACHE = __PRECACHE_URLS__;

self.addEventListener('install', event => {
  // A failed install keeps the previous version intact. Activation is explicit;
  // never skipWaiting during install or reload other windows.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)));
});

// Only an explicit request from the sole in-scope window can activate early.
self.addEventListener('message', event => {
  if (event.data?.type !== 'LOGIC_CORE_ACTIVATE_V1' || !event.ports?.[0] || !event.source?.id) return;
  const reply = ok => event.ports[0].postMessage({ type: 'LOGIC_CORE_UPDATE_RESULT_V1', ok });
  event.waitUntil((async () => {
    try {
      const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
        .filter(client => client.url.startsWith(APP_URL));
      if (windows.length !== 1 || windows[0].id !== event.source.id) { reply(false); return; }
      reply(true);
      await self.skipWaiting();
    } catch { reply(false); }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(APP_URL)) return;
  if (event.request.mode === 'navigate') {
    // Serve the index belonging to this worker, avoiding mixed build versions.
    event.respondWith((async () => {
      let index;
      try {
        const cache = await caches.open(CACHE_NAME);
        index = await cache.match(APP_URL);
        const critical = PRECACHE.filter(path => /\/assets\/.*\.(js|css)$/.test(path));
        const complete = index && (await Promise.all(critical.map(path => cache.match(new URL(path, self.location.origin).href)))).every(Boolean);
        if (complete) return index;
      } catch { /* Cache access failure must still offer an online/recovery path. */ }
      // Partial cache eviction can leave old HTML pointing at a removed hashed
      // bundle. Online, fetch a coherent current HTML document without HTTP cache.
      try {
        const response = await fetch(event.request, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (response.ok) return response;
      } catch { /* Cached HTML still contains the independent startup fallback. */ }
      return index ?? new Response('<!doctype html><html lang="da"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logic Core</title><body style="background:#101113;color:#edeef0;font:16px/1.6 system-ui;margin:32px"><h1>Logic Core kunne ikke starte</h1><p>Appens offline-filer er ikke tilgængelige. Gå online, luk appen og åbn igen. Dine data er ikke blevet nulstillet.</p><button style="min-height:48px;padding:12px" onclick="location.reload()">Genindlæs</button></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    })());
    return;
  }
  // Do not intercept arbitrary APIs or cache any user records.
  if (!PRECACHE.includes(url.pathname)) return;
  event.respondWith((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
    } catch { /* A failed Cache API must not block working online assets. */ }
    return fetch(event.request);
  })());
});
