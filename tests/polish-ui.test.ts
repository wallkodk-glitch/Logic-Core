import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import { createElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppStore } from '../src/storage/store.ts';
import { key, MemoryStorage, fixture, ok, withScores } from './decision-fixtures.ts';
import { activityTarget } from '../src/domain/workspace.ts';
import type { Page } from '../src/app/router.ts';
import type { PwaState } from '../src/pwa/register.ts';

// Actual React components; only browser/context adapters are replaced for SSR.
// These assertions inspect semantics and markup, NOT pixel layout or touch.
const slot = Symbol.for('logic-core-polish-test');
let activeStore = fixture().store;
const state = { get context() { return { store: activeStore, ...activeStore.getSnapshot() }; },
  pwa: { status: 'ready', detail: 'Offline ready', activation: { phase: 'idle', detail: '' } } as PwaState };
Reflect.set(globalThis, slot, state);
const hooks = registerHooks({
  load(url, context, nextLoad) {
    let source: string | undefined;
    if (url.endsWith('/src/config.ts')) source = 'export const APP_VERSION="0.2.1", BASE_URL="/Logic-Core/", STORAGE_KEY="logic-core:/Logic-Core/:data";';
    if (url.endsWith('/src/storage/context.tsx')) source = 'export const useStore=()=>globalThis[Symbol.for("logic-core-polish-test")].context;';
    if (url.endsWith('/src/pwa/register.ts')) source = 'export const usePwa=()=>globalThis[Symbol.for("logic-core-polish-test")].pwa; export const activateUpdate=()=>{};';
    if (url.endsWith('/src/app/useDevice.ts')) source = 'export const useOnline=()=>true, useKeyboard=()=>false, isStandalone=()=>false;';
    if (source !== undefined) return { format: 'module', shortCircuit: true, source };
    if (!url.endsWith('.tsx')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
  },
});
const { AppShell } = await import('../src/app/AppShell.tsx');
const { CommandPage } = await import('../src/pages/CommandPage.tsx');
const { ProjectsPage } = await import('../src/pages/ProjectsPage.tsx');
const { ProjectEditorPage } = await import('../src/pages/ProjectEditorPage.tsx');
const { DecisionsPage } = await import('../src/pages/DecisionsPage.tsx');
const { DecisionEditorPage } = await import('../src/pages/DecisionEditorPage.tsx');
const { MorePage } = await import('../src/pages/MorePage.tsx');
const { SettingsPage } = await import('../src/pages/SettingsPage.tsx');
const { DiagnosticsPage } = await import('../src/pages/DiagnosticsPage.tsx');
const { ActivityRow } = await import('../src/components/ActivityRow.tsx');
after(() => { hooks.deregister(); Reflect.deleteProperty(globalThis, slot); });

function seed() {
  const port = new MemoryStorage(); port.items.set(key, readFileSync('tests/fixtures/v0.2-primary.json', 'utf8'));
  activeStore = new AppStore(() => port, key); return activeStore.getSnapshot().data;
}
function shell(page: Page, children: ReactElement) { return renderToStaticMarkup(createElement(AppShell, { page, children })); }
const screens: [string, Page, () => ReactElement][] = [
  ['Home', 'command', () => createElement(CommandPage)],
  ['Projects list', 'projects', () => createElement(ProjectsPage)],
  ['Project editor', 'project', () => createElement(ProjectEditorPage, { id: activeStore.getSnapshot().data.projects[0]!.id })],
  ['Decisions list', 'decisions', () => createElement(DecisionsPage)],
  ['Decision editor', 'decision', () => createElement(DecisionEditorPage, { id: activeStore.getSnapshot().data.decisions[0]!.id })],
  ['More', 'more', () => createElement(MorePage)],
  ['Settings', 'settings', () => createElement(SettingsPage)],
  ['Diagnostics', 'diagnostics', () => createElement(DiagnosticsPage)],
];
for (const [label, page, content] of screens) test(`${label} renders one quiet heading and existing mobile navigation`, () => {
  seed(); const html = shell(page, content());
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1); assert.match(html, /aria-label="Hovednavigation"/);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /core-orbit|PERSONAL OPERATING SYSTEM|COMMAND INPUT|WORKSPACE \/|Afventer kommando|AI tilsluttes senere|<footer/);
});
test('Home uses three recent items at most, with direct links and no duplicate active-project section', () => {
  const data = seed(); const html = shell('command', createElement(CommandPage));
  assert.match(html, /Fortsæt/); assert.equal((html.match(/class="workspace-row"/g) ?? []).length, 2);
  assert(html.includes(`href="#/decisions/${data.decisions[0]!.id}"`));
  assert(html.includes(`href="#/projects/${data.projects[0]!.id}"`)); assert.doesNotMatch(html, /Aktive projekter/);
});
test('activity markup is an entity link, a disclosure button, or passive deleted history', () => {
  const data = seed();
  for (const event of data.activity) {
    const html = renderToStaticMarkup(createElement(ActivityRow, { event, target: activityTarget(event, data) }));
    if (event.type === 'command') { assert.match(html, /<button/); assert.match(html, /aria-expanded="false"/); assert.match(html, /aria-controls=/); assert.doesNotMatch(html, /href=/); }
    else { assert.match(html, /<a class="activity-row"/); assert.match(html, event.type.startsWith('decision.') ? /Decision ·/ : /Project ·/); }
    if (event.type !== 'command') {
      const deleted = renderToStaticMarkup(createElement(ActivityRow, { event, target: activityTarget(event, { ...data, projects: [], decisions: [] }) }));
      assert.match(deleted, /Ikke længere tilgængelig/); assert.doesNotMatch(deleted, /href=|<button/);
    }
  }
});
test('contextual draft actions have one save control and expose decide only when valid', () => {
  activeStore = fixture().store;
  let html = shell('decision', createElement(DecisionEditorPage, { id: 'new' }));
  assert.equal((html.match(/>Gem kladde<\/button>/g) ?? []).length, 1); assert.doesNotMatch(html, />Beslut<\/button>/);
  const draft = ok(activeStore.saveDecision(withScores()));
  html = shell('decision', createElement(DecisionEditorPage, { id: draft.id }));
  assert.equal((html.match(/>Gem kladde<\/button>/g) ?? []).length, 1); assert.equal((html.match(/>Beslut<\/button>/g) ?? []).length, 1);
  assert.match(html, /aria-label="Kladdehandlinger"/); assert.equal((html.match(/<details class="decision-section" open=""/g) ?? []).length, 1);
  assert.equal(activeStore.getSnapshot().data.decisions[0]!.commits.length, 0);
});
test('decided editor remains read-only with history/review and without draft actions', () => {
  const data = seed(); const html = shell('decision', createElement(DecisionEditorPage, { id: data.decisions[0]!.id }));
  assert.match(html, /fieldset class="decision-workspace" disabled=""/); assert.doesNotMatch(html, /class="decision-actions"/);
  assert.match(html, /Genåbn som kladde/); assert.match(html, /Bevar historikken/);
});
test('newer schema warning renders with Diagnostics guidance rather than a frozen startup screen', () => {
  const port = new MemoryStorage(); const raw = JSON.stringify({ schemaVersion: 3 }); port.items.set(key, raw);
  activeStore = new AppStore(() => port, key); const html = shell('command', createElement(CommandPage));
  assert.match(html, /role="alert"/); assert.match(html, /nyere Logic Core/); assert.match(html, /Opdatér appen/);
  assert.match(html, /href="#\/diagnostics"/); assert.doesNotMatch(html, /Starter Logic Core/);
  assert.equal(port.getItem(key), raw); assert.equal(port.writes, 0);
});
test('explicit update notice and temporary interaction lock are separate from normal navigation', () => {
  seed(); state.pwa = { status: 'update', detail: '', activation: { phase: 'idle', detail: '' } };
  let html = shell('command', createElement(CommandPage)); assert.match(html, /Opdatér og genåbn/); assert.doesNotMatch(html, /class="update-lock"/);
  state.pwa = { ...state.pwa, activation: { phase: 'requesting', detail: 'Aktiverer opdateringen…' } };
  html = shell('command', createElement(CommandPage)); assert.match(html, /<main inert=""/); assert.match(html, /<nav inert=""/); assert.match(html, /class="update-lock" role="status"/);
  state.pwa = { status: 'ready', detail: '', activation: { phase: 'idle', detail: '' } };
});
