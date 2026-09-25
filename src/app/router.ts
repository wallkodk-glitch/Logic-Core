import { useSyncExternalStore } from 'react';
import { createNavigationGuard } from './navigation-guard.ts';
import { hasPendingWork } from './pending-work.ts';

export type Page = 'command' | 'projects' | 'project' | 'decisions' | 'decision' | 'opportunities' | 'opportunity' | 'opportunity-import' | 'knowledge' | 'settings' | 'diagnostics' | 'more' | 'not-found';
export interface Route { page: Page; id?: string }

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const routes: Record<string, Page> = { '/': 'command', '/projects': 'projects', '/decisions': 'decisions', '/opportunities': 'opportunities', '/knowledge': 'knowledge', '/settings': 'settings', '/diagnostics': 'diagnostics', '/more': 'more' };
  if (routes[path]) return { page: routes[path] };
  if (path === '/opportunities/import') return { page: 'opportunity-import' };
  const item = /^\/(projects|decisions|opportunities)\/([^/]+)$/.exec(path);
  if (item?.[2]) {
    try {
      const id = decodeURIComponent(item[2]);
      if (id.trim() === id && id.length > 0 && id.length <= 128 && !/[\u0000-\u001f\u007f]/.test(id)) return { page: item[1] === 'projects' ? 'project' : item[1] === 'decisions' ? 'decision' : 'opportunity', id };
    } catch { /* Malformed imported/bookmarked routes fail safely. */ }
  }
  return { page: 'not-found' };
}

const listeners = new Set<() => void>();
let navigation: ReturnType<typeof createNavigationGuard> | undefined;
function guard() {
  if (navigation) return navigation;
  navigation = createNavigationGuard({
    read: () => window.location.hash,
    write: hash => { if (window.location.hash !== hash) window.location.hash = hash; },
    replace: hash => window.history.replaceState(window.history.state, '', hash),
    dirty: hasPendingWork,
    confirm: () => window.confirm('Du har ugemt arbejde. Forlad siden og kassér ændringerne?'),
    publish: () => listeners.forEach(listener => listener()),
  });
  window.addEventListener('hashchange', () => navigation!.changed());
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.search !== window.location.search || !url.hash.startsWith('#/')) return;
    event.preventDefault(); navigation!.go(url.hash);
  });
  window.addEventListener('beforeunload', event => {
    if (hasPendingWork()) { event.preventDefault(); event.returnValue = ''; }
  });
  return navigation;
}
const subscribe = (listener: () => void) => { guard(); listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, () => guard().snapshot(), () => '#/'));
}
export function navigate(path: string): boolean { return guard().go(path); }
