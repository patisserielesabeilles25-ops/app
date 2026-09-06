'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions';
import { writeAudit } from '@/lib/audit/log';

export type ConfigState = { error?: string };

const keyRe = /^[A-Z0-9_]+$/;

const DepartmentSchema = z.object({
  key: z.string().trim().toUpperCase().regex(keyRe, 'Uppercase letters, digits, underscores').max(40),
  name: z.string().trim().min(1, 'Name is required').max(80),
});

const CategorySchema = z.object({
  key: z.string().trim().toUpperCase().regex(keyRe, 'Uppercase letters, digits, underscores').max(40),
  name: z.string().trim().min(1, 'Name is required').max(80),
  direction: z.enum(['INCOME', 'EXPENSE', 'BOTH']),
});

export async function createDepartment(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  await requirePermission('finance.categories.manage');
  const actor = await requireUser();
  const parsed = DepartmentSchema.safeParse({
    key: formData.get('key'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const supabase = await createClient();
  const { error } = await supabase.from('departments').insert(parsed.data);
  if (error) return { error: /duplicate|unique/i.test(error.message) ? 'A department with this key already exists.' : 'Could not create department.' };

  await writeAudit({ actorId: actor.id, action: 'finance.department.create', entityType: 'department', metadata: { key: parsed.data.key } });
  revalidatePath('/finance/categories');
  redirect('/finance/categories?msg=Department+created.');
}

export async function updateCategory(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  await requirePermission('finance.categories.manage');
  const actor = await requireUser();
  const id = String(formData.get('categoryId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Name is required.' };

  const supabase = await createClient();
  const { error } = await supabase.from('financial_categories').update({ name }).eq('id', id);
  if (error) return { error: 'Could not update the category.' };

  await writeAudit({ actorId: actor.id, action: 'finance.category.update', entityType: 'financial_category', entityId: id, metadata: { name } });
  revalidatePath('/finance/categories');
  redirect('/finance/categories?msg=Category+updated.');
}

export async function deleteCategory(formData: FormData): Promise<void> {
  await requirePermission('finance.categories.manage');
  const actor = await requireUser();
  const id = String(formData.get('categoryId') ?? '');

  const supabase = await createClient();
  const { data: cat } = await supabase
    .from('financial_categories')
    .select('is_system, key')
    .eq('id', id)
    .maybeSingle();
  const { error } = await supabase.from('financial_categories').delete().eq('id', id);
  if (error) {
    redirect('/finance/categories?error=' + encodeURIComponent('This category is in use and cannot be deleted.'));
  }
  await writeAudit({ actorId: actor.id, action: 'finance.category.delete', entityType: 'financial_category', entityId: id, metadata: { key: cat?.key } });
  revalidatePath('/finance/categories');
  redirect('/finance/categories?msg=Category+deleted.');
}

export async function createCategory(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  await requirePermission('finance.categories.manage');
  const actor = await requireUser();
  const parsed = CategorySchema.safeParse({
    key: formData.get('key'),
    name: formData.get('name'),
    direction: formData.get('direction'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  const supabase = await createClient();
  const { error } = await supabase.from('financial_categories').insert(parsed.data);
  if (error) return { error: /duplicate|unique/i.test(error.message) ? 'A category with this key already exists.' : 'Could not create category.' };

  await writeAudit({ actorId: actor.id, action: 'finance.category.create', entityType: 'financial_category', metadata: { key: parsed.data.key, direction: parsed.data.direction } });
  revalidatePath('/finance/categories');
  redirect('/finance/categories?msg=Category+created.');
}
