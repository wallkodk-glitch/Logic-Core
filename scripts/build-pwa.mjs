import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolveBase } from './config.mjs';

const base = resolveBase();
async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const paths = await Promise.all(entries.map(entry => entry.isDirectory() ? walk(`${path}/${entry.name}`) : `${path}/${entry.name}`));
  return paths.flat();
}
const files = (await walk('dist')).filter(path => !path.endsWith('/sw.js')).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(file));
hash.update(base);
const template = await readFile('scripts/sw-template.js', 'utf8');
hash.update(template);
const version = hash.digest('hex').slice(0, 16);
const precache = [base, ...files.map(file => base + file.slice('dist/'.length))];
await writeFile('dist/sw.js', template.replace('__BUILD_HASH__', version).replace('__PRECACHE_URLS__', JSON.stringify(precache)));
console.log(`PWA: ${precache.length} app-shell URLs, scope ${base}, build ${version}`);
