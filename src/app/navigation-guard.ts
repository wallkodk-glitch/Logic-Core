export interface NavigationEnvironment {
  read(): string;
  write(hash: string): void;
  replace(hash: string): void;
  dirty(): boolean;
  confirm(): boolean;
  publish(hash: string): void;
}
const normalized = (hash: string) => hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '#/';

// Own the accepted route, not the browser's tentative URL. A cancelled back/hash
// replaces that entry without another hashchange, preserving the mounted editor.
// This deliberately avoids history.go loops and async duplicate prompts.
export function createNavigationGuard(env: NavigationEnvironment) {
  let accepted = normalized(env.read());
  function allowed(next: string) { return next === accepted || !env.dirty() || env.confirm(); }
  function accept(next: string) { if (next !== accepted) { accepted = next; env.publish(next); } }
  return {
    snapshot: () => accepted,
    go(hash: string): boolean {
      const next = normalized(hash);
      if (!allowed(next)) return false;
      env.write(next); accept(next); return true;
    },
    changed(): void {
      const next = normalized(env.read());
      if (!allowed(next)) { env.replace(accepted); return; }
      accept(next);
    },
  };
}
