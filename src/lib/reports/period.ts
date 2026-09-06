/**
 * Period ranges in the business timezone (Africa/Algiers, fixed UTC+1, no DST).
 * Returns half-open ranges [from, to) as ISO strings with the +01:00 offset so
 * Postgres compares them correctly regardless of server/browser timezone.
 */

const TZ = '+01:00'; // Africa/Algiers, no daylight saving

export type PeriodPreset = 'today' | 'week' | 'month' | 'year';
export type Range = { from: string; to: string };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Business-local calendar date (y, m 1-12, d) of "now". */
function todayParts(): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** Midnight (business tz) of a calendar date, as an ISO instant. */
function midnight(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}T00:00:00${TZ}`;
}

/** Shift a calendar date by n days using UTC arithmetic (tz-agnostic). */
function addDays(y: number, m: number, d: number, n: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function getRange(preset: PeriodPreset): Range {
  const t = todayParts();
  switch (preset) {
    case 'today': {
      const next = addDays(t.y, t.m, t.d, 1);
      return { from: midnight(t.y, t.m, t.d), to: midnight(next.y, next.m, next.d) };
    }
    case 'week': {
      const dow = new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay(); // 0=Sun
      const backToMonday = (dow + 6) % 7;
      const start = addDays(t.y, t.m, t.d, -backToMonday);
      const end = addDays(start.y, start.m, start.d, 7);
      return { from: midnight(start.y, start.m, start.d), to: midnight(end.y, end.m, end.d) };
    }
    case 'month': {
      const nextMonthY = t.m === 12 ? t.y + 1 : t.y;
      const nextMonth = t.m === 12 ? 1 : t.m + 1;
      return { from: midnight(t.y, t.m, 1), to: midnight(nextMonthY, nextMonth, 1) };
    }
    case 'year': {
      return { from: midnight(t.y, 1, 1), to: midnight(t.y + 1, 1, 1) };
    }
  }
}

/** Custom range from two yyyy-mm-dd date strings (inclusive of the end day). */
export function getCustomRange(fromDate: string, toDate: string): Range {
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  const end = addDays(ty, tm, td, 1);
  return { from: midnight(fy, fm, fd), to: midnight(end.y, end.m, end.d) };
}
