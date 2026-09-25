import type { SourceSnapshot } from '../../domain/opportunities.ts';
import { formatTime } from '../../utils/format.ts';

export function OpportunitySource({ snapshot }: { snapshot: SourceSnapshot }) {
  const a = snapshot.payload.analysis;
  return <div className="opportunity-source">
    <p className="field-help">AI / importeret kilde · {snapshot.sourceLabel}. Uændrelig kildeversion; indholdet er ikke verificeret af Logic Core.</p>
    <dl className="belief-list"><div><dt>Genereret</dt><dd>{formatTime(snapshot.generatedAt)}</dd></div><div><dt>Importeret</dt><dd>{formatTime(snapshot.importedAt)}</dd></div>
      {snapshot.sourceRunId && <div><dt>Run</dt><dd>{snapshot.sourceRunId}</dd></div>}
      {([['title', 'Kildens titel'], ['domain', 'Domæne'], ['summary', 'Resumé'], ['thesis', 'Tese'], ['whyNow', 'Hvorfor nu?'], ['upside', 'Potentiale'], ['downside', 'Ulemper og risiko'], ['nextTest', 'Næste test']] as const).map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{a[field] || 'Ikke angivet'}</dd></div>)}
    </dl>
    {([['evidence', 'Evidens'], ['constraints', 'Rammer'], ['assumptions', 'Antagelser'], ['unknowns', 'Ukendte forhold']] as const).map(([field, label]) => a[field].length > 0 && <div className="source-list" key={field}><h3>{label}</h3><ul>{a[field].map((text, i) => <li key={i}>{text}</li>)}</ul></div>)}
    {!!a.sourceLinks.length && <div className="source-list"><h3>Kildelinks</h3><p className="field-help">Eksterne sider åbnes kun, når du trykker på et link.</p><ul>{a.sourceLinks.map(url => <li key={url}><a className="text-link" href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{url}</a></li>)}</ul></div>}
  </div>;
}
