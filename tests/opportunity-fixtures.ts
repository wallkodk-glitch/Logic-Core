import type { BridgeDocument } from '../src/domain/opportunities.ts';
export const at = '2026-09-20T12:00:00.000Z';
export function bridge(count = 1): BridgeDocument {
  return { format: 'logic-core-opportunity-bridge', bridgeVersion: 1, generatedAt: at, source: 'Logic Hunter',
    items: Array.from({ length: count }, (_, i) => ({ bridgeKey: `business:idea-${i}`, generatedAt: at, sourceRunId: 'run-1', analysis: {
      title: `Idea ${i}`, domain: 'Business', summary: 'Test a need', thesis: 'Small experiment', evidence: ['One interview'],
      whyNow: 'New evidence', upside: 'Useful product', downside: 'Time spent', constraints: ['No PC'], assumptions: ['Demand exists'],
      unknowns: ['Willingness to pay'], nextTest: 'Ask five people', sourceLinks: ['https://example.com/research'],
    } })),
  };
}
