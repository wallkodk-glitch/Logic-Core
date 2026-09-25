import type { Decision } from '../../domain/decisions.ts';
import { REVIEW_LABELS, REVERSIBILITY_LABELS, weightedScore } from '../../domain/decisions.ts';
import { formatTime } from '../../utils/format.ts';
import { DecisionDrift } from './DecisionDrift.tsx';

export function DecisionHistory({ decision }: { decision: Decision }) {
  return <section className="decision-history" aria-label="Uændret beslutningshistorik">
    <h2>Hvad troede jeg, da jeg besluttede?</h2>
    <p className="muted">Snapshots og reviews tilføjes; de redigeres aldrig i appen. {decision.commits.length} snapshots · {decision.reviews.length} reviews.</p>
    <DecisionDrift decision={decision} />
    {[...decision.commits].reverse().map((commit, reversedIndex) => {
      const snapshot = commit.snapshot;
      return <details className="decision-section" key={commit.id}>
        <summary>Snapshot {decision.commits.length - reversedIndex} · {formatTime(commit.createdAt)}</summary>
        <p className="notice">Valg: <strong>{snapshot.options.find(option => option.id === snapshot.selectedOptionId)?.title}</strong></p>
        <dl className="belief-list">{([
          ['title', 'Titel'], ['goal', 'Goal'], ['reality', 'Reality'], ['constraints', 'Constraints'], ['assumptions', 'Assumptions'],
          ['rationale', 'Begrundelse'], ['biggestRisk', 'Største risiko'], ['changeConditions', 'Hvornår ændrer jeg mening?'], ['nextAction', 'Næste handling'],
        ] as const).map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{snapshot[field] || 'Ikke angivet'}</dd></div>)}
          <div><dt>Planlagt review</dt><dd>{snapshot.reviewAt ? formatTime(snapshot.reviewAt) : 'Ikke planlagt'}</dd></div>
        </dl>
        {snapshot.options.map(option => <div key={option.id} className="decision-card">
          <h3>{option.title}</h3><dl className="belief-list">
            {([['description', 'Beskrivelse'], ['upside', 'Fordel'], ['downside', 'Ulempe'], ['opportunityCost', 'Fravalg']] as const).map(([field, label]) =>
              <div key={field}><dt>{label}</dt><dd>{option[field] || 'Ikke angivet'}</dd></div>)}
            <div><dt>Omgørlighed</dt><dd>{REVERSIBILITY_LABELS[option.reversibility]}</dd></div>
          </dl>
          {snapshot.criteria.map(criterion => <p key={criterion.id} className="history-score">{criterion.title} · vægt {criterion.weight} · score {snapshot.scores.find(score => score.optionId === option.id && score.criterionId === criterion.id)?.score}</p>)}
          {!!snapshot.criteria.length && <p className="field-help">Analytical signal: {weightedScore(snapshot, option.id)?.toFixed(2)} / 10</p>}
        </div>)}
      </details>;
    })}
    {[...decision.reviews].reverse().map((review, index) => <details className="decision-section" key={review.id}>
      <summary>Review {decision.reviews.length - index} · {REVIEW_LABELS[review.action]} · {formatTime(review.createdAt)}</summary>
      <p className="section-caption">Snapshot {decision.commits.findIndex(commit => commit.id === review.commitId) + 1}</p>
      <dl className="belief-list"><div><dt>Hvad skete der?</dt><dd>{review.outcome}</dd></div><div><dt>Hvad ændrede sig?</dt><dd>{review.whatChanged || 'Ikke angivet'}</dd></div><div><dt>Læring</dt><dd>{review.lessons || 'Ikke angivet'}</dd></div></dl>
    </details>)}
  </section>;
}
