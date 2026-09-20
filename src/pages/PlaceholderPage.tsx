import { PageHeader } from '../components/PageHeader.tsx';
import { Icon } from '../components/Icon.tsx';
import type { IconName } from '../components/Icon.tsx';

const modules: Record<string, { title: string; eyebrow: string; icon: IconName; description: string; future: string }> = {
  opportunities: { title: 'Muligheder', eyebrow: 'WORKSPACE / OPPORTUNITIES', icon: 'opportunity', description: 'Et sted til muligheder, der fortjener din opmærksomhed.', future: 'Opportunity Hunter' },
  knowledge: { title: 'Knowledge', eyebrow: 'WORKSPACE / KNOWLEDGE', icon: 'knowledge', description: 'Et sted til viden, der skal leve videre.', future: 'Knowledge / Memory' },
};
export function PlaceholderPage({ page }: { page: 'opportunities' | 'knowledge' }) {
  const module = modules[page]!;
  return <><PageHeader eyebrow={module.eyebrow} title={module.title} /><div className="module-placeholder"><span className="module-icon"><Icon name={module.icon} size={34} /></span><span className="badge">PLANLAGT</span><h2>{module.description}</h2><p>{module.future} kommer i en senere version. Fundamentet starter med projekter.</p><a className="text-link" href="#/projects">Åbn projekter <Icon name="arrow" size={18} /></a></div></>;
}
