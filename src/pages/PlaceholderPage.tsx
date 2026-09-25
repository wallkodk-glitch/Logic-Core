import { PageHeader } from '../components/PageHeader.tsx';
import { Icon } from '../components/Icon.tsx';
import type { IconName } from '../components/Icon.tsx';

const modules: Record<string, { title: string; icon: IconName; description: string }> = {
  knowledge: { title: 'Knowledge', icon: 'knowledge', description: 'Et sted til viden, der skal leve videre.' },
};
export function PlaceholderPage({ page }: { page: 'knowledge' }) {
  const module = modules[page]!;
  return <><PageHeader title={module.title} /><div className="module-placeholder"><span className="module-icon"><Icon name={module.icon} size={28} /></span><h2>{module.description}</h2><p>Dette område kommer senere. Dine projekter og beslutninger er klar nu.</p><a className="text-link" href="#/projects">Åbn projekter <Icon name="arrow" size={18} /></a></div></>;
}
