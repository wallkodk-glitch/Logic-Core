import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolveBase } from './config.mjs';

const base = resolveBase();
const html = await readFile('dist/index.html', 'utf8');
assert(!html.includes('%BASE_URL%'), 'Vite must replace every BASE_URL token.');
assert(!html.includes('/src/main'), 'Entrypoint must point to bundled JavaScript.');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const path = match[1];
  assert(path.startsWith(base), `Asset outside Pages base: ${path}`);
  await access(`dist/${path.slice(base.length)}`);
}
const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.scope, './');
assert.equal(manifest.start_url, './#/');
for (const icon of manifest.icons) {
  const bytes = await readFile(`dist/${icon.src}`);
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
}
const sw = await readFile('dist/sw.js', 'utf8');
assert(!sw.includes('__BUILD_HASH__') && !sw.includes('__PRECACHE_URLS__'));
assert(sw.includes(JSON.stringify(base)), 'Offline cache must include the base URL.');
new Function(sw); // Check generated worker syntax without executing it.
console.log(`Verified: entrypoint, assets, icons, manifest, offline worker and Pages base ${base}`);
