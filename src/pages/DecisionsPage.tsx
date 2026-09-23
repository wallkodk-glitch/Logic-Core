import { useState } from 'react';
import { PageHeader } from '../components/PageHeader.tsx';
import { Icon } from '../components/Icon.tsx';
import { useStore } from '../storage/context.tsx';
import { DECISION_LABELS, DECISION_STATUSES, isReviewDue } from '../domain/decisions.ts';
import type { DecisionStatus } from '../domain/decisions.ts';
import { formatTime } from '../utils/format.ts';
import { useNow } from '../app/useNow.ts';

export function DecisionsPage() {
  const { data } = useStore();
  const now = useNow();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DecisionStatus | 'all' | 'due'>('all');
  const term = query.trim().toLowerCase();
  const visible = data.decisions.filter(decision =>
    (filter === 'all' || (filter === 'due' ? isReviewDue(decision, now) : decision.status === filter)) &&
    `${decision.title}\n${decision.goal}`.toLowerCase().includes(term))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  return <>
    <PageHeader title="Beslutninger" />
    <a className="button" href="#/decisions/new"><Icon name="plus" size={18} />Ny beslutning</a>
    {data.decisions.length > 0 && <div className="decision-filters project-form">
      <label htmlFor="decision-search">Søg i titel og mål</label><input id="decision-search" type="search" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} />
      <label htmlFor="decision-filter">Vis</label><select id="decision-filter" value={filter} onChange={event => {
        const value = event.target.value;
        if (value === 'all' || value === 'due') setFilter(value); else { const status = DECISION_STATUSES.find(item => item === value); if (status) setFilter(status); }
      }}><option value="all">Alle statusser</option><option value="due">Review forfalder</option>{DECISION_STATUSES.map(status => <option key={status} value={status}>{DECISION_LABELS[status]}</option>)}</select>
    </div>}
    <p className="count">{visible.length} / {data.decisions.length} beslutninger</p>
    {!visible.length && <p className="empty-log muted">{data.decisions.length ? 'Ingen beslutninger matcher dit filter.' : 'Start med en beslutning, hvor retning og trade-offs betyder noget.'}</p>}
    <div className="project-list">{visible.map(decision => {
      const project = data.projects.find(item => item.id === decision.linkedProjectId);
      return <a className="project-row" key={decision.id} href={`#/decisions/${encodeURIComponent(decision.id)}`}>
        <div className="project-content"><div className="project-topline"><span className={`badge status-${decision.status}`}>{DECISION_LABELS[decision.status]}</span>{isReviewDue(decision, now) && <span className="review-due">Review forfalder</span>}</div>
          <h2>{decision.title}</h2>{decision.goal && <p className="project-description">{decision.goal}</p>}
          {project && <p className="field-help">Projekt: {project.title}</p>}
          <p className="field-help">Opdateret {formatTime(decision.updatedAt)}</p>
        </div><Icon name="arrow" size={16} />
      </a>;
    })}</div>
  </>;
}
