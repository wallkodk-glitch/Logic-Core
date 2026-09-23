import { useUnsavedWork } from '../app/useUnsavedWork.ts';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../storage/context.tsx';
import { PROJECT_STATUSES, STATUS_LABELS } from '../domain/types.ts';
import type { Project, ProjectStatus } from '../domain/types.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { Icon } from '../components/Icon.tsx';
import { navigate } from '../app/router.ts';
import { formatTime } from '../utils/format.ts';

export function ProjectEditorPage({ id }: { id: string }) {
  const { data } = useStore();
  const project = data.projects.find(item => item.id === id);
  if (id !== 'new' && !project) return <><PageHeader title="Projektet findes ikke" /><p className="muted">Det kan være slettet i et andet vindue.</p><a className="button secondary" href="#/projects">Til projekter</a></>;
  return <ProjectEditor key={id} project={project} />;
}

function ProjectEditor({ project }: { project: Project | undefined }) {
  const { store } = useStore();
  const [original] = useState(project);
  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'brainstorm');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useUnsavedWork(title !== (original?.title ?? '') || description !== (original?.description ?? '') || status !== (original?.status ?? 'brainstorm'));
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = store.saveProject({ title, description, status }, original?.id, original?.updatedAt);
    if (result.ok) navigate('/projects'); else setNotice(result.error);
  }
  function remove() {
    if (!original) return;
    const result = store.deleteProject(original.id, original.updatedAt);
    if (result.ok) navigate('/projects'); else setNotice(result.error);
  }
  return <><a className="back-link" href="#/projects"><Icon name="back" size={16} />Projekter</a><PageHeader title={original ? 'Redigér projekt' : 'Nyt projekt'} /><form className="project-form" onSubmit={save}><label htmlFor="project-title">Titel</label><input id="project-title" name="title" required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="Hvad vil du bygge?" autoComplete="off" /><label htmlFor="project-description">Beskrivelse <span className="optional">valgfri</span></label><textarea id="project-description" rows={6} maxLength={10000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Formål, retning eller næste skridt…" /><label htmlFor="project-status">Status</label><select id="project-status" value={status} onChange={event => { const value = event.target.value; const match = PROJECT_STATUSES.find(item => item === value); if (match) setStatus(match); }}>{PROJECT_STATUSES.map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</select><p className="field-help">Status beskriver projektets modenhed. “Låst” er en statusmarkering og kan stadig redigeres.</p><p className="form-message" role="alert">{notice}</p><div className="form-actions"><button className="button" type="submit" disabled={!title.trim()}><Icon name="check" size={18} />Gem projekt</button><a className="button secondary" href="#/projects">Fortryd</a></div></form>{original && <section className="project-meta"><dl><div><dt>Oprettet</dt><dd>{formatTime(original.createdAt)}</dd></div><div><dt>Sidst gemt</dt><dd>{formatTime(original.updatedAt)}</dd></div></dl>{confirmDelete ? <div className="delete-confirm" role="group" aria-label="Bekræft sletning"><p><strong>Slet “{original.title}”?</strong></p><p>Projektet slettes. Tilknyttede beslutninger bevares, men deres projektlink fjernes.</p><div className="form-actions"><button className="button danger" onClick={remove}>Slet permanent</button><button className="button secondary" onClick={() => setConfirmDelete(false)}>Behold projekt</button></div></div> : <button className="danger-link" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={18} />Slet projekt</button>}</section>}</>;
}
