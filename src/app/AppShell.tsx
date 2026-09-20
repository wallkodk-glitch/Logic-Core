import type { ReactNode } from 'react';
import type { Page } from './router.ts';
import { Icon } from '../components/Icon.tsx';
import type { IconName } from '../components/Icon.tsx';
import { useStore } from '../storage/context.tsx';
import { useKeyboard, useOnline } from './useDevice.ts';
import { APP_VERSION } from '../config.ts';
import { usePwa } from '../pwa/register.ts';

const nav: { href: string; label: string; icon: IconName; pages: Page[] }[] = [
  { href: '#/', label: 'Command', icon: 'command', pages: ['command'] },
  { href: '#/projects', label: 'Projekter', icon: 'projects', pages: ['projects', 'project'] },
  { href: '#/opportunities', label: 'Muligheder', icon: 'opportunity', pages: ['opportunities'] },
  { href: '#/more', label: 'Mere', icon: 'more', pages: ['more', 'decisions', 'decision', 'knowledge', 'settings', 'diagnostics', 'not-found'] },
];

export function AppShell({ page, children }: { page: Page; children: ReactNode }) {
  const online = useOnline();
  const keyboardOpen = useKeyboard();
  const { error } = useStore();
  const pwa = usePwa();
  return <div className={`app-shell${keyboardOpen ? ' keyboard-open' : ''}`}>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Gå til indhold</a>
    <header className="topbar"><a href="#/" className="wordmark" aria-label="Logic Core · Command"><span className="brand-mark" aria-hidden="true">L</span><span>LOGIC<span className="wordmark-core">CORE</span></span></a><span className="connection"><span className={`signal${online ? '' : ' offline'}`} />{online ? 'ONLINE' : 'OFFLINE'}</span></header>
    <main id="main-content" tabIndex={-1} className="main-content">
      {error && <div className="notice error" role="alert"><strong>Lagring kræver opmærksomhed</strong><p>{error}</p><a href="#/diagnostics">Åbn Diagnostics <Icon name="arrow" size={16} /></a></div>}
      {pwa.status === 'update' && <div className="notice" role="status">En opdatering er hentet. Gem dit arbejde, luk alle Logic Core-vinduer, og åbn appen igen.</div>}
      {children}
      <footer className="page-footer"><span>LOGIC CORE</span><span>FOUNDATION / {APP_VERSION}</span></footer>
    </main>
    <nav className="bottom-nav" aria-label="Hovednavigation">{nav.map(item => <a key={item.href} href={item.href} aria-current={item.pages.includes(page) ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span></a>)}</nav>
  </div>;
}
