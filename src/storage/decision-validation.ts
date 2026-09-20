import { DECISION_LIMITS as LIMIT, DECISION_STATUSES, REVERSIBILITIES, REVIEW_ACTIONS, decisionContent } from '../domain/decisions.ts';
import type { Decision, DecisionContent, DecisionInput, DecisionOption, DecisionCriterion, DecisionScore, DecisionCommit, DecisionReview, ReviewInput } from '../domain/decisions.ts';
import { canonical, hasShape, integer, isDate, isId, isRecord, isText, uniqueIds } from './validation.ts';

const textFields = ['title', 'goal', 'reality', 'constraints', 'assumptions', 'rationale', 'biggestRisk', 'changeConditions', 'nextAction'] as const;
const contentFields = [...textFields, 'options', 'criteria', 'scores'];
const optionalContent = ['selectedOptionId', 'reviewAt'];

function isOption(value: unknown): value is DecisionOption {
  return isRecord(value) && hasShape(value, ['id', 'title', 'description', 'upside', 'downside', 'opportunityCost', 'reversibility']) &&
    isId(value.id) && isText(value.title, LIMIT.title) &&
    ['description', 'upside', 'downside', 'opportunityCost'].every(key => isText(value[key], LIMIT.optionText)) &&
    REVERSIBILITIES.some(item => item === value.reversibility);
}
function isCriterion(value: unknown): value is DecisionCriterion {
  return isRecord(value) && hasShape(value, ['id', 'title', 'weight']) && isId(value.id) && isText(value.title, LIMIT.title) && integer(value.weight, 1, 5);
}
function isScore(value: unknown): value is DecisionScore {
  return isRecord(value) && hasShape(value, ['optionId', 'criterionId', 'score']) && isId(value.optionId) && isId(value.criterionId) && integer(value.score, 1, 10);
}

function isContent(value: Record<string, unknown>, complete: boolean): value is Record<string, unknown> & DecisionContent {
  if (!textFields.every(field => isText(value[field], field === 'title' ? LIMIT.title : LIMIT.text, field === 'title')) ||
      !Array.isArray(value.options) || value.options.length > LIMIT.options || !value.options.every(isOption) || !uniqueIds(value.options) ||
      !Array.isArray(value.criteria) || value.criteria.length > LIMIT.criteria || !value.criteria.every(isCriterion) || !uniqueIds(value.criteria) ||
      !Array.isArray(value.scores) || value.scores.length > LIMIT.options * LIMIT.criteria || !value.scores.every(isScore) ||
      (value.reviewAt !== undefined && !isDate(value.reviewAt))) return false;
  const options = new Set(value.options.map(option => option.id));
  const criteria = new Set(value.criteria.map(criterion => criterion.id));
  if (value.selectedOptionId !== undefined && (!isId(value.selectedOptionId) || !options.has(value.selectedOptionId))) return false;
  const pairs = new Set<string>();
  for (const score of value.scores) {
    const pair = `${score.optionId}\u0000${score.criterionId}`;
    if (!options.has(score.optionId) || !criteria.has(score.criterionId) || pairs.has(pair)) return false;
    pairs.add(pair);
  }
  if (complete && (value.options.length < 2 || !isId(value.selectedOptionId) ||
      !value.options.every(option => option.title.trim()) || !value.criteria.every(criterion => criterion.title.trim()) ||
      !['goal', 'rationale', 'nextAction'].every(field => isText(value[field], LIMIT.text, true)) ||
      value.scores.length !== value.options.length * value.criteria.length)) return false;
  return true;
}

export function validateDecisionInput(value: unknown, complete = false): DecisionInput {
  if (!isRecord(value) || !hasShape(value, contentFields, [...optionalContent, 'linkedProjectId']) || !isContent(value, complete) ||
      (value.linkedProjectId !== undefined && !isId(value.linkedProjectId))) {
    throw new Error(complete ? 'For at beslutte: udfyld titel, mål, mindst to navngivne muligheder, dit valg, begrundelse og næste handling. Udfyld alle scores, hvis kriterier bruges.' : 'Beslutningsdata er ugyldige. Kontrollér felter, grænser, referencer og scores.');
  }
  return value as unknown as DecisionInput;
}
export function validateReviewInput(value: unknown): ReviewInput {
  if (!isRecord(value) || !hasShape(value, ['outcome', 'whatChanged', 'lessons', 'action']) ||
      !isText(value.outcome, LIMIT.text, true) || !isText(value.whatChanged, LIMIT.text) || !isText(value.lessons, LIMIT.text) ||
      !REVIEW_ACTIONS.some(action => action === value.action)) throw new Error('Review kræver et resultat og en gyldig handling. Tekstgrænsen er 4.000 tegn pr. felt.');
  return value as unknown as ReviewInput;
}
function isCommit(value: unknown): value is DecisionCommit {
  return isRecord(value) && hasShape(value, ['id', 'createdAt', 'snapshot']) && isId(value.id) && isDate(value.createdAt) &&
    isRecord(value.snapshot) && hasShape(value.snapshot, contentFields, optionalContent) && isContent(value.snapshot, true);
}
function isReview(value: unknown): value is DecisionReview {
  if (!isRecord(value) || !hasShape(value, ['id', 'commitId', 'createdAt', 'outcome', 'whatChanged', 'lessons', 'action']) ||
      !isId(value.id) || !isId(value.commitId) || !isDate(value.createdAt)) return false;
  try { validateReviewInput({ outcome: value.outcome, whatChanged: value.whatChanged, lessons: value.lessons, action: value.action }); return true; }
  catch { return false; }
}
export function isDecision(value: unknown): value is Decision {
  if (!isRecord(value) || !hasShape(value, [...contentFields, 'id', 'status', 'commits', 'reviews', 'createdAt', 'updatedAt'], [...optionalContent, 'linkedProjectId']) ||
      !isId(value.id) || value.id === 'new' || !DECISION_STATUSES.some(status => status === value.status) ||
      !isDate(value.createdAt) || !isDate(value.updatedAt) || value.updatedAt < value.createdAt ||
      !isContent(value, value.status === 'decided' || value.status === 'closed') ||
      (value.linkedProjectId !== undefined && !isId(value.linkedProjectId)) ||
      !Array.isArray(value.commits) || value.commits.length > LIMIT.commits || !value.commits.every(isCommit) || !uniqueIds(value.commits) ||
      !Array.isArray(value.reviews) || value.reviews.length > LIMIT.reviews || !value.reviews.every(isReview) || !uniqueIds(value.reviews)) return false;
  let previousCommit = '';
  for (const commit of value.commits) {
    if (commit.createdAt < value.createdAt || commit.createdAt > value.updatedAt || commit.createdAt <= previousCommit) return false;
    previousCommit = commit.createdAt;
  }
  let previousReview = '';
  const finishedCommits = new Set<string>();
  for (const review of value.reviews) {
    const index = value.commits.findIndex(item => item.id === review.commitId);
    const commit = value.commits[index];
    const following = value.commits[index + 1];
    if (!commit || review.createdAt <= commit.createdAt || review.createdAt > value.updatedAt || review.createdAt <= previousReview ||
        (following && review.createdAt >= following.createdAt) || finishedCommits.has(review.commitId)) return false;
    if (review.action !== 'keep') finishedCommits.add(review.commitId);
    previousReview = review.createdAt;
  }
  if (value.status === 'decided' || value.status === 'closed') {
    const last = value.commits.at(-1);
    if (!last || canonical(decisionContent(value)) !== canonical(last.snapshot)) return false;
    const review = value.reviews.at(-1);
    if (review?.commitId === last.id && (review.action === 'reopen' || (value.status === 'decided' && review.action === 'close'))) return false;
  }
  return true;
}
