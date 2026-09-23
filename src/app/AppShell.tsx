import type { ReactNode } from 'react';
import type { Page } from './router.ts';
import { Icon } from '../components/Icon.tsx';
import type { IconName } from '../components/Icon.tsx';
import { useStore } from '../storage/context.tsx';
import { useKeyboard, useOnline } from './useDevice.ts';
import { UpdateNotice } from '../components/UpdateNotice.tsx';
import { usePwa } from '../pwa/register.ts';

const nav: { href: string; label: string; icon: IconName; pages: Page[] }[] = [
  { href: '#/', label: 'Hjem', icon: 'command', pages: ['command'] },
  { href: '#/projects', label: 'Projekter', icon: 'projects', pages: ['projects', 'project'] },
  { href: '#/opportunities', label: 'Muligheder', icon: 'opportunity', pages: ['opportunities'] },
  { href: '#/more', label: 'Mere', icon: 'more', pages: ['more', 'decisions', 'decision', 'knowledge', 'settings', 'diagnostics', 'not-found'] },
];

export function AppShell({ page, children }: { page: Page; children: ReactNode }) {
  const online = useOnline();
  const keyboardOpen = useKeyboard();
  const { error } = useStore();
  const pwa = usePwa();
  const updating = pwa.activation.phase === 'requesting' || pwa.activation.phase === 'reloading';
  return <div className={`app-shell${keyboardOpen ? ' keyboard-open' : ''}`}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Gå til indhold</a>
    <header className="topbar"><a href="#/" className="wordmark" aria-label="Logic Core · Forside">Logic <span>Core</span></a><span className="connection">{online ? 'Lokalt' : 'Offline'}</span></header>
    <main inert={updating} id="main-content" tabIndex={-1} className="main-content">
      {error && <div className="notice error" role="alert"><strong>Dine data kræver opmærksomhed</strong><p>{error}</p><a href="#/diagnostics">Åbn Diagnostics <Icon name="arrow" size={16} /></a></div>}
      <UpdateNotice />
      {children}
    </main>
    {updating && <div className="update-lock" role="status"><p>{pwa.activation.detail}</p></div>}
    <nav inert={updating} className="bottom-nav" aria-label="Hovednavigation">{nav.map(item => <a key={item.href} href={item.href} aria-current={item.pages.includes(page) ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span></a>)}</nav>
  </div>;
}
