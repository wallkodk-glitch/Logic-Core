import { useEffect, useState } from 'react';
import { useStore } from '../storage/context.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { Icon } from '../components/Icon.tsx';
import { DecisionField } from '../components/decisions/DecisionField.tsx';
import { DecisionOptions } from '../components/decisions/DecisionOptions.tsx';
import { DecisionScoring } from '../components/decisions/DecisionScoring.tsx';
import { DecisionHistory } from '../components/decisions/DecisionHistory.tsx';
import { DecisionReview } from '../components/decisions/DecisionReview.tsx';
import { DECISION_LABELS, DECISION_LIMITS, decisionInput, isReviewDue, newDecisionInput, reviewDateFromInput, reviewDateInput } from '../domain/decisions.ts';
import type { Decision, DecisionCriterion, DecisionInput, DecisionOption } from '../domain/decisions.ts';
import { navigate } from '../app/router.ts';
import { useUnsavedWork } from '../app/useUnsavedWork.ts';
import { canDecide } from '../domain/decision-actions.ts';
import { useNow } from '../app/useNow.ts';
import { errorText, formatTime } from '../utils/format.ts';

export function DecisionEditorPage({ id }: { id: string }) {
  const { data } = useStore();
  const decision = data.decisions.find(item => item.id === id);
  if (id !== 'new' && !decision) return <><PageHeader title="Beslutningen findes ikke" /><p className="muted">Den kan være slettet eller erstattet via restore i et andet vindue.</p><a className="button secondary" href="#/decisions">Til beslutninger</a></>;
  return <DecisionEditor key={id} decision={decision} />;
}

function DecisionEditor({ decision }: { decision: Decision | undefined }) {
  const { store, data } = useStore();
  const now = useNow();
  const [original, setOriginal] = useState(decision);
  const [input, setInput] = useState<DecisionInput>(() => decision ? decisionInput(decision) : newDecisionInput());
  const [dirty, setDirty] = useState(!decision);
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useUnsavedWork(dirty);
  const readyToDecide = canDecide(input);
  const draft = !original || original.status === 'draft';
  const stale = !!original && decision?.updatedAt !== original.updatedAt;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change(next: DecisionInput) { setInput(next); setDirty(true); setNotice(''); }
  function text(field: 'title' | 'goal' | 'reality' | 'constraints' | 'assumptions' | 'rationale' | 'biggestRisk' | 'changeConditions' | 'nextAction', value: string) {
    change({ ...input, [field]: value });
  }
  function optional(field: 'linkedProjectId' | 'selectedOptionId' | 'reviewAt', value: string | undefined) {
    const next = { ...input };
    if (value) next[field] = value; else delete next[field];
    change(next);
  }
  function optionsChanged(options: DecisionOption[]) {
    const ids = new Set(options.map(option => option.id));
    const next = { ...input, options, scores: input.scores.filter(score => ids.has(score.optionId)) };
    if (next.selectedOptionId && !ids.has(next.selectedOptionId)) delete next.selectedOptionId;
    change(next);
  }
  function criteriaChanged(criteria: DecisionCriterion[]) {
    const ids = new Set(criteria.map(criterion => criterion.id));
    change({ ...input, criteria, scores: input.scores.filter(score => ids.has(score.criterionId)) });
  }
  function accept(saved: Decision, message: string) {
    setOriginal(saved); setInput(decisionInput(saved)); setDirty(false); setNotice(message); setConfirmDelete(false);
  }
  function save(decide = false) {
    const result = store.saveDecision(input, original?.id, original?.updatedAt, decide);
    if (!result.ok) { setNotice(result.error); return; }
    accept(result.value, decide ? 'Besluttet. Dit valg og dine antagelser er bevaret i et nyt snapshot.' : 'Kladde gemt lokalt.');
    if (!original) navigate(`/decisions/${encodeURIComponent(result.value.id)}`);
  }
  function transition(action: 'reopen' | 'close' | 'archive') {
    if (!original) return;
    if (dirty) { setNotice('Gem kladden, før du ændrer status.'); return; }
    const label = action === 'reopen' ? 'Genåbn som kladde' : action === 'close' ? 'Afslut beslutningen' : 'Arkivér beslutningen';
    if (!window.confirm(`${label}? Historiske snapshots og reviews bevares.`)) return;
    const result = store.transitionDecision(original.id, action, original.updatedAt);
    if (result.ok) accept(result.value, 'Status ændret. Historikken er bevaret.'); else setNotice(result.error);
  }
  function remove() {
    if (!original) return;
    const result = store.deleteDecision(original.id, original.updatedAt);
    if (result.ok) navigate('/decisions'); else setNotice(result.error);
  }


  return <div className="decision-editor">
    <a className="back-link" href="#/decisions" onClick={event => { if (dirty && !window.confirm('Forlad uden at gemme dine lokale ændringer?')) event.preventDefault(); }}><Icon name="back" size={16} />Beslutninger</a>
    <PageHeader title={original ? original.title : 'Ny beslutning'} />
    <div className="project-topline"><span className={`badge status-${original?.status ?? 'draft'}`}>{DECISION_LABELS[original?.status ?? 'draft']}</span>{original && isReviewDue(original, now) && <span className="review-due">Review forfalder</span>}</div>
    <p className="field-help">{dirty ? 'Ikke gemt · gem kladden, før du går videre.' : `Gemt lokalt${original ? ` · ${formatTime(original.updatedAt)}` : ''}.`}</p>
    {stale && <div className="notice error" role="alert"><p>Beslutningen er ændret i et andet vindue eller ved restore. Din lokale formular er bevaret; en forældet version kan ikke gemmes.</p><button type="button" className="button secondary" onClick={() => {
      if (decision && (!dirty || window.confirm('Kassér lokale ændringer og indlæs den nyeste gemte version?'))) accept(decision, 'Nyeste version indlæst.');
    }}>Indlæs nyeste version</button></div>}
    {!draft && <p className="form-message" role="status">{notice}</p>}
    {draft && <div className="decision-actions" aria-label="Kladdehandlinger">
      <div className="decision-action-buttons"><button type="button" className="button" disabled={!input.title.trim() || stale} onClick={() => save()}>Gem kladde</button>
        {readyToDecide && <button type="button" className="button secondary" disabled={stale} onClick={() => save(true)}>Beslut</button>}
      </div>
      <p className="form-message" role="status">{notice}</p>
    </div>}
    {!draft && <div className="notice"><p>Dette arbejdsrum er skrivebeskyttet. Genåbn som kladde for at ændre retning. Besluttede beslutninger kan også reviewes.</p><button type="button" className="button secondary" disabled={stale} onClick={() => transition('reopen')}>Genåbn som kladde</button></div>}
    <form className="project-form" onSubmit={event => { event.preventDefault(); save(); }}>
      <fieldset className="decision-workspace" disabled={!draft || stale}>
        <details className="decision-section" open><summary>Mål</summary>
          <DecisionField id="decision-title" label="Titel" value={input.title} onChange={value => text('title', value)} singleLine maxLength={DECISION_LIMITS.title} />
          <DecisionField id="decision-goal" label="Hvad vil jeg opnå?" value={input.goal} onChange={value => text('goal', value)} help="Titel og mål kræves, før du beslutter." />
          <label htmlFor="decision-project">Tilknyttet projekt · valgfrit</label>
          <select id="decision-project" value={input.linkedProjectId ?? ''} onChange={event => optional('linkedProjectId', event.target.value)}><option value="">Intet projekt</option>{data.projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select>
        </details>
        <details className="decision-section"><summary>Virkelighed</summary>
          <DecisionField id="decision-reality" label="Hvad ved jeg faktisk?" value={input.reality} onChange={value => text('reality', value)} help="Beskriv observationer og grundlag. Det er dine input, ikke verificerede fakta fra Logic Core." />
        </details>
        <details className="decision-section"><summary>Rammer og antagelser</summary>
          <DecisionField id="decision-constraints" label="Hvilke begrænsninger gælder?" value={input.constraints} onChange={value => text('constraints', value)} />
          <DecisionField id="decision-assumptions" label="Hvad antager jeg?" value={input.assumptions} onChange={value => text('assumptions', value)} />
        </details>
        <details className="decision-section"><summary>Muligheder og fravalg</summary><DecisionOptions options={input.options} onChange={optionsChanged} /></details>
        <details className="decision-section"><summary>Vurdering · valgfri</summary><DecisionScoring content={input} onCriteria={criteriaChanged} onScores={scores => change({ ...input, scores })} /></details>
        <details className="decision-section"><summary>Dit valg</summary>
          <label htmlFor="decision-choice">Mit valg · altid manuelt</label>
          <select id="decision-choice" value={input.selectedOptionId ?? ''} onChange={event => optional('selectedOptionId', event.target.value)}><option value="">Jeg har ikke valgt endnu</option>{input.options.map((option, index) => <option key={option.id} value={option.id}>{option.title || `Mulighed ${index + 1}`}</option>)}</select>
          <DecisionField id="decision-rationale" label="Hvorfor vælger jeg dette?" value={input.rationale} onChange={value => text('rationale', value)} />
          <DecisionField id="decision-risk" label="Største risiko" value={input.biggestRisk} onChange={value => text('biggestRisk', value)} />
          <DecisionField id="decision-change" label="Hvad ville få mig til at ændre mening?" value={input.changeConditions} onChange={value => text('changeConditions', value)} />
        </details>
        <details className="decision-section"><summary>Handling og review</summary>
          <DecisionField id="decision-next" label="Næste konkrete handling" value={input.nextAction} onChange={value => text('nextAction', value)} help="Kræves før beslutning. Vælg en handling, du faktisk kan udføre." />
          <label htmlFor="decision-review-date">Planlagt review · valgfri dato</label>
          <input id="decision-review-date" type="date" value={reviewDateInput(input.reviewAt)} onChange={event => {
            try { optional('reviewAt', reviewDateFromInput(event.target.value)); } catch (error) { setNotice(errorText(error)); }
          }} />
          <p className="field-help">Forfalder ved slutningen af den valgte dag i enhedens tidszone. Ingen push-notifikationer.</p>
        </details>
      </fieldset>
    </form>
    {original?.status === 'decided' && <DecisionReview key={original.updatedAt} decision={original} stale={stale} onSaved={saved => accept(saved, 'Review gemt. Historikken er bevaret.')} />}
    {original && <>
      <DecisionHistory decision={original} />
      <section className="decision-section"><h2>Status og sletning</h2><p className="field-help">Arkivering og genåbning bevarer historik. Sletning fjerner beslutningen inklusive alle snapshots og reviews.</p>
        <div className="form-actions">{original.status === 'decided' && <button type="button" className="button secondary" disabled={stale || dirty} onClick={() => transition('close')}>Afslut beslutning</button>}{original.status !== 'archived' && <button type="button" className="button secondary" disabled={stale || dirty} onClick={() => transition('archive')}>Arkivér</button>}</div>
        {confirmDelete ? <div className="delete-confirm" role="group" aria-label="Bekræft sletning af beslutning"><p><strong>Slet “{original.title}” og hele dens historik permanent?</strong></p><p>Eksportér først en backup, hvis du vil bevare arbejdet.</p><div className="form-actions"><button type="button" className="button danger" disabled={stale} onClick={remove}>Slet beslutning permanent</button><button type="button" className="button secondary" onClick={() => setConfirmDelete(false)}>Behold beslutning</button></div></div> : <button type="button" className="danger-link" disabled={stale} onClick={() => setConfirmDelete(true)}>Slet beslutning</button>}
      </section>
    </>}
  </div>;
}
