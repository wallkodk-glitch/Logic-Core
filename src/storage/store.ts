import type { Activity, AppData, Project, ProjectInput, Result } from '../domain/types.ts';
import { PROJECT_STATUSES } from '../domain/types.ts';
import { ACTIVITY_LIMIT, emptyData, parseData, validateData } from './schema.ts';
import { parseBackup, serializeBackup } from './backup.ts';
import type { PreparedRestore } from './backup.ts';
import { parseRecovery, resolveRecovery, settleRecovery, writeRaw } from './recovery.ts';
import type { RecoveryRecord, RecoveryStatus } from './recovery.ts';

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
  readonly recoveryKey: string;

  constructor(storage: () => StoragePort, key: string) {
    this.storage = storage;
    this.key = key;
    this.recoveryKey = `${key}:recovery`;
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
      settleRecovery(this.storage(), this.key, this.recoveryKey);
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
      settleRecovery(port, this.key, this.recoveryKey);
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
      return { ok: true, value: serializeBackup(this.storage().getItem(this.key), appVersion, this.key) };
    } catch (error) { return { ok: false, error: message(error) }; }
  }

  prepareImport(source: string): Result<PreparedRestore> {
    try {
      const { preview } = parseBackup(source); // Validate before even reading recovery.
      const port = this.storage();
      return { ok: true, value: { source, preview, primaryAtPreview: port.getItem(this.key), recoveryAtPreview: port.getItem(this.recoveryKey) } };
    } catch (error) { return { ok: false, error: message(error) }; }
  }

  recoveryStatus(): RecoveryStatus {
    let token: string | null = null;
    try {
      const port = this.storage();
      token = port.getItem(this.recoveryKey);
      const record = parseRecovery(token);
      return { exists: record.snapshot !== null || !!record.pending, token, snapshot: resolveRecovery(record, port.getItem(this.key)), pending: !!record.pending, error: null };
    } catch (error) { return { exists: token !== null, token, snapshot: null, pending: false, error: message(error) }; }
  }

  prepareRecovery(): Result<PreparedRestore> {
    try {
      const status = this.recoveryStatus();
      if (status.error) throw new Error(status.error);
      if (!status.snapshot) throw new Error('Der findes endnu ikke et recovery-snapshot.');
      // Invalid old primary bytes may be exported, but never restored as data.
      parseData(status.snapshot.rawPrimary);
      return this.prepareImport(serializeBackup(status.snapshot.rawPrimary, status.snapshot.appVersion, this.key));
    } catch (error) { return { ok: false, error: message(error) }; }
  }

  restoreBackup(prepared: PreparedRestore, appVersion: string): Result<{ warning: string | null }> {
    let next: AppData;
    let after: string;
    let port: StoragePort;
    let recoveryBefore: string | null;
    try {
      // Revalidate the source at the write boundary; preview objects are not trusted.
      next = parseBackup(prepared.source).data;
      after = JSON.stringify(next);
      port = this.storage();
      if (port.getItem(this.key) !== prepared.primaryAtPreview || port.getItem(this.recoveryKey) !== prepared.recoveryAtPreview) {
        throw new Error('Data eller recovery er ændret siden forhåndsvisningen. Vælg backup igen.');
      }
      if (prepared.primaryAtPreview === after) throw new Error('Backup matcher allerede dine data. Intet er ændret.');
      recoveryBefore = port.getItem(this.recoveryKey);
      const record = parseRecovery(recoveryBefore);
      if (record.pending) throw new Error('Afslut den tidligere recovery-handling ved at genåbne appen før en ny gendannelse.');
      const journal: RecoveryRecord = {
        recoveryVersion: 1, snapshot: record.snapshot,
        pending: { before: prepared.primaryAtPreview, after, candidate: { rawPrimary: prepared.primaryAtPreview, savedAt: new Date().toISOString(), appVersion } },
      };
      // Two localStorage keys cannot form one transaction. Keep the old snapshot
      // inside a journal until the atomic primary write decides which snapshot wins.
      const journalRaw = JSON.stringify(journal);
      parseRecovery(journalRaw);
      port.setItem(this.recoveryKey, journalRaw);
      try {
        if (port.getItem(this.recoveryKey) !== journalRaw || port.getItem(this.key) !== prepared.primaryAtPreview) throw new Error('Data ændrede sig under gendannelsen. Ingen primary-write blev udført.');
        port.setItem(this.key, after); // Commit point: the entire validated document.
      } catch (error) {
        try { writeRaw(port, this.recoveryKey, recoveryBefore); }
        catch {
          this.loadBlocked = true;
          throw new Error(`${message(error)} Den tidligere recovery er bevaret i journalen; genåbn appen for at afslutte oprydning.`);
        }
        throw error;
      }
    } catch (error) {
      const detail = message(error);
      this.publish(this.snapshot.data, detail);
      return { ok: false, error: detail };
    }
    // Beyond this point the restore succeeded. A cleanup failure must not be
    // reported as a failed import: preserve the journal and block later writes.
    let warning: string | null = null;
    try { settleRecovery(port, this.key, this.recoveryKey); }
    catch { warning = 'Data er gendannet, og recovery er bevaret i journalen. Genåbn appen for at afslutte oprydning før flere ændringer.'; }
    this.raw = after;
    this.loadBlocked = warning !== null;
    this.publish(next, warning);
    return { ok: true, value: { warning } };
  }

  exportRecovery(appVersion: string): Result<string> {
    try {
      const status = this.recoveryStatus();
      if (!status.exists) throw new Error('Der findes ikke et recovery-snapshot.');
      if (status.error || status.pending) {
        return { ok: true, value: JSON.stringify({ app: 'Logic Core', appVersion, exportedAt: new Date().toISOString(), recoveryJournal: status.token }, null, 2) };
      }
      if (!status.snapshot) throw new Error('Recovery-snapshot er tomt.');
      return { ok: true, value: serializeBackup(status.snapshot.rawPrimary, status.snapshot.appVersion, this.key) };
    } catch (error) { return { ok: false, error: message(error) }; }
  }

  deleteRecovery(expectedToken: string): Result<void> {
    try {
      const port = this.storage();
      if (port.getItem(this.recoveryKey) !== expectedToken) throw new Error('Recovery er ændret. Kontrollér det igen før sletning.');
      port.removeItem(this.recoveryKey);
      this.refresh();
      return { ok: true, value: undefined };
    } catch (error) { return { ok: false, error: message(error) }; }
  }
}
