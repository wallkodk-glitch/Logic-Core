import { useSyncExternalStore } from 'react';

export type Page = 'command' | 'projects' | 'project' | 'decisions' | 'decision' | 'opportunities' | 'knowledge' | 'settings' | 'diagnostics' | 'more' | 'not-found';
export interface Route { page: Page; id?: string }

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const routes: Record<string, Page> = { '/': 'command', '/projects': 'projects', '/decisions': 'decisions', '/opportunities': 'opportunities', '/knowledge': 'knowledge', '/settings': 'settings', '/diagnostics': 'diagnostics', '/more': 'more' };
  if (routes[path]) return { page: routes[path] };
  const item = /^\/(projects|decisions)\/([^/]+)$/.exec(path);
  if (item?.[2]) {
    try {
      const id = decodeURIComponent(item[2]);
      if (id.trim() === id && id.length > 0 && id.length <= 128 && !/[\u0000-\u001f\u007f]/.test(id)) return { page: item[1] === 'projects' ? 'project' : 'decision', id };
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
