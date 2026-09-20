export const PROJECT_STATUSES = ['brainstorm', 'candidate', 'active', 'decided', 'locked', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  brainstorm: 'Brainstorm', candidate: 'Kandidat', active: 'Aktiv',
  decided: 'Besluttet', locked: 'Låst', archived: 'Arkiveret',
};

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  title: string;
  description: string;
  status: ProjectStatus;
}

export const LEGACY_ACTIVITY_TYPES = ['command', 'project.created', 'project.updated', 'project.deleted'] as const;
export const ACTIVITY_TYPES = [...LEGACY_ACTIVITY_TYPES, 'decision.created', 'decision.updated', 'decision.decided', 'decision.reopened', 'decision.reviewed', 'decision.closed', 'decision.archived', 'decision.deleted'] as const;
export interface Activity {
  id: string;
  type: (typeof ACTIVITY_TYPES)[number];
  text: string;
  createdAt: string;
  projectId?: string;
  decisionId?: string;
}

export interface AppData {
  schemaVersion: 2;
  revision: number;
  projects: Project[];
  activity: Activity[];
  decisions: Decision[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
import type { Decision } from './decisions.ts';
