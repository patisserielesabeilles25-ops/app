'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/permissions';
import { ensureAgentEmployeeId } from '@/lib/agents/resolve';

export type MagasinState = { error?: string };

/** Record a MAGASIN sale (multiple product lines) into the central ledger. */
export async function recordMagasinSale(
  _prev: MagasinState,
  formData: FormData,
): Promise<MagasinState> {
  await requirePermission('magasin.sale.create');

  const saleDate = String(formData.get('saleDate') || '');
  const agent = await ensureAgentEmployeeId(String(formData.get('agent') || ''));
  const names = formData.getAll('product_name').map(String);
  const qtys = formData.getAll('quantity').map((v) => Number(v));
  const prices = formData.getAll('unit_price').map((v) => Number(v));

  const lines = names
    .map((name, i) => ({
      product_name: name.trim(),
      quantity: qtys[i],
      unit_price: prices[i],
    }))
    .filter((l) => l.product_name && l.quantity > 0 && l.unit_price >= 0);

  if (lines.length === 0) return { error: 'Add at least one product with a quantity.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) return { error: 'Choose a valid date.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_magasin_sale', {
    p_sale_date: saleDate,
    p_lines: lines,
    p_agent: agent,
  });
  if (error) return { error: 'Could not record the sale.' };

  revalidatePath('/finance/magasin');
  revalidatePath('/finance');
  redirect(`/finance/magasin?date=${saleDate}&saved=1`);
}

/** Record a MAGASIN expense (with optional receipt) into the central ledger. */
export async function recordMagasinExpense(
  _prev: MagasinState,
  formData: FormData,
): Promise<MagasinState> {
  await requirePermission('magasin.expense.create');

  const date = String(formData.get('occurredAt') || '');
  const amount = Number(formData.get('amount'));
  const categoryId = String(formData.get('categoryId') || '') || null;
  const description = String(formData.get('description') || '');
  const agent = await ensureAgentEmployeeId(String(formData.get('agent') || ''));

  if (!(amount > 0)) return { error: 'Enter a valid amount.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Choose a valid date.' };

  // Optional receipt: already uploaded to Storage directly from the browser
  // (see financeAttachmentUploadUrl), so its bytes never pass through this
  // server action (whose body Next caps at 1 MB / Vercel at ~4.5 MB).
  const imagePath = ((formData.get('attachmentPath') as string) || '').trim() || null;
  const imageMime = ((formData.get('attachmentMime') as string) || '').trim() || null;
  const attachmentSizeRaw = formData.get('attachmentSize');
  const imageSize = attachmentSizeRaw ? Number(attachmentSizeRaw) : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_magasin_expense', {
    p_amount: amount,
    p_category_id: categoryId,
    p_description: description,
    p_occurred_at: `${date}T12:00:00+01:00`,
    p_image_path: imagePath,
    p_image_mime: imageMime,
    p_image_size: imageSize,
    p_agent: agent,
  });
  if (error) {
    if (imagePath) await createServiceClient().storage.from('finance-attachments').remove([imagePath]);
    return { error: 'Could not record the expense.' };
  }

  revalidatePath('/finance/magasin');
  revalidatePath('/finance');
  redirect(`/finance/magasin?date=${date}&saved=1`);
}
