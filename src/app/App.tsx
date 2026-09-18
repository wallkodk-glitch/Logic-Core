import { useEffect } from 'react';
import { AppShell } from './AppShell.tsx';
import { useRoute } from './router.ts';
import { CommandPage } from '../pages/CommandPage.tsx';
import { ProjectsPage } from '../pages/ProjectsPage.tsx';
import { ProjectEditorPage } from '../pages/ProjectEditorPage.tsx';
import { PlaceholderPage } from '../pages/PlaceholderPage.tsx';
import { SettingsPage } from '../pages/SettingsPage.tsx';
import { DiagnosticsPage } from '../pages/DiagnosticsPage.tsx';
import { MorePage } from '../pages/MorePage.tsx';
import { PageHeader } from '../components/PageHeader.tsx';

export function App() {
  const route = useRoute();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    document.title = `${document.querySelector('h1')?.textContent ?? 'Command'} · Logic Core`;
  }, [route.page, route.id]);
  let content;
  switch (route.page) {
    case 'command': content = <CommandPage />; break;
    case 'projects': content = <ProjectsPage />; break;
    case 'project': content = <ProjectEditorPage key={route.id} id={route.id ?? 'new'} />; break;
    case 'decisions': case 'opportunities': case 'knowledge': content = <PlaceholderPage page={route.page} />; break;
    case 'settings': content = <SettingsPage />; break;
    case 'diagnostics': content = <DiagnosticsPage />; break;
    case 'more': content = <MorePage />; break;
    default: content = <><PageHeader eyebrow="LOGIC CORE" title="Siden findes ikke" /><a className="button" href="#/">Til Command</a></>;
  }
  return <AppShell page={route.page}>{content}</AppShell>;
}
