import { useEffect } from 'react';
import { AppShell } from './AppShell.tsx';
import { useRoute } from './router.ts';
import { CommandPage } from '../pages/CommandPage.tsx';
import { ProjectsPage } from '../pages/ProjectsPage.tsx';
import { ProjectEditorPage } from '../pages/ProjectEditorPage.tsx';
import { DecisionsPage } from '../pages/DecisionsPage.tsx';
import { DecisionEditorPage } from '../pages/DecisionEditorPage.tsx';
import { PlaceholderPage } from '../pages/PlaceholderPage.tsx';
import { SettingsPage } from '../pages/SettingsPage.tsx';
import { DiagnosticsPage } from '../pages/DiagnosticsPage.tsx';
import { MorePage } from '../pages/MorePage.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { focusRouteHeading } from './route-heading.ts';
import { OpportunitiesPage } from '../pages/OpportunitiesPage.tsx';
import { OpportunityEditorPage } from '../pages/OpportunityEditorPage.tsx';
import { OpportunityBridgePage } from '../pages/OpportunityBridgePage.tsx';

export function App() {
  const route = useRoute();
  useEffect(() => {
    window.scrollTo(0, 0);
    focusRouteHeading(document);
  }, [route.page, route.id]);
  let content;
  switch (route.page) {
    case 'command': content = <CommandPage />; break;
    case 'projects': content = <ProjectsPage />; break;
    case 'project': content = <ProjectEditorPage key={route.id} id={route.id ?? 'new'} />; break;
    case 'decisions': content = <DecisionsPage />; break;
    case 'decision': content = <DecisionEditorPage key={route.id} id={route.id ?? 'new'} />; break;
    case 'opportunities': content = <OpportunitiesPage />; break;
    case 'opportunity': content = <OpportunityEditorPage key={route.id} id={route.id ?? 'new'} />; break;
    case 'opportunity-import': content = <OpportunityBridgePage />; break;
    case 'knowledge': content = <PlaceholderPage page={route.page} />; break;
    case 'settings': content = <SettingsPage />; break;
    case 'diagnostics': content = <DiagnosticsPage />; break;
    case 'more': content = <MorePage />; break;
    default: content = <><PageHeader title="Siden findes ikke" /><a className="button" href="#/">Til Command</a></>;
  }
  return <AppShell page={route.page}>{content}</AppShell>;
}
