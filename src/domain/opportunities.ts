export const OPPORTUNITY_STATUSES = ['inbox', 'candidate', 'active', 'parked', 'rejected', 'archived'] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];
export const OPPORTUNITY_LABELS: Record<OpportunityStatus, string> = {
  inbox: 'Indbakke', candidate: 'Kandidat', active: 'Aktiv', parked: 'Parkeret', rejected: 'Fravalgt', archived: 'Arkiveret',
};
export const OPPORTUNITY_LIMITS = {
  opportunities: 50, snapshots: 8, batch: 20, tags: 12, links: 10,
  title: 120, domain: 64, tag: 32, notes: 4000, text: 2000, list: 8, listText: 500,
  url: 2048, source: 120, snapshotBytes: 16 * 1024, bridgeBytes: 128 * 1024, collectionBytes: 1024 * 1024,
} as const;
export const EVALUATION_FIELDS = ['upside', 'confidence', 'fit', 'speed', 'capitalEfficiency', 'reversibility', 'downsideRisk'] as const;
export type EvaluationField = (typeof EVALUATION_FIELDS)[number];
export type OpportunityEvaluation = Partial<Record<EvaluationField, number>>;
export const EVALUATION_LABELS: Record<EvaluationField, string> = {
  upside: 'Potentiale', confidence: 'Tillid til evidens', fit: 'Strategisk match', speed: 'Hurtighed til læring',
  capitalEfficiency: 'Kapitaleffektivitet', reversibility: 'Omgørlighed', downsideRisk: 'Risiko · 1 lav, 5 høj',
};
export interface OpportunityAnalysis {
  title: string;
  domain: string;
  summary: string;
  thesis: string;
  evidence: string[];
  whyNow: string;
  upside: string;
  downside: string;
  constraints: string[];
  assumptions: string[];
  unknowns: string[];
  nextTest: string;
  sourceLinks: string[];
}
export interface BridgeItem {
  bridgeKey: string;
  generatedAt: string;
  sourceRunId?: string;
  analysis: OpportunityAnalysis;
}
export interface BridgeDocument {
  format: 'logic-core-opportunity-bridge';
  bridgeVersion: 1;
  generatedAt: string;
  source: string;
  items: BridgeItem[];
}
export interface SourceSnapshot {
  readonly id: string;
  readonly importedAt: string;
  readonly sourceLabel: string;
  readonly bridgeGeneratedAt: string;
  readonly generatedAt: string;
  readonly sourceRunId?: string;
  readonly payload: BridgeItem;
}
// Only these workspace fields are editable. Snapshots/identity are never inputs.
export interface OpportunityInput {
  title: string;
  domain: string;
  tags: string[];
  status: OpportunityStatus;
  notes: string;
  evaluation: OpportunityEvaluation;
  nextAction: string;
  reviewAt?: string;
  linkedProjectIds: string[];
  linkedDecisionIds: string[];
}
export interface Opportunity extends OpportunityInput {
  id: string;
  bridgeKey?: string;
  sourceSnapshots: SourceSnapshot[];
  createdAt: string;
  updatedAt: string;
}
export function newOpportunityInput(): OpportunityInput {
  return { title: '', domain: 'Business', tags: [], status: 'inbox', notes: '', evaluation: {}, nextAction: '', linkedProjectIds: [], linkedDecisionIds: [] };
}
export function opportunityInput(value: OpportunityInput): OpportunityInput {
  const input: OpportunityInput = { title: value.title, domain: value.domain, tags: value.tags, status: value.status, notes: value.notes,
    evaluation: value.evaluation, nextAction: value.nextAction, linkedProjectIds: value.linkedProjectIds, linkedDecisionIds: value.linkedDecisionIds };
  if (value.reviewAt !== undefined) input.reviewAt = value.reviewAt;
  return structuredClone(input);
}
export const currentOpportunity = (value: Opportunity): boolean => ['inbox', 'candidate', 'active'].includes(value.status);
export const opportunityReviewDue = (value: Opportunity, now = Date.now()): boolean =>
  !['rejected', 'archived'].includes(value.status) && value.reviewAt !== undefined && Date.parse(value.reviewAt) <= now;
