import assert from 'node:assert/strict';
import { AppStore } from '../src/storage/store.ts';
import type { StoragePort } from '../src/storage/store.ts';
import { newDecisionInput } from '../src/domain/decisions.ts';
import type { Decision, DecisionInput } from '../src/domain/decisions.ts';
import type { Result } from '../src/domain/types.ts';

export const key = 'logic-core:/Logic-Core/:data';
export class MemoryStorage implements StoragePort {
  items = new Map<string, string>();
  writes = 0;
  failWrite = false;
  getItem(name: string) { return this.items.get(name) ?? null; }
  setItem(name: string, value: string) {
    if (this.failWrite) throw new DOMException('full', 'QuotaExceededError');
    this.writes++; this.items.set(name, value);
  }
  removeItem(name: string) { this.items.delete(name); }
}
export function ok<T>(result: Result<T>): T { assert(result.ok, result.ok ? '' : result.error); return result.value; }
export function fixture() { const port = new MemoryStorage(); return { port, store: new AppStore(() => port, key) }; }
export function completeInput(): DecisionInput {
  const input = newDecisionInput();
  input.title = 'Choose a direction'; input.goal = 'Protect time'; input.reality = 'Limited capacity';
  input.constraints = 'No PC'; input.assumptions = 'Phone stays available';
  input.options[0]!.title = 'Build now'; input.options[1]!.title = 'Wait';
  input.selectedOptionId = input.options[1]!.id;
  input.rationale = 'Wait deliberately'; input.biggestRisk = 'Delay'; input.changeConditions = 'Tools arrive'; input.nextAction = 'Schedule a check';
  return input;
}
export function create(store: AppStore, decided = false): Decision { return ok(store.saveDecision(completeInput(), undefined, undefined, decided)); }
export function withScores(): DecisionInput {
  const input = completeInput();
  input.criteria = [{ id: 'time', title: 'Time', weight: 3 }, { id: 'risk', title: 'Risk', weight: 1 }];
  input.scores = input.options.flatMap((option, index) => [
    { optionId: option.id, criterionId: 'time', score: index ? 2 : 8 },
    { optionId: option.id, criterionId: 'risk', score: index ? 4 : 6 },
  ]);
  return input;
}
