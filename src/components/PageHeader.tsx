import type { ReactNode } from 'react';

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="page-heading"><div className="heading-row"><h1 tabIndex={-1}>{title}</h1>{children}</div></div>;
}
