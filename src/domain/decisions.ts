export const DECISION_STATUSES = ['draft', 'decided', 'closed', 'archived'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];
export const DECISION_LABELS: Record<DecisionStatus, string> = {
  draft: 'Kladde', decided: 'Besluttet', closed: 'Afsluttet', archived: 'Arkiveret',
};
export const REVERSIBILITIES = ['easy', 'moderate', 'hard'] as const;
export const REVERSIBILITY_LABELS = { easy: 'Let', moderate: 'Moderat', hard: 'Svær' };
export const REVIEW_ACTIONS = ['keep', 'reopen', 'close'] as const;
export const REVIEW_LABELS = { keep: 'Fasthold', reopen: 'Genåbn', close: 'Afslut' };
export const DECISION_LIMITS = { decisions: 100, options: 8, criteria: 8, commits: 50, reviews: 100, title: 120, text: 4000, optionText: 2000 } as const;

export interface DecisionOption {
  id: string;
  title: string;
  description: string;
  upside: string;
  downside: string;
  opportunityCost: string;
  reversibility: (typeof REVERSIBILITIES)[number];
}
export interface DecisionCriterion { id: string; title: string; weight: number }
export interface DecisionScore { optionId: string; criterionId: string; score: number }

export interface DecisionContent {
  title: string;
  goal: string;
  reality: string;
  constraints: string;
  assumptions: string;
  options: DecisionOption[];
  criteria: DecisionCriterion[];
  scores: DecisionScore[];
  selectedOptionId?: string;
  rationale: string;
  biggestRisk: string;
  changeConditions: string;
  nextAction: string;
  reviewAt?: string;
}
export interface DecisionInput extends DecisionContent { linkedProjectId?: string }
export interface DecisionCommit {
  readonly id: string;
  readonly createdAt: string;
  readonly snapshot: Readonly<DecisionContent & { selectedOptionId: string }>;
}
export interface ReviewInput {
  outcome: string;
  whatChanged: string;
  lessons: string;
  action: (typeof REVIEW_ACTIONS)[number];
}
export interface DecisionReview extends Readonly<ReviewInput> {
  readonly id: string;
  readonly commitId: string;
  readonly createdAt: string;
}
export interface Decision extends DecisionInput {
  id: string;
  status: DecisionStatus;
  commits: DecisionCommit[];
  reviews: DecisionReview[];
  createdAt: string;
  updatedAt: string;
}

export function newOption(): DecisionOption {
  return { id: crypto.randomUUID(), title: '', description: '', upside: '', downside: '', opportunityCost: '', reversibility: 'moderate' };
}
export function newDecisionInput(): DecisionInput {
  return { title: '', goal: '', reality: '', constraints: '', assumptions: '', options: [newOption(), newOption()],
    criteria: [], scores: [], rationale: '', biggestRisk: '', changeConditions: '', nextAction: '' };
}

// Explicit fields exclude current project links and all mutable status/history.
export function decisionContent(value: DecisionContent): DecisionContent {
  const content: DecisionContent = {
    title: value.title, goal: value.goal, reality: value.reality, constraints: value.constraints,
    assumptions: value.assumptions, options: value.options, criteria: value.criteria, scores: value.scores,
    rationale: value.rationale, biggestRisk: value.biggestRisk, changeConditions: value.changeConditions, nextAction: value.nextAction,
  };
  if (value.selectedOptionId !== undefined) content.selectedOptionId = value.selectedOptionId;
  if (value.reviewAt !== undefined) content.reviewAt = value.reviewAt;
  return structuredClone(content);
}
export function decisionInput(value: DecisionInput): DecisionInput {
  const input: DecisionInput = decisionContent(value);
  if (value.linkedProjectId !== undefined) input.linkedProjectId = value.linkedProjectId;
  return input;
}

// No authoritative total, partial denominator, ranking, or automatic selection.
export function weightedScore(content: DecisionContent, optionId: string): number | null {
  if (!content.criteria.length || !content.options.some(option => option.id === optionId)) return null;
  let total = 0; let weights = 0;
  for (const criterion of content.criteria) {
    const matches = content.scores.filter(score => score.optionId === optionId && score.criterionId === criterion.id);
    const score = matches[0]?.score;
    if (matches.length !== 1 || !Number.isInteger(score) || score === undefined || score < 1 || score > 10 ||
        !Number.isInteger(criterion.weight) || criterion.weight < 1 || criterion.weight > 5) return null;
    total += criterion.weight * score;
    weights += criterion.weight;
  }
  return total / weights;
}

export function isReviewDue(decision: Decision, now = Date.now()): boolean {
  if (decision.status !== 'decided' || !decision.reviewAt || Date.parse(decision.reviewAt) > now) return false;
  const commit = decision.commits.at(-1);
  return !decision.reviews.some(review => review.commitId === commit?.id && review.createdAt >= decision.reviewAt!);
}

export function nextTimestamp(previous?: string): string {
  return new Date(Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0)).toISOString();
}

export function reviewDateInput(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}
export function reviewDateFromInput(value: string): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Vælg en gyldig review-dato.');
  // End of the selected day in the device's timezone, stored as an ISO instant.
  const date = new Date(`${value}T23:59:59.999`);
  if (!Number.isFinite(date.getTime()) || reviewDateInput(date.toISOString()) !== value) throw new Error('Review-datoen findes ikke.');
  return date.toISOString();
}
