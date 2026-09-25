import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { hasPendingWork, setPendingWork, subscribePendingWork } from './pending-work.ts';

export function useUnsavedWork(dirty: boolean): () => void {
  const owner = useRef({});
  useLayoutEffect(() => {
    const token = owner.current;
    setPendingWork(token, dirty);
    return () => setPendingWork(token, false);
  }, [dirty]);
  // Release only this form after a successful write, before synchronous navigation.
  return () => setPendingWork(owner.current, false);
}
export function usePendingWork(): boolean {
  return useSyncExternalStore(subscribePendingWork, hasPendingWork, () => false);
}
