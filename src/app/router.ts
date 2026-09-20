import { useSyncExternalStore } from 'react';

export type Page = 'command' | 'projects' | 'project' | 'decisions' | 'decision' | 'opportunities' | 'knowledge' | 'settings' | 'diagnostics' | 'more' | 'not-found';
export interface Route { page: Page; id?: string }

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const routes: Record<string, Page> = { '/': 'command', '/projects': 'projects', '/decisions': 'decisions', '/opportunities': 'opportunities', '/knowledge': 'knowledge', '/settings': 'settings', '/diagnostics': 'diagnostics', '/more': 'more' };
  if (routes[path]) return { page: routes[path] };
  const project = /^\/projects\/([\w-]+)$/.exec(path);
  if (project?.[1]) return { page: 'project', id: project[1] };
  const decision = /^\/decisions\/([^/]+)$/.exec(path);
  if (decision?.[1]) {
    try {
      const id = decodeURIComponent(decision[1]);
      if (id.trim() === id && id.length > 0 && id.length <= 128 && !/[\u0000-\u001f\u007f]/.test(id)) return { page: 'decision', id };
    } catch { /* Malformed imported/bookmarked routes fail safely. */ }
  }
  return { page: 'not-found' };
}

const subscribe = (listener: () => void) => {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
};
export function useRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, () => window.location.hash));
}
export function navigate(path: string): void { window.location.hash = path; }
