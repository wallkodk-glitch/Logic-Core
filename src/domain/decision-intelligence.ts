import { isReviewDue } from './decisions.ts';
import type { Decision, DecisionCommit, DecisionContent } from './decisions.ts';
import { canonical } from '../storage/validation.ts';

export const DRIFT_FIELDS = ['selectedOptionId', 'title', 'goal', 'reality', 'constraints', 'assumptions', 'options', 'criteria', 'scores', 'rationale', 'biggestRisk', 'changeConditions', 'nextAction', 'reviewAt'] as const satisfies readonly (keyof DecisionContent)[];
export type DriftField = (typeof DRIFT_FIELDS)[number];
export const DRIFT_LABELS: Record<DriftField, string> = {
  selectedOptionId: 'Valgt alternativ', title: 'Titel', goal: 'Mål', reality: 'Virkelighed', constraints: 'Rammer', assumptions: 'Antagelser',
  options: 'Muligheder', criteria: 'Kriterier', scores: 'Scores', rationale: 'Begrundelse', biggestRisk: 'Største risiko',
  changeConditions: 'Betingelser for at skifte retning', nextAction: 'Næste handling', reviewAt: 'Review-dato',
};
export interface DriftComparison { from: string; to: string; changed: DriftField[] }
function compare(before: DecisionCommit, after: DecisionCommit): DriftComparison {
  return { from: before.id, to: after.id, changed: DRIFT_FIELDS.filter(field => canonical(before.snapshot[field]) !== canonical(after.snapshot[field])) };
}
export function decisionDrift(decision: Decision, now = Date.now()) {
  const latest = decision.commits.at(-1); const previous = decision.commits.at(-2); const first = decision.commits[0];
  return { versions: decision.commits.length, reviews: decision.reviews.length, reviewDue: isReviewDue(decision, now),
    latest: latest && previous ? compare(previous, latest) : null,
    fromFirst: latest && first && decision.commits.length > 1 ? compare(first, latest) : null };
}
