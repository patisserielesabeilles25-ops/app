'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions';
import { monthEndOf } from '@/lib/attendance/queries';

export type SaveAttendanceState = { ok?: boolean; error?: string };

/**
 * Replace a month's attendance exceptions with the submitted grid. `payload` is
 * JSON: { "employeeId|yyyy-mm-dd": "ABSENT" | "HALF" | "LEAVE" }. Present days
 * carry no row.
 */
export async function saveAttendance(
  _prev: SaveAttendanceState,
  formData: FormData,
): Promise<SaveAttendanceState> {
  await requirePermission('payroll.manage');
  const actor = await requireUser();

  const monthStart = String(formData.get('monthStart') ?? '');
  if (!/^\d{4}-\d{2}-01$/.test(monthStart)) return { error: 'Invalid month.' };
  const monthEnd = monthEndOf(monthStart);

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(String(formData.get('payload') ?? '{}'));
  } catch {
    return { error: 'Could not read the entries.' };
  }

  const rows: { employee_id: string; work_date: string; status: string; created_by: string }[] = [];
  for (const [key, raw] of Object.entries(payload)) {
    const status = String(raw);
    if (status !== 'ABSENT' && status !== 'HALF' && status !== 'LEAVE') continue;
    const [employeeId, workDate] = key.split('|');
    if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) continue;
    if (workDate < monthStart || workDate >= monthEnd) continue;
    rows.push({ employee_id: employeeId, work_date: workDate, status, created_by: actor.id });
  }

  const supabase = await createClient();
  const { error: delErr } = await supabase
    .from('attendance')
    .delete()
    .gte('work_date', monthStart)
    .lt('work_date', monthEnd);
  if (delErr) return { error: 'Could not save attendance.' };

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('attendance').insert(rows);
    if (insErr) return { error: 'Could not save attendance.' };
  }

  revalidatePath('/attendance');
  revalidatePath('/users');
  return { ok: true };
}
