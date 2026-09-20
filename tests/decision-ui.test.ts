import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { create, fixture, withScores } from './decision-fixtures.ts';

// Real React markup smoke tests, not a browser/layout or touch test.
// Reuse the already locked TypeScript compiler; no extra UI-test dependency.
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('.tsx')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
  },
});
const { DecisionOptions } = await import('../src/components/decisions/DecisionOptions.tsx');
const { DecisionScoring } = await import('../src/components/decisions/DecisionScoring.tsx');
const { DecisionHistory } = await import('../src/components/decisions/DecisionHistory.tsx');
after(() => hooks.deregister());

test('React option cards render labelled inputs and escape user text', () => {
  const input = withScores(); input.options[0]!.title = '<script>alert(1)</script>';
  const html = renderToStaticMarkup(createElement(DecisionOptions, { options: input.options, onChange: () => {} }));
  assert(html.includes('for="option-0-title"')); assert(html.includes('id="option-0-title"'));
  assert(html.includes('&lt;script&gt;')); assert(!html.includes('<script>')); assert(!html.includes('<table'));
  assert.equal((html.match(/class="decision-card"/g) ?? []).length, 2);
});
test('React scoring renders optional stacked scores and deterministic analytical signals', () => {
  const content = withScores();
  const render = () => renderToStaticMarkup(createElement(DecisionScoring, { content, onCriteria: () => {}, onScores: () => {} }));
  const html = render();
  assert(html.includes('ANALYTICAL SIGNAL')); assert(html.includes('7.50 / 10')); assert(html.includes('2.50 / 10'));
  assert(html.includes('class="score-stack"')); assert(!html.includes('<table'));
  content.scores.pop(); assert(render().includes('Ufuldstændig'));
  content.criteria = []; content.scores = []; assert(!render().includes('class="score-results"'));
});
test('React history renders the committed belief after current draft is edited', () => {
  const { store } = fixture(); const decision = create(store, true);
  const changed = structuredClone(decision); changed.goal = 'A later goal';
  const html = renderToStaticMarkup(createElement(DecisionHistory, { decision: changed }));
  assert(html.includes('Protect time')); assert(!html.includes('A later goal')); assert(html.includes('Valg:'));
  assert(!html.includes('<input')); assert(!html.includes('<textarea'));
});
