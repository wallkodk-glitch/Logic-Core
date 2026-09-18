import { useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../storage/context.tsx';
import { Icon } from '../components/Icon.tsx';
import { ProjectCard } from '../components/ProjectCard.tsx';
import { formatTime } from '../utils/format.ts';

export function CommandPage() {
  const { store, data, error } = useStore();
  const [command, setCommand] = useState('');
  const [notice, setNotice] = useState('');
  const active = data.projects.filter(project => project.status === 'active').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = store.addCommand(command);
    if (result.ok) { setCommand(''); setNotice('Gemt i din aktivitet.'); }
    else setNotice(result.error);
  }
  return <>
    <section className="command-intro"><div className="intro-top"><p className="eyebrow">PERSONAL OPERATING SYSTEM</p><span className={`core-state${error ? ' warning' : ''}`}>{error ? 'Tjek lagring' : 'Lokal tilstand'}</span></div><div className="command-title"><h1 tabIndex={-1}>Afventer<br /><span>kommando, Hr.</span></h1><div className="core-orbit" aria-hidden="true"><span /></div></div></section>
    <form onSubmit={submit} className="command-box"><label htmlFor="command" className="eyebrow"><Icon name="command" size={17} /> COMMAND INPUT</label><textarea id="command" rows={3} maxLength={4000} value={command} onChange={event => { setCommand(event.target.value); setNotice(''); }} placeholder="Hvad skal vi arbejde på?" /><div className="command-bottom"><p>Gem en tanke.<br /><span>AI tilsluttes senere.</span></p><button className="send-button" aria-label="Gem kommando" disabled={!command.trim()}><Icon name="arrow" /></button></div></form>
    <p className="form-message" role="status">{notice}</p>
    <section className="content-section"><div className="section-heading"><h2>Aktive projekter <span className="count">{active.length.toString().padStart(2, '0')}</span></h2><a href="#/projects" className="text-link">Se alle <Icon name="arrow" size={16} /></a></div>{active.length ? <div className="project-list">{active.slice(0, 3).map(project => <ProjectCard key={project.id} project={project} />)}</div> : <a className="empty-inline" href="#/projects/new"><span className="empty-plus"><Icon name="plus" /></span><span><strong>Giv den næste idé en retning.</strong><small>Opret dit første aktive projekt.</small></span><Icon name="arrow" size={18} /></a>}</section>
    <section className="content-section"><div className="section-heading"><h2>Seneste aktivitet</h2><span className="eyebrow">LOG</span></div>{data.activity.length ? <ol className="activity-list">{data.activity.slice(0, 6).map(event => <li key={event.id}><span className="activity-tick" /><div><p>{event.text}</p><span className="activity-meta">{event.type === 'command' ? 'COMMAND' : 'PROJEKT'}<span> / </span><time dateTime={event.createdAt}>{formatTime(event.createdAt)}</time></span></div></li>)}</ol> : <p className="muted empty-log">Dit arbejdsrum er klar. Aktiviteten begynder med din første handling.</p>}</section>
  </>;
}
