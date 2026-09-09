import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AttendanceStatus, FixedMethod } from '@/lib/attendance/config';
import { attCellKey } from '@/lib/attendance/config';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** First day of the month containing `dateStr` (or today), as yyyy-mm-01. */
export function monthStartOf(dateStr?: string): string {
  const base =
    dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(`${dateStr}T00:00:00`) : new Date();
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-01`;
}

export function monthEndOf(monthStart: string): string {
  const d = new Date(`${monthStart}T00:00:00`);
  return toYmd(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

export function shiftMonth(monthStart: string, delta: number): string {
  const d = new Date(`${monthStart}T00:00:00`);
  return `${new Date(d.getFullYear(), d.getMonth() + delta, 1).getFullYear()}-${pad(
    new Date(d.getFullYear(), d.getMonth() + delta, 1).getMonth() + 1,
  )}-01`;
}

export function daysInMonth(monthStart: string): number {
  const d = new Date(`${monthStart}T00:00:00`);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export type FixedWorker = { employeeId: string; name: string; method: FixedMethod };

/** Active fixed-rate workers (per-order workers are excluded — no attendance). */
export async function getFixedWorkers(): Promise<FixedWorker[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('employees')
    .select('id, full_name, payment_method')
    .in('payment_method', ['DAILY', 'WEEKLY', 'MONTHLY'])
    .eq('is_active', true)
    .order('full_name');
  return (data ?? []).map((e) => ({
    employeeId: e.id as string,
    name: (e.full_name as string) ?? '—',
    method: e.payment_method as FixedMethod,
  }));
}

/** Stored (non-present) statuses for a month, keyed `${employeeId}|${yyyy-mm-dd}`. */
export async function getAttendanceMonth(monthStart: string): Promise<Record<string, AttendanceStatus>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('attendance')
    .select('employee_id, work_date, status')
    .gte('work_date', monthStart)
    .lt('work_date', monthEndOf(monthStart));

  const map: Record<string, AttendanceStatus> = {};
  for (const r of data ?? []) {
    map[attCellKey(r.employee_id as string, r.work_date as string)] = r.status as AttendanceStatus;
  }
  return map;
}
