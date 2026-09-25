import type { AppData } from './types.ts';
import { isReviewDue } from './decisions.ts';
import { opportunityReviewDue } from './opportunities.ts';
import { entityHref } from './workspace.ts';

export interface AttentionItem { key: string; title: string; href: string; at: string; reason: 'decision-review' | 'opportunity-review' | 'opportunity-inbox' }
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
// Due reviews first (oldest deadline); then inbox (oldest creation). Stable ID tie-break.
// A due inbox opportunity appears once. This list is never persisted.
export function attentionItems(data: AppData, now = Date.now()): AttentionItem[] {
  const items: AttentionItem[] = data.decisions.filter(d => isReviewDue(d, now)).map(d => ({ key: `decision:${d.id}`, title: d.title,
    href: entityHref('decision', d.id), at: d.reviewAt!, reason: 'decision-review' }));
  for (const o of data.opportunities) {
    const due = opportunityReviewDue(o, now);
    if (due || o.status === 'inbox') items.push({ key: `opportunity:${o.id}`, title: o.title, href: entityHref('opportunity', o.id),
      at: due ? o.reviewAt! : o.createdAt, reason: due ? 'opportunity-review' : 'opportunity-inbox' });
  }
  return items.sort((a, b) => Number(a.reason === 'opportunity-inbox') - Number(b.reason === 'opportunity-inbox') || compare(a.at, b.at) || compare(a.key, b.key)).slice(0, 3);
}
