/* Generated at build time. Cache contains static application files only. */
const CACHE_PREFIX = `logic-core-shell:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}__BUILD_HASH__`;
const APP_URL = new URL('./', self.registration.scope).href;
const PRECACHE = __PRECACHE_URLS__;

self.addEventListener('install', event => {
  // A failed install keeps the previous version intact. Deliberately do not
  // skipWaiting: old tabs may still run the old JS and have unsaved input.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)));
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
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(APP_URL)) ?? (await fetch(event.request));
    })());
    return;
  }
  // Do not intercept arbitrary APIs or cache any user records.
  if (!PRECACHE.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(event.request, { ignoreSearch: true })) ?? (await fetch(event.request));
  })());
});
