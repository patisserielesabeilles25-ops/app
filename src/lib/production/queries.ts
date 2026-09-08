import 'server-only';

import { createClient } from '@/lib/supabase/server';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The Saturday (week start) for a given date, or for today when omitted. */
export function weekStartOf(dateStr?: string): string {
  const base =
    dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? new Date(`${dateStr}T00:00:00`)
      : new Date();
  base.setHours(0, 0, 0, 0);
  const offset = (base.getDay() + 1) % 7; // days since the most recent Saturday
  base.setDate(base.getDate() - offset);
  return toYmd(base);
}

/** Shift a yyyy-mm-dd date by n days. */
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

/**
 * The signed-in user's own entries for a week, as a flat map keyed
 * `${sheet}|${row_key}|${day}` → qty. Scoped to the current user even when the
 * caller can also read others' rows (payroll supervisors).
 */
export async function getMyProductionLog(weekStart: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return {};
  return getProductionLogFor(auth.user.id, weekStart);
}

/**
 * One worker's entries for a week, as `${sheet}|${row_key}|${day}` → qty.
 * RLS lets a user read their own rows, and masters read anyone's.
 */
export async function getProductionLogFor(
  profileId: string,
  weekStart: string,
): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('production_logs')
    .select('sheet, row_key, day, qty')
    .eq('profile_id', profileId)
    .eq('week_start', weekStart);

  const map: Record<string, number> = {};
  for (const r of data ?? []) {
    map[`${r.sheet}|${r.row_key}|${r.day}`] = Number(r.qty);
  }
  return map;
}
