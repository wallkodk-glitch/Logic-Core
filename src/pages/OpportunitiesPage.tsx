import { useState } from 'react';
import { useStore } from '../storage/context.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { Icon } from '../components/Icon.tsx';
import { OPPORTUNITY_LABELS, OPPORTUNITY_STATUSES, opportunityReviewDue } from '../domain/opportunities.ts';
import { opportunitySignal } from '../domain/opportunity-intelligence.ts';
import { entityHref } from '../domain/workspace.ts';
import { useNow } from '../app/useNow.ts';
import { formatTime } from '../utils/format.ts';

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function OpportunitiesPage() {
  const { data } = useStore(); const now = useNow();
  const [query, setQuery] = useState(''); const [status, setStatus] = useState(''); const [domain, setDomain] = useState(''); const [sort, setSort] = useState('updated');
  const domains = [...new Set(['Business', 'Product', 'AI', ...data.opportunities.map(o => o.domain)])].sort(compare);
  const found = data.opportunities.filter(o => (!status || o.status === status) && (!domain || o.domain === domain) &&
    `${o.title}\n${o.domain}\n${o.tags.join(' ')}\n${o.notes}\n${o.sourceSnapshots.at(-1)?.payload.analysis.summary ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (sort === 'signal' ? (opportunitySignal(b.evaluation) ?? -1) - (opportunitySignal(a.evaluation) ?? -1) : 0) || compare(b.updatedAt, a.updatedAt) || compare(a.id, b.id));
  return <><PageHeader title="Muligheder" />
    <div className="form-actions"><a className="button" href="#/opportunities/import">Importér fra AI</a><a className="button secondary" href="#/opportunities/new">Ny mulighed</a></div>
    <p className="field-help">Importér en analyse, eller start lokalt. Du vælger selv retningen.</p>
    <div className="project-form decision-filters"><label htmlFor="opportunity-search">Søg i muligheder</label><input id="opportunity-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Titel, noter, tags eller seneste resumé" />
      <details className="decision-section"><summary>Filtrér og sortér{status || domain || sort !== 'updated' ? ' · aktivt' : ''}</summary>
        <label htmlFor="opportunity-filter-status">Status</label><select id="opportunity-filter-status" value={status} onChange={e => setStatus(e.target.value)}><option value="">Alle statusser</option>{OPPORTUNITY_STATUSES.map(s => <option key={s} value={s}>{OPPORTUNITY_LABELS[s]}</option>)}</select>
        <label htmlFor="opportunity-filter-domain">Domæne</label><select id="opportunity-filter-domain" value={domain} onChange={e => setDomain(e.target.value)}><option value="">Alle domæner</option>{domains.map(d => <option key={d}>{d}</option>)}</select>
        <label htmlFor="opportunity-sort">Sortering</label><select id="opportunity-sort" value={sort} onChange={e => setSort(e.target.value)}><option value="updated">Senest opdateret</option><option value="signal">Opportunity Signal</option></select>
      </details>
    </div>
    <p className="count">{found.length} af {data.opportunities.length} muligheder</p>
    {found.length ? <ul className="workspace-list">{found.map(o => { const signal = opportunitySignal(o.evaluation); return <li key={o.id}>
      <a className="workspace-row" href={entityHref('opportunity', o.id)}><span className="workspace-copy"><strong>{o.title}</strong>
        <span className="item-meta">{o.domain} · {OPPORTUNITY_LABELS[o.status]}{signal !== null ? ` · Signal ${Math.round(signal)}/100` : ''}</span>
        <span className="item-meta"><time dateTime={o.updatedAt}>{formatTime(o.updatedAt)}</time>{opportunityReviewDue(o, now) ? ' · review forfalder' : ''}</span>
      </span><Icon name="arrow" size={16} /></a>
    </li>; })}</ul> : <div className="empty-state"><h2>{data.opportunities.length ? 'Ingen match' : 'Giv en mulighed et sted at leve'}</h2><p>{data.opportunities.length ? 'Prøv en anden søgning eller fjern et filter.' : 'Kildeanalysen bevares. Dine noter, vurderinger og valg hører til i dit lokale arbejdsrum.'}</p></div>}
  </>;
}
