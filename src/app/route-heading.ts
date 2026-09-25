export function focusRouteHeading(page: Pick<Document, 'querySelector' | 'title'>): void {
  // The independent startup h1 lives outside React and remains in the document.
  const heading = page.querySelector<HTMLElement>('#main-content h1');
  heading?.focus({ preventScroll: true });
  page.title = `${heading?.textContent?.trim() || 'Logic Core'} · Logic Core`;
}
