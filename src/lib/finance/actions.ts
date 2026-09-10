'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
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

/**
 * Mint a signed URL so the browser can upload a receipt DIRECTLY to Storage,
 * bypassing the ~4.5 MB server-action body cap Vercel enforces (phone photos
 * routinely exceed it). The caller then submits the returned path with the form.
 */
export async function financeAttachmentUploadUrl(
  mime: string,
  size: number,
  name: string,
): Promise<{ path: string; token: string } | { error: string }> {
  const perms = await getMyPermissions();
  if (!perms.has('finance.income.create') && !perms.has('finance.expense.create')) {
    return { error: 'You are not allowed to upload receipts.' };
  }
  if (!ACCEPTED_FINANCE_TYPES.includes(mime)) {
    return { error: 'Attachment must be JPEG, PNG, WEBP, or PDF.' };
  }
  if (!(size > 0)) return { error: 'The selected file is empty.' };
  if (size > MAX_FINANCE_BYTES) return { error: 'Attachment must be 50 MB or smaller.' };

  const service = createServiceClient();
  const path = `${crypto.randomUUID()}/${safeName(name || 'receipt')}`;
  const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: 'Could not prepare the upload. Please try again.' };
  return { path: data.path, token: data.token };
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

  // Receipt: already uploaded to Storage directly from the browser (see
  // financeAttachmentUploadUrl). We only receive its path/metadata here.
  const attachmentPath = ((formData.get('attachmentPath') as string) || '').trim() || null;
  const attachmentMime = ((formData.get('attachmentMime') as string) || '').trim() || null;
  const attachmentSizeRaw = formData.get('attachmentSize');
  const attachmentSize = attachmentSizeRaw ? Number(attachmentSizeRaw) : null;

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
    p_image_path: attachmentPath,
    p_image_mime: attachmentMime,
    p_image_size: attachmentSize,
  });
  if (error) {
    if (attachmentPath) await createServiceClient().storage.from(BUCKET).remove([attachmentPath]);
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
