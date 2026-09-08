'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';

export type SaveLogState = { ok?: boolean; error?: string };

/**
 * Replace the signed-in user's entries for one week with the submitted grid.
 * `payload` is JSON: { "SHEET|row_key|day": qty }. Only their own rows are
 * touched (RLS enforces it too).
 */
export async function saveProductionLog(
  _prev: SaveLogState,
  formData: FormData,
): Promise<SaveLogState> {
  const user = await requireUser();
  const weekStart = String(formData.get('weekStart') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { error: 'Invalid week.' };

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(String(formData.get('payload') ?? '{}'));
  } catch {
    return { error: 'Could not read the entries.' };
  }

  const rows: {
    profile_id: string;
    week_start: string;
    sheet: string;
    row_key: string;
    day: number;
    qty: number;
  }[] = [];

  for (const [key, raw] of Object.entries(payload)) {
    const qty = Math.floor(Number(raw) || 0);
    if (qty <= 0) continue;
    const [sheet, rowKey, dayStr] = key.split('|');
    const day = Number(dayStr);
    if (sheet !== 'MASQUAGE' && sheet !== 'PREPARATION') continue;
    if (!rowKey || !(day >= 0 && day <= 6)) continue;
    rows.push({ profile_id: user.id, week_start: weekStart, sheet, row_key: rowKey, day, qty: Math.min(qty, 100000) });
  }

  const supabase = await createClient();
  // Replace this user's week: clear then insert the non-zero cells.
  const { error: delErr } = await supabase
    .from('production_logs')
    .delete()
    .eq('profile_id', user.id)
    .eq('week_start', weekStart);
  if (delErr) return { error: 'Could not save your sheet.' };

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('production_logs').insert(rows);
    if (insErr) return { error: 'Could not save your sheet.' };
  }

  revalidatePath('/production-sheets');
  return { ok: true };
}
