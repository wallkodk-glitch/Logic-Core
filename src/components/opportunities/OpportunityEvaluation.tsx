import { EVALUATION_FIELDS, EVALUATION_LABELS } from '../../domain/opportunities.ts';
import type { OpportunityEvaluation as Evaluation } from '../../domain/opportunities.ts';
import { opportunitySignal } from '../../domain/opportunity-intelligence.ts';

export function OpportunityEvaluation({ value, onChange }: { value: Evaluation; onChange(value: Evaluation): void }) {
  const signal = opportunitySignal(value);
  return <details className="decision-section"><summary>Lokal vurdering{signal === null ? ' · valgfri' : ` · ${Math.round(signal)}/100`}</summary>
    <p className="field-help">Din vurdering på 1–5. For de første seks felter er 5 stærkest; for risiko er 5 højest risiko.</p>
    {EVALUATION_FIELDS.map(field => <div key={field} className="decision-field"><label htmlFor={`evaluation-${field}`}>{EVALUATION_LABELS[field]}</label>
      <select id={`evaluation-${field}`} value={value[field] ?? ''} onChange={event => { const next = { ...value }; if (event.target.value) next[field] = Number(event.target.value); else delete next[field]; onChange(next); }}>
        <option value="">Ikke vurderet</option>{[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}</option>)}
      </select></div>)}
    <p className="field-help">Opportunity Signal: {signal === null ? 'udfyld alle syv felter' : `${Math.round(signal)}/100`}. Gennemsnittet af seks positive scores og (6 − risiko), omregnet fra 1–5 til 0–100. Et analytisk signal — du vælger stadig selv status og handling.</p>
  </details>;
}
