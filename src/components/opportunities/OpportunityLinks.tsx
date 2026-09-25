import { useStore } from '../../storage/context.tsx';
import { OPPORTUNITY_LIMITS } from '../../domain/opportunities.ts';
import type { OpportunityInput } from '../../domain/opportunities.ts';
import { entityHref } from '../../domain/workspace.ts';

export function OpportunityLinks({ input, onChange }: { input: OpportunityInput; onChange(value: OpportunityInput): void }) {
  const { data } = useStore();
  return <details className="decision-section"><summary>Links · {input.linkedProjectIds.length + input.linkedDecisionIds.length}</summary>
    <p className="field-help">Op til 10 projekter og 10 beslutninger. Links gemmes sammen med dit arbejdsrum.</p>
    {(['project', 'decision'] as const).map(kind => {
      const field = kind === 'project' ? 'linkedProjectIds' : 'linkedDecisionIds'; const items = kind === 'project' ? data.projects : data.decisions;
      return <fieldset className="link-options" key={kind}><legend>{kind === 'project' ? 'Projekter' : 'Beslutninger'}</legend>
        {!items.length && <p className="field-help">Ingen endnu.</p>}
        {items.map(item => <label className="link-option" key={item.id}><input type="checkbox" checked={input[field].includes(item.id)}
          disabled={!input[field].includes(item.id) && input[field].length >= OPPORTUNITY_LIMITS.links}
          onChange={event => onChange({ ...input, [field]: event.target.checked ? [...input[field], item.id] : input[field].filter(id => id !== item.id) })} /><span>{item.title}</span></label>)}
        {items.filter(item => input[field].includes(item.id)).map(item => <a key={item.id} className="text-link related-link" href={entityHref(kind, item.id)}>Åbn: {item.title}</a>)}
      </fieldset>;
    })}
  </details>;
}
