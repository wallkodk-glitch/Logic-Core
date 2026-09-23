import { DECISION_LIMITS, weightedScore } from '../../domain/decisions.ts';
import type { DecisionContent, DecisionCriterion, DecisionScore } from '../../domain/decisions.ts';
import { DecisionField } from './DecisionField.tsx';

interface Props {
  content: DecisionContent;
  onCriteria: (criteria: DecisionCriterion[]) => void;
  onScores: (scores: DecisionScore[]) => void;
}
export function DecisionScoring({ content, onCriteria, onScores }: Props) {
  function score(optionId: string, criterionId: string, value: string) {
    const rest = content.scores.filter(item => item.optionId !== optionId || item.criterionId !== criterionId);
    onScores(value === '' ? rest : [...rest, { optionId, criterionId, score: Number(value) }]);
  }
  return <>
    <p className="field-help" aria-label="ANALYTICAL SIGNAL">Scoren er et analytisk signal ud fra dine vurderinger. Højere betyder bedre match. Du vælger selv.</p>
    <p className="field-help">Scoring er valgfri. Brug ingen kriterier, eller udfyld alle mulighed × kriterium-scores før “Beslut”. Vægt 1–5; score 1–10.</p>
    {content.criteria.map((criterion, index) => <div className="decision-card" key={criterion.id}>
      <DecisionField id={`criterion-${index}`} label={`Kriterium ${index + 1}`} value={criterion.title} singleLine maxLength={DECISION_LIMITS.title}
        onChange={title => onCriteria(content.criteria.map(item => item.id === criterion.id ? { ...item, title } : item))} />
      <label htmlFor={`weight-${index}`}>Vægt</label>
      <select id={`weight-${index}`} value={criterion.weight} onChange={event => onCriteria(content.criteria.map(item => item.id === criterion.id ? { ...item, weight: Number(event.target.value) } : item))}>
        {[1, 2, 3, 4, 5].map(weight => <option key={weight} value={weight}>{weight}</option>)}
      </select>
      <div className="score-stack">{content.options.map((option, optionIndex) => <div key={option.id}>
        <label htmlFor={`score-${index}-${optionIndex}`}>{option.title || `Mulighed ${optionIndex + 1}`}</label>
        <select id={`score-${index}-${optionIndex}`} value={content.scores.find(item => item.optionId === option.id && item.criterionId === criterion.id)?.score ?? ''}
          onChange={event => score(option.id, criterion.id, event.target.value)}>
          <option value="">Ikke vurderet</option>{Array.from({ length: 10 }, (_, offset) => offset + 1).map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>)}</div>
      <button type="button" className="danger-link" onClick={() => {
        if (window.confirm(`Fjern kriterium ${index + 1} og dets scores fra kladden?`)) onCriteria(content.criteria.filter(item => item.id !== criterion.id));
      }}>Fjern kriterium {index + 1}</button>
    </div>)}
    <button type="button" className="button secondary" disabled={content.criteria.length >= DECISION_LIMITS.criteria} onClick={() => onCriteria([...content.criteria, { id: crypto.randomUUID(), title: '', weight: 3 }])}>Tilføj kriterium</button>
    {content.criteria.length > 0 && <div className="score-results" aria-label="Analytical signal">
      <p className="section-caption">Vægtet vurdering</p>
      {content.options.map((option, index) => {
        const total = weightedScore(content, option.id);
        return <p key={option.id}><span>{option.title || `Mulighed ${index + 1}`}</span><strong>{total === null ? 'Ufuldstændig' : `${total.toFixed(2)} / 10`}</strong></p>;
      })}
      <small>sum(vægt × score) / sum(vægt). Ingen total ved manglende scores. Lige resultater er tilladt.</small>
    </div>}
  </>;
}
