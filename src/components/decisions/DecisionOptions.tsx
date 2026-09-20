import { DECISION_LIMITS, newOption, REVERSIBILITIES, REVERSIBILITY_LABELS } from '../../domain/decisions.ts';
import type { DecisionOption } from '../../domain/decisions.ts';
import { DecisionField } from './DecisionField.tsx';

export function DecisionOptions({ options, onChange }: { options: DecisionOption[]; onChange: (options: DecisionOption[]) => void }) {
  function patch(id: string, values: Partial<Omit<DecisionOption, 'id'>>) {
    onChange(options.map(option => option.id === id ? { ...option, ...values } : option));
  }
  return <>
    <p className="field-help">Sammenlign reelle alternativer. “Vent” eller “Gør ingenting” kan være en mulighed. Mindst to navngivne muligheder kræves ved beslutning.</p>
    {options.map((option, index) => <div className="decision-card" key={option.id}>
      <h3>Mulighed {index + 1}</h3>
      <DecisionField id={`option-${index}-title`} label="Navn" value={option.title} onChange={title => patch(option.id, { title })} singleLine maxLength={DECISION_LIMITS.title} />
      {([['description', 'Beskrivelse'], ['upside', 'Fordel / upside'], ['downside', 'Ulempe / downside'], ['opportunityCost', 'Hvad fravælger du?']] as const).map(([field, label]) =>
        <DecisionField key={field} id={`option-${index}-${field}`} label={label} value={option[field]} onChange={value => patch(option.id, { [field]: value })} maxLength={DECISION_LIMITS.optionText} />)}
      <label htmlFor={`option-${index}-reverse`}>Hvor let er valget at omgøre?</label>
      <select id={`option-${index}-reverse`} value={option.reversibility} onChange={event => {
        const reversibility = REVERSIBILITIES.find(value => value === event.target.value); if (reversibility) patch(option.id, { reversibility });
      }}>{REVERSIBILITIES.map(value => <option key={value} value={value}>{REVERSIBILITY_LABELS[value]}</option>)}</select>
      <button type="button" className="danger-link" onClick={() => {
        if (window.confirm(`Fjern mulighed ${index + 1} og dens scores fra kladden? Historiske snapshots bevares.`)) onChange(options.filter(item => item.id !== option.id));
      }}>Fjern mulighed {index + 1}</button>
    </div>)}
    <button type="button" className="button secondary" disabled={options.length >= DECISION_LIMITS.options} onClick={() => onChange([...options, newOption()])}>Tilføj mulighed</button>
    <p className="field-help">{options.length} / {DECISION_LIMITS.options} muligheder</p>
  </>;
}
