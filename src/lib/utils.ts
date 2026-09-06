/** Tiny classnames helper — joins truthy class strings. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Format a number as a currency amount (no symbol; locale-grouped). */
export function formatAmount(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format an ISO date (yyyy-mm-dd) for display. */
export function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Format a HH:mm[:ss] time string to HH:mm. */
export function formatTime(time: string): string {
  return time?.slice(0, 5) ?? time;
}

/** Normalize an Algerian phone number to international digits for wa.me links. */
export function waNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('213')) return digits;
  if (digits.startsWith('0')) return `213${digits.slice(1)}`;
  return digits;
}

/** Format an ISO timestamp as "01 Sept 2026, 20:14". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
