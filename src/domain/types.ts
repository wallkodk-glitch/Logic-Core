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

export const ACTIVITY_TYPES = ['command', 'project.created', 'project.updated', 'project.deleted'] as const;
export interface Activity {
  id: string;
  type: (typeof ACTIVITY_TYPES)[number];
  text: string;
  createdAt: string;
  projectId?: string;
}

export interface AppData {
  schemaVersion: 1;
  revision: number;
  projects: Project[];
  activity: Activity[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
