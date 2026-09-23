import { useEffect, useRef, useSyncExternalStore } from 'react';
import { hasPendingWork, setPendingWork, subscribePendingWork } from './pending-work.ts';

export function useUnsavedWork(dirty: boolean): void {
  const owner = useRef({});
  useEffect(() => {
    const token = owner.current;
    setPendingWork(token, dirty);
    return () => setPendingWork(token, false);
  }, [dirty]);
}
export function usePendingWork(): boolean {
  return useSyncExternalStore(subscribePendingWork, hasPendingWork, () => false);
}
