const formatter = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export function formatTime(value: string): string { return formatter.format(new Date(value)); }
export function errorText(error: unknown): string { return error instanceof Error ? error.message : 'Der opstod en fejl. Prøv igen.'; }
