// Ephemeral UI guard only. It never reads or writes persisted user data.
const pending = new Set<object>();
const listeners = new Set<() => void>();
export function setPendingWork(owner: object, dirty: boolean): void {
  const before = pending.has(owner);
  if (dirty) pending.add(owner); else pending.delete(owner);
  if (before !== dirty) listeners.forEach(listener => listener());
}
export const hasPendingWork = (): boolean => pending.size > 0;
export function subscribePendingWork(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
