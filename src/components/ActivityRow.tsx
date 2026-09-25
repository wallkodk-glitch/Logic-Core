import { useId, useState } from 'react';
import type { Activity } from '../domain/types.ts';
import type { ActivityTarget } from '../domain/workspace.ts';
import { formatTime } from '../utils/format.ts';
import { Icon } from './Icon.tsx';

const labels = { COMMAND: 'Command', PROJECT: 'Project', DECISION: 'Decision', OPPORTUNITY: 'Opportunity' };
export function ActivityRow({ event, target }: { event: Activity; target: ActivityTarget }) {
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const content = <>
    <span className="activity-copy"><span id={textId} className={expanded ? 'activity-text expanded' : 'activity-text'}>{event.text}</span>
      <span className="activity-meta">{labels[target.category]} · <time dateTime={event.createdAt}>{formatTime(event.createdAt)}</time>
        {target.kind === 'unavailable' && <span className="activity-unavailable">Ikke længere tilgængelig</span>}
      </span>
    </span>
    {target.kind === 'link' && <Icon name="arrow" size={16} />}
    {target.kind === 'expand' && <span className="activity-toggle">{expanded ? 'Luk' : 'Vis'}</span>}
  </>;
  return <li>{target.kind === 'link' ? <a className="activity-row" href={target.href}>{content}</a> :
    target.kind === 'expand' ? <button type="button" className="activity-row activity-command" aria-expanded={expanded} aria-controls={textId} onClick={() => setExpanded(!expanded)}>{content}</button> :
    <div className="activity-row unavailable">{content}</div>}</li>;
}
