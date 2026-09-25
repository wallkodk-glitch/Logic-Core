import { useStore } from '../storage/context.tsx';
import { entityHref } from '../domain/workspace.ts';
import { DECISION_LABELS } from '../domain/decisions.ts';
import { OPPORTUNITY_LABELS } from '../domain/opportunities.ts';

export function RelatedWork({ projectId }: { projectId: string }) {
  const { data } = useStore();
  const decisions = data.decisions.filter(item => item.linkedProjectId === projectId);
  const opportunities = data.opportunities.filter(item => item.linkedProjectIds.includes(projectId));
  if (!decisions.length && !opportunities.length) return null;
  return <section className="content-section" aria-label="Relateret arbejde"><h2>Relateret arbejde</h2><ul className="workspace-list">
    {decisions.map(d => <li key={`decision:${d.id}`}><a className="workspace-row" href={entityHref('decision', d.id)}><span className="workspace-copy"><strong>{d.title}</strong><span className="item-meta">Beslutning · {DECISION_LABELS[d.status]}</span></span></a></li>)}
    {opportunities.map(o => <li key={`opportunity:${o.id}`}><a className="workspace-row" href={entityHref('opportunity', o.id)}><span className="workspace-copy"><strong>{o.title}</strong><span className="item-meta">Mulighed · {OPPORTUNITY_LABELS[o.status]}</span></span></a></li>)}
  </ul></section>;
}
