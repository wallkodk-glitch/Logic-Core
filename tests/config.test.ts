import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBase } from '../scripts/config.mjs';
import { parseRoute } from '../src/app/router.ts';

test('Pages base resolves development, repository, user site and custom domain', () => {
  assert.equal(resolveBase({}), '/');
  assert.equal(resolveBase({ GITHUB_REPOSITORY: 'jakob/logic-core' }), '/logic-core/');
  assert.equal(resolveBase({ GITHUB_REPOSITORY: 'wallkodk-glitch/Logic-Core' }), '/Logic-Core/');
  assert.equal(resolveBase({ GITHUB_REPOSITORY: 'jakob/Jakob.github.io' }), '/');
  assert.equal(resolveBase({ GITHUB_REPOSITORY: 'jakob/logic-core', PAGES_BASE_PATH: '' }), '/');
  assert.equal(resolveBase({ PAGES_BASE_PATH: '/logic-core' }), '/logic-core/');
  assert.throws(() => resolveBase({ PAGES_BASE_PATH: 'https://example.com' }));
});

test('every route works under a hash and malformed routes have a fallback', () => {
  for (const route of ['projects', 'decisions', 'opportunities', 'knowledge', 'settings', 'diagnostics', 'more']) {
    assert.equal(parseRoute(`#/${route}`).page, route);
  }
  assert.equal(parseRoute('').page, 'command');
  assert.deepEqual(parseRoute('#/projects/new'), { page: 'project', id: 'new' });
  assert.equal(parseRoute('#/invalid').page, 'not-found');
  assert.equal(parseRoute('#/projects/%XX').page, 'not-found');
});
