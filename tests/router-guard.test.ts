import test from 'node:test';
import assert from 'node:assert/strict';
import { navigate, parseRoute } from '../src/app/router.ts';
import { setPendingWork } from '../src/app/pending-work.ts';

test('real router wires internal anchors, programmatic navigation, hash cancellation and beforeunload to one guard', () => {
  const handlers = new Map<string, EventListener>(); let prompts = 0; let accept = false;
  const location = { hash: '#/', href: 'https://example.com/Logic-Core/#/', origin: 'https://example.com', pathname: '/Logic-Core/', search: '' };
  const register = (type: string, listener: EventListener) => { assert(!handlers.has(type), `duplicate ${type}`); handlers.set(type, listener); };
  class ElementPort { closest() { return this; } }
  class AnchorPort extends ElementPort { href = 'https://example.com/Logic-Core/#/opportunities'; target = ''; hasAttribute() { return false; } }
  const original = new Map(['window', 'document', 'Element', 'HTMLAnchorElement'].map(name => [name, Reflect.get(globalThis, name)]));
  Reflect.set(globalThis, 'window', { location, addEventListener: register, confirm: () => { prompts++; return accept; },
    history: { state: null, replaceState: (_state: unknown, _unused: string, hash: string) => { location.hash = hash; } } });
  Reflect.set(globalThis, 'document', { addEventListener: register }); Reflect.set(globalThis, 'Element', ElementPort); Reflect.set(globalThis, 'HTMLAnchorElement', AnchorPort);
  const owner = {}; const dispatch = (type: string, event: unknown = {}) => handlers.get(type)!(event as Event);
  try {
    assert(navigate('/projects')); dispatch('hashchange'); assert.equal(location.hash, '#/projects');
    setPendingWork(owner, true); let prevented = false;
    dispatch('click', { button: 0, target: new AnchorPort(), preventDefault: () => { prevented = true; } });
    assert(prevented); assert.equal(location.hash, '#/projects'); assert.equal(prompts, 1);
    assert.equal(navigate('/decisions'), false); assert.equal(prompts, 2);
    location.hash = '#/more'; dispatch('hashchange'); assert.equal(location.hash, '#/projects'); assert.equal(prompts, 3);
    const unload = { returnValue: 'unchanged', preventDefault: () => { prevented = true; } }; prevented = false; dispatch('beforeunload', unload);
    assert(prevented); assert.equal(unload.returnValue, '');
    accept = true; assert(navigate('/opportunities/import')); dispatch('hashchange'); assert.equal(prompts, 4); assert.deepEqual(parseRoute(location.hash), { page: 'opportunity-import' });
    setPendingWork(owner, false); prevented = false; dispatch('beforeunload', unload); assert.equal(prevented, false);
    const external = new AnchorPort(); external.href = 'https://example.org'; dispatch('click', { button: 0, target: external, preventDefault: () => { prevented = true; } }); assert.equal(prevented, false);
    assert.deepEqual([...handlers.keys()].sort(), ['beforeunload', 'click', 'hashchange']);
  } finally {
    setPendingWork(owner, false); for (const [name, value] of original) { if (value === undefined) Reflect.deleteProperty(globalThis, name); else Reflect.set(globalThis, name, value); }
  }
});
