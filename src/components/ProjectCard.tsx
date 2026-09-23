import type { Project } from '../domain/types.ts';
import { STATUS_LABELS } from '../domain/types.ts';
import { entityHref } from '../domain/workspace.ts';
import { formatTime } from '../utils/format.ts';
import { Icon } from './Icon.tsx';

export function ProjectCard({ project }: { project: Project }) {
  return <a className="project-row" href={entityHref('project', project.id)}>
    <div className="project-content"><h3>{project.title}</h3>
      {project.description && <p className="project-description">{project.description}</p>}
      <p className="item-meta">{STATUS_LABELS[project.status]} · <time dateTime={project.updatedAt}>{formatTime(project.updatedAt)}</time></p>
    </div><Icon name="arrow" size={16} />
  </a>;
}
