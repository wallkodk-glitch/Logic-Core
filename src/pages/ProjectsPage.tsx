import { useStore } from '../storage/context.tsx';
import { ProjectCard } from '../components/ProjectCard.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { Icon } from '../components/Icon.tsx';

export function ProjectsPage() {
  const { data } = useStore();
  const projects = [...data.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <><PageHeader eyebrow="WORKSPACE / PROJECTS" title="Projekter"><span className="heading-count">{projects.length.toString().padStart(2, '0')}</span></PageHeader><a className="button full-width" href="#/projects/new"><Icon name="plus" size={18} />Nyt projekt</a>{projects.length ? <div className="project-list spaced">{projects.map(project => <ProjectCard key={project.id} project={project} />)}</div> : <div className="empty-state"><Icon name="projects" size={36} /><h2>Plads til det næste.</h2><p>Saml en idé, vælg dens status, og byg videre herfra.</p></div>}</>;
}
