import type { DecisionInput } from './decisions.ts';
import { validateDecisionInput } from '../storage/decision-validation.ts';

// Visibility only. The existing store revalidates the complete input at save.
// Do not duplicate or relax deciding requirements in the UI.
export function canDecide(input: DecisionInput): boolean {
  try { validateDecisionInput(input, true); return true; }
  catch { return false; }
}
