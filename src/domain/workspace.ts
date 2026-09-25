import type { Activity, AppData, ProjectStatus } from './types.ts';
import { STATUS_LABELS } from './types.ts';
import { DECISION_LABELS } from './decisions.ts';
import type { DecisionStatus } from './decisions.ts';
import { currentOpportunity, OPPORTUNITY_LABELS } from './opportunities.ts';
import type { OpportunityStatus } from './opportunities.ts';

export type ActivityCategory = 'COMMAND' | 'PROJECT' | 'DECISION' | 'OPPORTUNITY';
export type ActivityTarget =
  | { category: 'COMMAND'; kind: 'expand' }
  | { category: Exclude<ActivityCategory, 'COMMAND'>; kind: 'link'; href: string }
  | { category: Exclude<ActivityCategory, 'COMMAND'>; kind: 'unavailable' };

export function entityHref(kind: 'project' | 'decision' | 'opportunity', id: string): string {
  return `#/${kind === 'project' ? 'projects' : kind === 'decision' ? 'decisions' : 'opportunities'}/${encodeURIComponent(id)}`;
}
export function activityTarget(event: Activity, data: Pick<AppData, 'projects' | 'decisions' | 'opportunities'>): ActivityTarget {
  if (event.type === 'command') return { category: 'COMMAND', kind: 'expand' };
  if (event.type.startsWith('opportunity.')) {
    return event.opportunityId && data.opportunities.some(item => item.id === event.opportunityId)
      ? { category: 'OPPORTUNITY', kind: 'link', href: entityHref('opportunity', event.opportunityId) }
      : { category: 'OPPORTUNITY', kind: 'unavailable' };
  }
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
  kind: 'project' | 'decision' | 'opportunity';
  title: string;
  status: ProjectStatus | DecisionStatus | OpportunityStatus;
  statusLabel: string;
  updatedAt: string;
  href: string;
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

// Current records only; archived/closed work is still reachable from its full list.
// No last-visited field, activity-derived foreign keys, or device-locale sorting.
export function recentWorkspace(data: Pick<AppData, 'projects' | 'decisions' | 'opportunities'>): RecentItem[] {
  const projects: RecentItem[] = data.projects.filter(item => item.status !== 'archived').map(item => ({
    key: `project:${item.id}`, kind: 'project', title: item.title, status: item.status,
    statusLabel: STATUS_LABELS[item.status], updatedAt: item.updatedAt, href: entityHref('project', item.id),
  }));
  const decisions: RecentItem[] = data.decisions.filter(item => item.status !== 'archived' && item.status !== 'closed').map(item => ({
    key: `decision:${item.id}`, kind: 'decision', title: item.title, status: item.status,
    statusLabel: DECISION_LABELS[item.status], updatedAt: item.updatedAt, href: entityHref('decision', item.id),
  }));
  const opportunities: RecentItem[] = data.opportunities.filter(currentOpportunity).map(item => ({
    key: `opportunity:${item.id}`, kind: 'opportunity', title: item.title, status: item.status,
    statusLabel: OPPORTUNITY_LABELS[item.status], updatedAt: item.updatedAt, href: entityHref('opportunity', item.id),
  }));
  return [...projects, ...decisions, ...opportunities].sort((a, b) => compare(b.updatedAt, a.updatedAt) || compare(a.key, b.key)).slice(0, 3);
}
