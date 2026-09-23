import { Icon } from '../components/Icon.tsx';
import type { IconName } from '../components/Icon.tsx';
import { PageHeader } from '../components/PageHeader.tsx';

const links: { path: string; title: string; detail: string; icon: IconName }[] = [
  { path: 'decisions', title: 'Beslutninger', detail: 'Valg og opfølgning', icon: 'decisions' },
  { path: 'knowledge', title: 'Knowledge', detail: 'Planlagt til senere', icon: 'knowledge' },
  { path: 'settings', title: 'Indstillinger', detail: 'Data og app', icon: 'settings' },
  { path: 'diagnostics', title: 'Diagnostics', detail: 'Kontrollér kernesystemerne', icon: 'diagnostic' },
];
export function MorePage() {
  return <><PageHeader title="Dit arbejdsrum" /><div className="menu-list">{links.map(item => <a href={`#/${item.path}`} key={item.path}><span className="menu-icon"><Icon name={item.icon} /></span><span><strong>{item.title}</strong><small>{item.detail}</small></span><Icon name="arrow" size={18} /></a>)}</div></>;
}
