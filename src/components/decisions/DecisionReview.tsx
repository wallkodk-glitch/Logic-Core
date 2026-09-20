import { useState } from 'react';
import type { Decision, ReviewInput } from '../../domain/decisions.ts';
import { REVIEW_ACTIONS, REVIEW_LABELS } from '../../domain/decisions.ts';
import { useStore } from '../../storage/context.tsx';
import { DecisionField } from './DecisionField.tsx';

export function DecisionReview({ decision, stale, onSaved }: { decision: Decision; stale: boolean; onSaved: (decision: Decision) => void }) {
  const { store } = useStore();
  const [input, setInput] = useState<ReviewInput>({ outcome: '', whatChanged: '', lessons: '', action: 'keep' });
  const [notice, setNotice] = useState('');
  return <section className="decision-section review-form"><h2>Review · resultat og læring</h2>
    <p className="field-help">Review tilføjes til det seneste snapshot. Det ændrer ikke, hvad du troede dengang.</p>
    <form className="project-form" onSubmit={event => {
      event.preventDefault();
      if (input.action !== 'keep' && !window.confirm(`Gem review og ${input.action === 'reopen' ? 'genåbn' : 'afslut'} beslutningen? Historikken bevares.`)) return;
      const result = store.reviewDecision(decision.id, input, decision.updatedAt);
      if (result.ok) onSaved(result.value); else setNotice(result.error);
    }}>
      <DecisionField id="review-outcome" label="Hvad skete der?" value={input.outcome} onChange={outcome => setInput({ ...input, outcome })} help="Kræves for at gemme review." />
      <DecisionField id="review-changed" label="Hvad ændrede sig?" value={input.whatChanged} onChange={whatChanged => setInput({ ...input, whatChanged })} />
      <DecisionField id="review-lessons" label="Hvad lærte jeg?" value={input.lessons} onChange={lessons => setInput({ ...input, lessons })} />
      <label htmlFor="review-action">Handling efter review</label>
      <select id="review-action" value={input.action} onChange={event => {
        const action = REVIEW_ACTIONS.find(value => value === event.target.value); if (action) setInput({ ...input, action });
      }}>{REVIEW_ACTIONS.map(action => <option key={action} value={action}>{REVIEW_LABELS[action]}</option>)}</select>
      <p className="form-message" role="alert">{notice}</p>
      <button className="button" type="submit" disabled={!input.outcome.trim() || stale}>Gem review · {REVIEW_LABELS[input.action]}</button>
    </form>
  </section>;
}
