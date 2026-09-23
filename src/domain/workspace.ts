import type { Activity, AppData, ProjectStatus } from './types.ts';
import { STATUS_LABELS } from './types.ts';
import { DECISION_LABELS } from './decisions.ts';
import type { DecisionStatus } from './decisions.ts';

export type ActivityCategory = 'COMMAND' | 'PROJECT' | 'DECISION';
export type ActivityTarget =
  | { category: 'COMMAND'; kind: 'expand' }
  | { category: 'PROJECT' | 'DECISION'; kind: 'link'; href: string }
  | { category: 'PROJECT' | 'DECISION'; kind: 'unavailable' };

export function entityHref(kind: 'project' | 'decision', id: string): string {
  return `#/${kind === 'project' ? 'projects' : 'decisions'}/${encodeURIComponent(id)}`;
}
export function activityTarget(event: Activity, data: Pick<AppData, 'projects' | 'decisions'>): ActivityTarget {
  if (event.type === 'command') return { category: 'COMMAND', kind: 'expand' };
  if (event.type.startsWith('decision.')) {
    return event.decisionId && data.decisions.some(item => item.id === event.decisionId)
      ? { category: 'DECISION', kind: 'link', href: entityHref('decision', event.decisionId) }
      : { category: 'DECISION', kind: 'unavailable' };
  }
  return event.projectId && data.projects.some(item => item.id === event.projectId)
    ? { category: 'PROJECT', kind: 'link', href: entityHref('project', event.projectId) }
    : { category: 'PROJECT', kind: 'unavailable' };
}

export interface RecentItem {
  key: string;
  kind: 'project' | 'decision';
  title: string;
  status: ProjectStatus | DecisionStatus;
  statusLabel: string;
  updatedAt: string;
  href: string;
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

// Current records only; archived/closed work is still reachable from its full list.
// No last-visited field, activity-derived foreign keys, or device-locale sorting.
export function recentWorkspace(data: Pick<AppData, 'projects' | 'decisions'>): RecentItem[] {
  const projects: RecentItem[] = data.projects.filter(item => item.status !== 'archived').map(item => ({
    key: `project:${item.id}`, kind: 'project', title: item.title, status: item.status,
    statusLabel: STATUS_LABELS[item.status], updatedAt: item.updatedAt, href: entityHref('project', item.id),
  }));
  const decisions: RecentItem[] = data.decisions.filter(item => item.status !== 'archived' && item.status !== 'closed').map(item => ({
    key: `decision:${item.id}`, kind: 'decision', title: item.title, status: item.status,
    statusLabel: DECISION_LABELS[item.status], updatedAt: item.updatedAt, href: entityHref('decision', item.id),
  }));
  return [...projects, ...decisions].sort((a, b) => compare(b.updatedAt, a.updatedAt) || compare(a.key, b.key)).slice(0, 3);
}
