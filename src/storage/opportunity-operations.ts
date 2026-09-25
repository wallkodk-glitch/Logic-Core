import type { Activity, AppData } from '../domain/types.ts';
import { DECISION_LIMITS, newDecisionInput, nextTimestamp } from '../domain/decisions.ts';
import type { Decision } from '../domain/decisions.ts';
import { newOpportunityInput, OPPORTUNITY_LIMITS as L } from '../domain/opportunities.ts';
import type { BridgeDocument, Opportunity, OpportunityInput } from '../domain/opportunities.ts';
import { validateOpportunityInput } from './opportunity-validation.ts';
import { makeSourceSnapshot, previewBridge, sourceUnchanged } from './opportunity-bridge.ts';
import { validateDecisionInput } from './decision-validation.ts';

export type RecordOpportunity = (type: Activity['type'], text: string, opportunityId: string) => void;
export function currentOpportunity(data: AppData, id: string, expectedUpdatedAt: string): Opportunity {
  const item = data.opportunities.find(opportunity => opportunity.id === id);
  if (!item) throw new Error('Muligheden findes ikke længere.');
  if (item.updatedAt !== expectedUpdatedAt) throw new Error('Muligheden er ændret siden du åbnede den. Indlæs den nyeste version før flere ændringer.');
  return item;
}
// These helpers mutate ONLY the detached clone supplied by AppStore.transaction.
export function saveOpportunity(data: AppData, input: OpportunityInput, record: RecordOpportunity, id?: string, expectedUpdatedAt?: string): Opportunity {
  validateOpportunityInput(input);
  const existing = id ? currentOpportunity(data, id, expectedUpdatedAt ?? '') : undefined;
  if (!existing && data.opportunities.length >= L.opportunities) throw new Error('Maksimalt 50 muligheder. Eksportér og ryd op før flere oprettes.');
  const timestamp = nextTimestamp(existing?.updatedAt);
  const next: Opportunity = { ...structuredClone(input), id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp, sourceSnapshots: existing?.sourceSnapshots ?? [],
    ...(existing?.bridgeKey !== undefined ? { bridgeKey: existing.bridgeKey } : {}) };
  data.opportunities = existing ? data.opportunities.map(item => item.id === id ? next : item) : [next, ...data.opportunities];
  record(existing ? 'opportunity.updated' : 'opportunity.created', `${existing ? 'Opdateret' : 'Oprettet'}: ${next.title}`, next.id);
  if (existing && existing.status !== next.status) record('opportunity.status', `Status ændret: ${next.title}`, next.id);
  return next;
}
export function applyBridge(data: AppData, document: BridgeDocument, record: RecordOpportunity) {
  const preview = previewBridge(document, data.opportunities);
  for (const item of document.items) {
    let opportunity = data.opportunities.find(existing => existing.bridgeKey === item.bridgeKey);
    if (opportunity && sourceUnchanged(opportunity, item)) continue;
    const timestamp = nextTimestamp(opportunity?.updatedAt);
    if (!opportunity) {
      opportunity = { ...newOpportunityInput(), title: item.analysis.title, domain: item.analysis.domain,
        id: crypto.randomUUID(), bridgeKey: item.bridgeKey, createdAt: timestamp, updatedAt: timestamp, sourceSnapshots: [] };
      data.opportunities.unshift(opportunity);
      record('opportunity.created', `Oprettet: ${opportunity.title}`, opportunity.id);
    }
    opportunity.sourceSnapshots.push(makeSourceSnapshot(item, document, crypto.randomUUID(), timestamp));
    opportunity.updatedAt = timestamp;
    record('opportunity.imported', `Kildeversion ${opportunity.sourceSnapshots.length}: ${opportunity.title}`, opportunity.id);
  }
  return preview;
}
export function startOpportunityDecision(data: AppData, id: string, expectedUpdatedAt: string): Decision {
  const opportunity = currentOpportunity(data, id, expectedUpdatedAt);
  if (opportunity.linkedDecisionIds.length >= L.links) throw new Error('Muligheden har allerede 10 beslutningslinks. Fjern et link først.');
  if (data.decisions.length >= DECISION_LIMITS.decisions) throw new Error('Maksimalt 100 beslutninger. Eksportér og ryd op først.');
  const source = opportunity.sourceSnapshots.at(-1);
  const analysis = source?.payload.analysis;
  const input = newDecisionInput();
  input.title = `Opportunity: ${opportunity.title}`.slice(0, DECISION_LIMITS.title);
  input.goal = 'Beslut om og hvordan denne mulighed skal forfølges.';
  // Plain-text attribution survives even if the Opportunity is later deleted.
  input.reality = (source ? `Importeret kilde: ${source.sourceLabel}\nBridge: ${opportunity.bridgeKey}\nSnapshot: ${source.id}\n\n${analysis!.summary}\n\n${analysis!.evidence.join('\n')}` : `Lokal mulighed: ${opportunity.title}`).slice(0, DECISION_LIMITS.text);
  input.assumptions = (analysis?.assumptions.join('\n') ?? '').slice(0, DECISION_LIMITS.text);
  input.biggestRisk = analysis?.downside ?? '';
  input.nextAction = opportunity.nextAction || analysis?.nextTest || '';
  const project = opportunity.linkedProjectIds[0]; if (project) input.linkedProjectId = project;
  validateDecisionInput(input);
  const timestamp = nextTimestamp(opportunity.updatedAt);
  const decision: Decision = { ...input, id: crypto.randomUUID(), status: 'draft', commits: [], reviews: [], createdAt: timestamp, updatedAt: timestamp };
  data.decisions.unshift(decision);
  opportunity.linkedDecisionIds.push(decision.id); opportunity.updatedAt = timestamp;
  return decision;
}
