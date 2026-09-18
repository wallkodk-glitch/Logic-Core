import { useEffect, useState } from 'react';

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}

export function useKeyboard(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const editable = document.activeElement?.matches('input, textarea, select') ?? false;
      setOpen(editable && !!viewport && window.innerHeight - viewport.height > 140);
    };
    viewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update); document.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', update); document.removeEventListener('focusout', update);
    };
  }, []);
  return open;
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true);
}
