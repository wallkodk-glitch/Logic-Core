import type { Activity, AppData, Project, ProjectInput, Result } from '../domain/types.ts';
import { PROJECT_STATUSES } from '../domain/types.ts';
import { ACTIVITY_LIMIT, emptyData, parseData, validateData } from './schema.ts';

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoreSnapshot {
  data: AppData;
  error: string | null;
}

export interface StorageProbe {
  available: boolean;
  roundTrip: boolean;
  detail: string;
}

function message(error: unknown): string {
  if (error instanceof Error && error.name === 'QuotaExceededError') {
    return 'Lageret er fyldt. Ændringen blev ikke gemt. Eksportér dine data, og frigør plads på enheden.';
  }
  if (error instanceof Error && error.name === 'SecurityError') {
    return 'Browseren tillader ikke lokal lagring. Brug et almindeligt Safari-vindue, og kontrollér browserens indstillinger.';
  }
  return error instanceof Error ? error.message : 'Lokal lagring fejlede. Ændringen kunne ikke bekræftes.';
}

export class AppStore {
  private snapshot: StoreSnapshot = { data: emptyData(), error: null };
  private listeners = new Set<() => void>();
  private raw: string | null = null;
  private loadBlocked = false;
  private readonly storage: () => StoragePort;
  readonly key: string;

  constructor(storage: () => StoragePort, key: string) {
    this.storage = storage;
    this.key = key;
    this.refresh();
  }

  getSnapshot = (): StoreSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(data: AppData, error: string | null): void {
    this.snapshot = { data, error };
    this.listeners.forEach(listener => listener());
  }

  refresh = (): void => {
    try {
      const raw = this.storage().getItem(this.key);
      const data = parseData(raw);
      this.raw = raw;
      this.loadBlocked = false;
      this.publish(data, null);
    } catch (error) {
      this.loadBlocked = true;
      this.publish(this.snapshot.data, message(error));
    }
  };

  private transaction<T>(change: (data: AppData) => T): Result<T> {
    try {
      if (this.loadBlocked) throw new Error(this.snapshot.error ?? 'Lagringen skal gendannes før ændringer.');
      const port = this.storage();
      if (port.getItem(this.key) !== this.raw) {
        this.refresh();
        throw new Error('Data er ændret i et andet vindue. Kontrollér projektet, og prøv igen.');
      }
      const next = structuredClone(this.snapshot.data);
      const value = change(next);
      next.revision += 1;
      validateData(next);
      const raw = JSON.stringify(next);
      // setItem is atomic. A failed write never updates the visible snapshot.
      port.setItem(this.key, raw);
      this.raw = raw;
      this.publish(next, null);
      return { ok: true, value };
    } catch (error) {
      const detail = message(error);
      this.publish(this.snapshot.data, detail);
      return { ok: false, error: detail };
    }
  }

  private record(data: AppData, type: Activity['type'], text: string, projectId?: string): void {
    const event: Activity = { id: crypto.randomUUID(), type, text, createdAt: new Date().toISOString() };
    if (projectId !== undefined) event.projectId = projectId;
    data.activity = [event, ...data.activity].slice(0, ACTIVITY_LIMIT);
  }

  saveProject(input: ProjectInput, id?: string, expectedUpdatedAt?: string): Result<Project> {
    return this.transaction(data => {
      const title = input.title.trim();
      const description = input.description.trim();
      if (!title || title.length > 120 || description.length > 10000 || !PROJECT_STATUSES.includes(input.status)) {
        throw new Error('Angiv en titel på 1–120 tegn og en gyldig projektstatus. Beskrivelsen må være højst 10.000 tegn.');
      }
      const existing = id ? data.projects.find(project => project.id === id) : undefined;
      if (id && !existing) throw new Error('Projektet findes ikke længere. Gå tilbage til projekterne.');
      if (existing && expectedUpdatedAt !== existing.updatedAt) {
        throw new Error('Projektet er ændret, siden du åbnede det. Åbn det igen for at undgå at overskrive nyere ændringer.');
      }
      // Remain monotonic even if the device clock is moved backwards.
      const timestamp = new Date(Math.max(Date.now(), existing ? Date.parse(existing.updatedAt) + 1 : 0)).toISOString();
      const project: Project = {
        id: existing?.id ?? crypto.randomUUID(), title, description, status: input.status,
        createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      };
      data.projects = existing ? data.projects.map(item => item.id === project.id ? project : item) : [project, ...data.projects];
      this.record(data, existing ? 'project.updated' : 'project.created', `${existing ? 'Opdateret' : 'Oprettet'}: ${title}`, project.id);
      return project;
    });
  }

  deleteProject(id: string, expectedUpdatedAt: string): Result<void> {
    return this.transaction(data => {
      const project = data.projects.find(item => item.id === id);
      if (!project) throw new Error('Projektet findes ikke længere.');
      if (project.updatedAt !== expectedUpdatedAt) throw new Error('Projektet er blevet ændret. Åbn det igen før sletning.');
      data.projects = data.projects.filter(item => item.id !== id);
      this.record(data, 'project.deleted', `Slettet: ${project.title}`, id);
    });
  }

  addCommand(text: string): Result<void> {
    return this.transaction(data => {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > 4000) throw new Error('Skriv en kommando på 1–4.000 tegn.');
      this.record(data, 'command', trimmed);
    });
  }

  probe(): StorageProbe {
    let port: StoragePort;
    try { port = this.storage(); port.getItem(this.key); }
    catch (error) { return { available: false, roundTrip: false, detail: message(error) }; }
    const key = `${this.key}:diagnostic:${crypto.randomUUID()}`;
    let probe: StorageProbe = { available: true, roundTrip: false, detail: '' };
    try {
      const value = crypto.randomUUID();
      port.setItem(key, value);
      if (port.getItem(key) !== value) throw new Error('Testskrivning kunne ikke læses tilbage.');
      probe = { available: true, roundTrip: true, detail: 'Skrivning og læsning verificeret på en separat testnøgle.' };
    } catch (error) { probe.detail = message(error); }
    finally {
      try { port.removeItem(key); }
      catch { probe = { available: true, roundTrip: false, detail: 'Testnøglen kunne ikke ryddes op. Brugerdata er ikke ændret.' }; }
    }
    return probe;
  }

  inspect(): Result<AppData> {
    try { return { ok: true, value: parseData(this.storage().getItem(this.key)) }; }
    catch (error) { return { ok: false, error: message(error) }; }
  }

  exportData(appVersion: string): Result<string> {
    try {
      const raw = this.storage().getItem(this.key);
      const metadata = { app: 'Logic Core', appVersion, exportedAt: new Date().toISOString(), storageKey: this.key };
      try {
        return { ok: true, value: JSON.stringify({ ...metadata, data: parseData(raw) }, null, 2) };
      } catch {
        // Preserve corrupt/newer data verbatim so they can be recovered later.
        return { ok: true, value: JSON.stringify({ ...metadata, recovery: true, rawData: raw }, null, 2) };
      }
    } catch (error) { return { ok: false, error: message(error) }; }
  }
}
