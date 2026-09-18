import type { Project } from '../domain/types.ts';
import { STATUS_LABELS } from '../domain/types.ts';
import { formatTime } from '../utils/format.ts';
import { Icon } from './Icon.tsx';

export function ProjectCard({ project }: { project: Project }) {
  return <a className="project-row" href={`#/projects/${project.id}`}>
    <div className={`project-marker status-${project.status}`} aria-hidden="true" />
    <div className="project-content"><div className="project-topline"><span className={`badge status-${project.status}`}>{STATUS_LABELS[project.status]}</span><time dateTime={project.updatedAt}>{formatTime(project.updatedAt)}</time></div><h3>{project.title}</h3>{project.description && <p className="project-description">{project.description}</p>}</div>
    <Icon name="arrow" size={18} />
  </a>;
}
