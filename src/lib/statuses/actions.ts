'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions';
import { isCanonicalKey } from '@/lib/statuses/constants';

export type StatusState = { error?: string };

const NameSchema = z.string().trim().min(1, 'Name is required').max(60);

export async function createCustomStatus(
  _prev: StatusState,
  formData: FormData,
): Promise<StatusState> {
  await requirePermission('settings.manage');
  const user = await requireUser();

  const name = NameSchema.safeParse(formData.get('name'));
  const canonical = String(formData.get('canonical') ?? '');
  if (!name.success) return { error: name.error.issues[0]?.message ?? 'Invalid name.' };
  if (!isCanonicalKey(canonical)) return { error: 'Choose a status to link to.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('custom_statuses')
    .insert({ name: name.data, canonical, created_by: user.id });
  if (error) return { error: 'Could not add the status.' };

  revalidatePath('/statuses');
  redirect('/statuses?msg=Custom+status+added.');
}

export async function updateCustomStatus(
  _prev: StatusState,
  formData: FormData,
): Promise<StatusState> {
  await requirePermission('settings.manage');
  const id = String(formData.get('statusId') ?? '');
  const name = NameSchema.safeParse(formData.get('name'));
  const canonical = String(formData.get('canonical') ?? '');
  if (!id) return { error: 'Missing status.' };
  if (!name.success) return { error: name.error.issues[0]?.message ?? 'Invalid name.' };
  if (!isCanonicalKey(canonical)) return { error: 'Choose a status to link to.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('custom_statuses')
    .update({ name: name.data, canonical })
    .eq('id', id);
  if (error) return { error: 'Could not update the status.' };

  revalidatePath('/statuses');
  redirect('/statuses?msg=Custom+status+updated.');
}

export async function deleteCustomStatus(formData: FormData): Promise<void> {
  await requirePermission('settings.manage');
  const id = String(formData.get('statusId') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.from('custom_statuses').delete().eq('id', id);
  if (error) {
    redirect(`/statuses?error=${encodeURIComponent('Could not delete the status.')}`);
  }
  revalidatePath('/statuses');
  redirect('/statuses?msg=Custom+status+deleted.');
}
