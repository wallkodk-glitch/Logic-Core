import { DECISION_LIMITS } from '../../domain/decisions.ts';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  singleLine?: boolean;
  maxLength?: number;
  help?: string;
}
export function DecisionField({ id, label, value, onChange, singleLine = false, maxLength = DECISION_LIMITS.text, help }: Props) {
  return <div className="decision-field">
    <label htmlFor={id}>{label}</label>
    {singleLine ? <input id={id} value={value} maxLength={maxLength} autoComplete="off" onChange={event => onChange(event.target.value)} /> :
      <textarea id={id} rows={3} value={value} maxLength={maxLength} onChange={event => onChange(event.target.value)} />}
    {help && <p className="field-help">{help}</p>}
  </div>;
}
