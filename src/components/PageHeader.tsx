import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="page-heading"><p className="eyebrow">{eyebrow}</p><div className="heading-row"><h1 tabIndex={-1}>{title}</h1>{children}</div></div>;
}
