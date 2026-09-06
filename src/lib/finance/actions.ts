'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/permissions';
import { requireUser } from '@/lib/auth/session';
import { writeAudit } from '@/lib/audit/log';
import { ACCEPTED_FINANCE_TYPES, MAX_FINANCE_BYTES } from '@/lib/validation/finance';
import { inferSource } from '@/lib/finance/classify';

export type FinanceFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export type TxEditState = { error?: string; success?: boolean };

/** Edit a transaction's amount / description / date. Needs finance.reverse or settings.manage. */
export async function updateTransaction(
  _prev: TxEditState,
  formData: FormData,
): Promise<TxEditState> {
  await requirePermission('finance.reverse');
  const actor = await requireUser();
  const id = String(formData.get('id') ?? '');
  const amount = Number(formData.get('amount'));
  const description = String(formData.get('description') ?? '').trim();
  const date = String(formData.get('occurredAt') ?? '');
  if (!id) return { error: 'Transaction introuvable.' };
  if (!(amount > 0)) return { error: 'Montant invalide.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Date invalide.' };

  const service = createServiceClient();
  const { error } = await service
    .from('financial_transactions')
    .update({ amount, description: description || null, occurred_at: `${date}T12:00:00+01:00` })
    .eq('id', id);
  if (error) return { error: 'Impossible de modifier la transaction.' };

  await writeAudit({ actorId: actor.id, action: 'finance.tx.edit', entityType: 'financial_transaction', entityId: id, metadata: { amount } });
  revalidatePath('/finance');
  revalidatePath('/finance/transactions');
  return { success: true };
}

/** Delete a transaction (admin only). Also removes its attachments. */
export async function deleteTransaction(formData: FormData): Promise<void> {
  await requirePermission('settings.manage'); // admin-only
  const actor = await requireUser();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const service = createServiceClient();
  const { data: atts } = await service
    .from('financial_attachments')
    .select('bucket, object_path')
    .eq('transaction_id', id);
  await service.from('financial_transactions').delete().eq('id', id);
  for (const a of atts ?? []) {
    await service.storage.from((a.bucket as string) || 'finance-attachments').remove([a.object_path as string]);
  }
  await writeAudit({ actorId: actor.id, action: 'finance.tx.delete', entityType: 'financial_transaction', entityId: id });

  revalidatePath('/finance');
  revalidatePath('/finance/transactions');
}

const BUCKET = 'finance-attachments';

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

type UploadResult =
  | { ok: true; path: string | null; mime: string | null; size: number | null }
  | { ok: false; error: string };

async function uploadReceipt(file: FormDataEntryValue | null): Promise<UploadResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: true, path: null, mime: null, size: null };
  }
  if (!ACCEPTED_FINANCE_TYPES.includes(file.type)) {
    return { ok: false, error: 'Attachment must be JPEG, PNG, WEBP, or PDF.' };
  }
  if (file.size > MAX_FINANCE_BYTES) {
    return { ok: false, error: 'Attachment must be 5 MB or smaller.' };
  }
  const service = createServiceClient();
  const path = `${crypto.randomUUID()}/${safeName(file.name || 'receipt')}`;
  const { error } = await service.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: `Upload failed: ${error.message}` };
  return { ok: true, path, mime: file.type, size: file.size };
}

async function post(
  type: 'INCOME' | 'EXPENSE',
  formData: FormData,
): Promise<FinanceFormState> {
  const amount = Number(formData.get('amount'));
  const categoryId = String(formData.get('categoryId') || '') || null;
  const department = String(formData.get('department') || 'GENERAL');
  const description = String(formData.get('description') || '');
  const itemName = String(formData.get('itemName') || '');
  const date = String(formData.get('occurredAt') || '');

  const fieldErrors: Record<string, string> = {};
  if (!(amount > 0)) fieldErrors.amount = 'Enter a positive amount';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fieldErrors.occurredAt = 'Choose a date';
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }

  const up = await uploadReceipt(formData.get('attachment'));
  if (!up.ok) return { error: up.error };

  const supabase = await createClient();
  let catKey: string | null = null;
  if (categoryId) {
    const { data: cat } = await supabase
      .from('financial_categories')
      .select('key')
      .eq('id', categoryId)
      .maybeSingle();
    catKey = cat?.key ?? null;
  }
  const fullDescription = itemName ? `${itemName}${description ? ` — ${description}` : ''}` : description;

  const { error } = await supabase.rpc('post_transaction', {
    p_type: type,
    p_amount: amount,
    p_category_id: categoryId,
    p_department: department,
    p_source: inferSource(catKey),
    p_occurred_at: `${date}T12:00:00+01:00`,
    p_description: fullDescription,
    p_order_id: null,
    p_notes: null,
    p_image_path: up.path,
    p_image_mime: up.mime,
    p_image_size: up.size,
  });
  if (error) {
    if (up.path) await createServiceClient().storage.from(BUCKET).remove([up.path]);
    return { error: `Could not record the ${type.toLowerCase()}.` };
  }

  revalidatePath('/finance');
  revalidatePath('/finance/transactions');
  redirect(`/finance?msg=${type === 'INCOME' ? 'Income' : 'Expense'}+recorded.`);
}

export async function recordIncome(
  _prev: FinanceFormState,
  formData: FormData,
): Promise<FinanceFormState> {
  await requirePermission('finance.income.create');
  return post('INCOME', formData);
}

export async function recordExpense(
  _prev: FinanceFormState,
  formData: FormData,
): Promise<FinanceFormState> {
  await requirePermission('finance.expense.create');
  return post('EXPENSE', formData);
}

export async function reverseTransaction(formData: FormData): Promise<void> {
  await requirePermission('finance.reverse');
  const id = String(formData.get('transactionId') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.rpc('reverse_transaction', { p_txn_id: id });
  if (error) {
    redirect(`/finance/transactions/${id}?error=${encodeURIComponent(/already|cannot/.test(error.message) ? error.message : 'Could not reverse the transaction.')}`);
  }
  revalidatePath('/finance');
  revalidatePath('/finance/transactions');
  redirect(`/finance/transactions/${id}?msg=Transaction+reversed.`);
}
