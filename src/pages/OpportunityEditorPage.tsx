import { useState } from 'react';
import { useStore } from '../storage/context.tsx';
import { useUnsavedWork } from '../app/useUnsavedWork.ts';
import { navigate } from '../app/router.ts';
import { useNow } from '../app/useNow.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { OpportunitySource } from '../components/opportunities/OpportunitySource.tsx';
import { OpportunityEvaluation } from '../components/opportunities/OpportunityEvaluation.tsx';
import { OpportunityLinks } from '../components/opportunities/OpportunityLinks.tsx';
import { newOpportunityInput, opportunityInput, OPPORTUNITY_LABELS, OPPORTUNITY_LIMITS as L, OPPORTUNITY_STATUSES, opportunityReviewDue } from '../domain/opportunities.ts';
import type { Opportunity, OpportunityInput } from '../domain/opportunities.ts';
import { reviewDateInput, reviewDateFromInput } from '../domain/decisions.ts';
import { canonical } from '../storage/validation.ts';
import { errorText, formatTime } from '../utils/format.ts';

export function OpportunityEditorPage({ id }: { id: string }) {
  const { data } = useStore(); const opportunity = data.opportunities.find(o => o.id === id);
  if (id !== 'new' && !opportunity) return <><PageHeader title="Muligheden findes ikke" /><p className="muted">Den kan være slettet eller erstattet ved gendannelse.</p><a className="text-link" href="#/opportunities">Til muligheder</a></>;
  return <OpportunityEditor key={id} opportunity={opportunity} />;
}
function OpportunityEditor({ opportunity }: { opportunity: Opportunity | undefined }) {
  const { store } = useStore(); const now = useNow();
  const [original, setOriginal] = useState(opportunity);
  const [input, setInput] = useState<OpportunityInput>(() => opportunity ? opportunityInput(opportunity) : newOpportunityInput());
  const [tagsText, setTagsText] = useState(opportunity?.tags.join(', ') ?? '');
  const [notice, setNotice] = useState(''); const [deleting, setDeleting] = useState(false);
  const dirty = canonical(input) !== canonical(original ? opportunityInput(original) : newOpportunityInput()) || tagsText !== (original?.tags.join(', ') ?? '');
  const releaseWork = useUnsavedWork(dirty);
  const stale = !!original && opportunity?.updatedAt !== original.updatedAt;
  const latest = original?.sourceSnapshots.at(-1);
  function accept(saved: Opportunity) { releaseWork(); setOriginal(saved); setInput(opportunityInput(saved)); setTagsText(saved.tags.join(', ')); setDeleting(false); }
  function save() {
    if (original && input.status !== original.status && ['archived', 'rejected'].includes(input.status) && !window.confirm(`Markér muligheden som ${OPPORTUNITY_LABELS[input.status].toLowerCase()}? Kildehistorik og links bevares.`)) return;
    const result = store.saveOpportunity({ ...input, tags: tagsText.split(',').map(s => s.trim()).filter(Boolean) }, original?.id, original?.updatedAt);
    if (!result.ok) { setNotice(result.error); return; }
    accept(result.value); setNotice('Gemt lokalt. Kildehistorikken er uændret.');
    if (!original) navigate(`/opportunities/${encodeURIComponent(result.value.id)}`);
  }
  function startDecision() {
    if (!original || dirty || stale) return;
    const result = store.startOpportunityDecision(original.id, original.updatedAt);
    if (result.ok) navigate(`/decisions/${encodeURIComponent(result.value.id)}`); else setNotice(result.error);
  }
  function remove() {
    if (!original) return;
    const result = store.deleteOpportunity(original.id, original.updatedAt);
    if (result.ok) { releaseWork(); navigate('/opportunities'); } else setNotice(result.error);
  }
  return <div className="opportunity-editor"><a className="back-link" href="#/opportunities">← Muligheder</a><PageHeader title={original?.title ?? 'Ny mulighed'} />
    <p className="field-help">{dirty ? 'Ikke gemt' : original ? `Gemt ${formatTime(original.updatedAt)}` : 'Start et lokalt arbejdsrum'}{original && opportunityReviewDue(original, now) ? ' · review forfalder' : ''}</p>
    {stale && <div className="notice error" role="alert"><p>Muligheden er ændret i et andet vindue eller ved import. Din formular er bevaret; forældede ændringer kan ikke gemmes.</p><button className="button secondary" onClick={() => { if (opportunity && (!dirty || window.confirm('Kassér lokale ændringer og indlæs den nyeste version?'))) accept(opportunity); }}>Indlæs nyeste version</button></div>}
    <div className="decision-actions"><div className="decision-action-buttons"><button type="button" className="button" disabled={stale || !input.title.trim() || !input.domain.trim()} onClick={save}>Gem mulighed</button></div><p className="form-message" role="status">{notice}</p></div>
    <form className="project-form" onSubmit={event => { event.preventDefault(); save(); }}>
      <fieldset className="decision-workspace" disabled={stale}>
        <details className="decision-section" open><summary>Overblik · dit arbejdsrum</summary>
          <label htmlFor="opportunity-title">Lokal titel</label><input id="opportunity-title" maxLength={L.title} required value={input.title} onChange={e => setInput({ ...input, title: e.target.value })} />
          <label htmlFor="opportunity-domain">Domæne</label><input id="opportunity-domain" list="opportunity-domains" maxLength={L.domain} required value={input.domain} onChange={e => setInput({ ...input, domain: e.target.value })} /><datalist id="opportunity-domains"><option value="Business" /><option value="Product" /><option value="AI" /></datalist>
          <label htmlFor="opportunity-tags">Tags · adskilt med komma</label><input id="opportunity-tags" maxLength={L.tags * (L.tag + 2)} value={tagsText} onChange={e => setTagsText(e.target.value)} /><p className="field-help">Op til 12 unikke tags på højst 32 tegn.</p>
        </details>
        {latest ? <details className="decision-section"><summary>Seneste kildeanalyse · version {original!.sourceSnapshots.length}</summary><OpportunitySource snapshot={latest} /></details> : <p className="field-help">Denne mulighed er oprettet lokalt og har ingen importeret AI-kilde.</p>}
        <OpportunityEvaluation value={input.evaluation} onChange={evaluation => setInput({ ...input, evaluation })} />
        <details className="decision-section"><summary>Lokale noter og næste handling</summary>
          <label htmlFor="opportunity-notes">Dine noter</label><textarea id="opportunity-notes" rows={5} maxLength={L.notes} value={input.notes} onChange={e => setInput({ ...input, notes: e.target.value })} />
          <label htmlFor="opportunity-next">Næste handling</label><textarea id="opportunity-next" rows={3} maxLength={L.text} value={input.nextAction} onChange={e => setInput({ ...input, nextAction: e.target.value })} />
          <label htmlFor="opportunity-review">Review-dato · valgfri</label><input id="opportunity-review" type="date" value={reviewDateInput(input.reviewAt)} onChange={e => { try { const next = { ...input }; const date = reviewDateFromInput(e.target.value); if (date) next.reviewAt = date; else delete next.reviewAt; setInput(next); } catch (error) { setNotice(errorText(error)); } }} />
          <p className="field-help">Flyt eller fjern datoen efter review. Forfalder ved slutningen af dagen; ingen notifikationer.</p>
        </details>
        <OpportunityLinks input={input} onChange={setInput} />
        <details className="decision-section"><summary>Status · {OPPORTUNITY_LABELS[input.status]}</summary><label htmlFor="opportunity-status">Din status · altid manuelt</label><select id="opportunity-status" value={input.status} onChange={e => { const status = OPPORTUNITY_STATUSES.find(s => s === e.target.value); if (status) setInput({ ...input, status }); }}>{OPPORTUNITY_STATUSES.map(s => <option key={s} value={s}>{OPPORTUNITY_LABELS[s]}</option>)}</select><p className="field-help">Gem muligheden for at bekræfte status. Ingen score ændrer den automatisk.</p></details>
      </fieldset>
    </form>
    {original && <>
      <section className="content-section"><h2>Fra mulighed til beslutning</h2><p className="field-help">Opret en almindelig kladde med kildehenvisning og et forsigtigt udgangspunkt. Ingen mulighed vælges automatisk.{dirty ? ' Gem først dine ændringer.' : ''}</p><button className="button secondary start-decision" disabled={dirty || stale} onClick={startDecision}>Start beslutning</button></section>
      {!!original.sourceSnapshots.length && <details className="decision-section"><summary>Kildehistorik · {original.sourceSnapshots.length} versioner</summary><p className="field-help">Bridge key: {original.bridgeKey}. Tidligere versioner ændres aldrig af lokal redigering eller re-import.</p>
        {[...original.sourceSnapshots].reverse().map((snapshot, i) => <details className="decision-section" key={snapshot.id}><summary>Version {original.sourceSnapshots.length - i} · {formatTime(snapshot.importedAt)} · {snapshot.sourceLabel}</summary><OpportunitySource snapshot={snapshot} /></details>)}
      </details>}
      <section className="content-section">{deleting ? <div className="delete-confirm"><p><strong>Slet “{original.title}” og alle kildeversioner permanent?</strong></p><p>Projekter og beslutninger bevares. Eksportér først en backup, hvis du vil beholde analysen.</p><div className="form-actions"><button className="button danger" disabled={stale} onClick={remove}>Slet permanent</button><button className="button secondary" onClick={() => setDeleting(false)}>Behold mulighed</button></div></div> : <button className="danger-link" disabled={stale} onClick={() => setDeleting(true)}>Slet mulighed</button>}</section>
    </>}
  </div>;
}
