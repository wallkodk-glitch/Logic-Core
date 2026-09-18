const paths = {
  command: 'M4 6l6 6-6 6m9 0h7',
  projects: 'M3 7V5h7l2 2h9v13H3V7Zm0 4h18',
  opportunity: 'm13 2-8 12h6l-1 8 9-13h-6l0-7Z',
  more: 'M5 11h2v2H5zM11 11h2v2h-2zM17 11h2v2h-2z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  back: 'm14 5-7 7 7 7',
  decisions: 'M6 3v11m0-7h8a4 4 0 0 1 4 4v3M3 18a3 3 0 1 0 6 0 3 3 0 0 0-6 0m12 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
  knowledge: 'M4 4h7v16H4zm9 0h7v16h-7zM7 8h1m8 0h1',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  diagnostic: 'M3 12h4l3-8 4 16 3-8h4',
  export: 'M12 15V3m-4 4 4-4 4 4M4 14v7h16v-7',
  check: 'm5 12 4 4L19 6',
  trash: 'M4 7h16M9 3h6l1 4H8l1-4Zm-3 4 1 14h10l1-14M10 11v6m4-6v6',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
