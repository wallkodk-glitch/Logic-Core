import { EVALUATION_FIELDS } from './opportunities.ts';
import type { OpportunityEvaluation } from './opportunities.ts';

// Six positive dimensions plus inverted downside, linearly mapped from 1–5 to 0–100.
// No stored total, missing-value substitution, ranking decision or status mutation.
export function opportunitySignal(evaluation: OpportunityEvaluation): number | null {
  let sum = 0;
  for (const field of EVALUATION_FIELDS) {
    const value = evaluation[field];
    if (value === undefined || !Number.isInteger(value) || value < 1 || value > 5) return null;
    sum += field === 'downsideRisk' ? 6 - value : value;
  }
  return (sum / 7 - 1) * 25;
}
