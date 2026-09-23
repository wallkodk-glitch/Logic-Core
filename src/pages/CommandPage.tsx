import { useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../storage/context.tsx';
import { useUnsavedWork } from '../app/useUnsavedWork.ts';
import { Icon } from '../components/Icon.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { ActivityRow } from '../components/ActivityRow.tsx';
import { activityTarget, recentWorkspace } from '../domain/workspace.ts';
import { formatTime } from '../utils/format.ts';

export function CommandPage() {
  const { store, data } = useStore();
  const [command, setCommand] = useState('');
  const [notice, setNotice] = useState('');
  useUnsavedWork(command.length > 0);
  const recent = recentWorkspace(data);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = store.addCommand(command);
    if (result.ok) { setCommand(''); setNotice('Gemt i din aktivitet.'); }
    else setNotice(result.error);
  }
  return <>
    <PageHeader title="Dit overblik" />
    <form onSubmit={submit} className="command-box">
      <label htmlFor="command">Gem en tanke</label>
      <textarea id="command" rows={2} maxLength={4000} value={command} onChange={event => { setCommand(event.target.value); setNotice(''); }} placeholder="En idé, et spørgsmål, et næste skridt…" />
      <div className="command-bottom"><span className="field-help">Kun på din enhed</span><button className="send-button" aria-label="Gem kommando" disabled={!command.trim()}><Icon name="arrow" size={20} /></button></div>
    </form>
    <p className="form-message" role="status">{notice}</p>
    <section className="content-section" aria-labelledby="continue-title">
      <div className="section-heading"><h2 id="continue-title">Fortsæt</h2></div>
      {recent.length ? <ul className="workspace-list">{recent.map(item => <li key={item.key}>
        <a className="workspace-row" href={item.href}><span className="workspace-copy">
          <strong>{item.title}</strong><span className="item-meta">{item.kind === 'project' ? 'Projekt' : 'Beslutning'} · {item.statusLabel} · <time dateTime={item.updatedAt}>{formatTime(item.updatedAt)}</time></span>
        </span><Icon name="arrow" size={16} /></a>
      </li>)}</ul> : <p className="empty-log">Dit seneste arbejde vises her. <a className="text-link" href="#/projects/new">Opret et projekt</a></p>}
    </section>
    <section className="content-section" aria-labelledby="activity-title">
      <div className="section-heading"><h2 id="activity-title">Seneste aktivitet</h2></div>
      {data.activity.length ? <ol className="activity-list">{data.activity.slice(0, 6).map(event => <ActivityRow key={event.id} event={event} target={activityTarget(event, data)} />)}</ol> :
        <p className="empty-log">Her samles dine tanker og ændringer.</p>}
    </section>
  </>;
}
