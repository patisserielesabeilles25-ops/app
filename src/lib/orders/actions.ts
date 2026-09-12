'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { ensureAgentEmployeeId } from '@/lib/agents/resolve';
import { orderCanonicalStatus } from '@/lib/statuses/derive';
import { parseSizeNumber } from '@/lib/size';
import {
  CreateOrderSchema,
  OperationalOrderSchema,
  FinancialOrderSchema,
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from '@/lib/validation/order';

export type CreateOrderState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const BUCKET = 'order-images';

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

/**
 * Mint a short-lived signed URL so the browser can upload a reference image
 * DIRECTLY to Storage, instead of streaming it through this server action.
 * Server actions run as serverless functions whose request body Vercel caps at
 * ~4.5 MB, so routing large photos through them fails in production; a direct
 * upload lets us accept files up to MAX_IMAGE_BYTES (50 MB). The caller then
 * passes the returned `path` to createOrder.
 */
export async function createOrderImageUploadUrl(
  mime: string,
  size: number,
  name: string,
): Promise<{ path: string; token: string } | { error: string }> {
  // Used by both the create and edit forms.
  const perms = await getMyPermissions();
  if (!perms.has('orders.create') && !perms.has('orders.edit')) {
    return { error: 'You are not allowed to upload order images.' };
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(mime)) {
    return { error: 'Image must be JPEG, PNG, or WEBP.' };
  }
  if (!(size > 0)) return { error: 'The selected file is empty.' };
  if (size > MAX_IMAGE_BYTES) return { error: 'Image must be 50 MB or smaller.' };

  const service = createServiceClient();
  const path = `${crypto.randomUUID()}/${safeName(name || 'image')}`;
  const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return { error: 'Could not prepare the upload. Please try again.' };
  }
  return { path: data.path, token: data.token };
}

export async function createOrder(
  _prev: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  await requirePermission('orders.create');

  const parsed = CreateOrderSchema.safeParse({
    customerName: formData.get('customerName'),
    customerPhone: formData.get('customerPhone'),
    cakeSizeCm: formData.get('cakeSizeCm'),
    description: formData.get('description') ?? '',
    fourage: formData.get('fourage') ?? '',
    coating: formData.get('coating') ?? '',
    deliveryDate: formData.get('deliveryDate'),
    deliveryTime: formData.get('deliveryTime'),
    deliveryRequired: formData.get('deliveryRequired') === 'on',
    deliveryAddress: formData.get('deliveryAddress') ?? '',
    deliveryAmount: formData.get('deliveryAmount') || 0,
    totalAmount: formData.get('totalAmount'),
    montageAmount: formData.get('montageAmount') || 0,
    advancePayment: formData.get('advancePayment') || 0,
    receivedBy: formData.get('receivedBy') ?? '',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }
  const input = parsed.data;

  // Reference image: already uploaded to Storage directly from the browser via
  // a signed upload URL (see createOrderImageUploadUrl). We only receive its
  // path + metadata here, keeping large files off this server action's request
  // body (which Vercel caps at ~4.5 MB).
  const imagePath = ((formData.get('imagePath') as string) || '').trim() || null;
  const imageMime = ((formData.get('imageMime') as string) || '').trim() || null;
  const imageSizeRaw = formData.get('imageSize');
  const imageSize = imageSizeRaw ? Number(imageSizeRaw) : null;
  const hasImage = !!imagePath;

  // The chosen agent is an app user; resolve (create on first use) the backing
  // employee so the advance is attributed in Magasin "Today's sales".
  const receivedByEmployee = await ensureAgentEmployeeId(input.receivedBy);

  // Atomic create via SECURITY DEFINER function (as the signed-in user).
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_order', {
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_cake_size_cm: parseSizeNumber(input.cakeSizeCm) ?? 1,
    p_description: input.description,
    p_delivery_date: input.deliveryDate,
    p_delivery_time: input.deliveryTime,
    p_delivery_required: input.deliveryRequired,
    p_fulfillment: input.deliveryRequired ? 'DELIVERY' : 'PICKUP',
    p_total_amount: input.totalAmount,
    p_advance_payment: input.advancePayment,
    p_delivery_amount: input.deliveryRequired ? input.deliveryAmount : 0,
    p_montage_amount: input.montageAmount,
    p_received_by: receivedByEmployee,
    p_image_bucket: imagePath ? BUCKET : null,
    p_image_path: imagePath,
    p_image_mime: hasImage ? imageMime : null,
    p_image_size: hasImage ? imageSize : null,
  });

  if (error) {
    // Roll back the orphaned upload so storage stays consistent.
    if (imagePath) {
      await createServiceClient().storage.from(BUCKET).remove([imagePath]);
    }
    return { error: 'Could not create the order. Please try again.' };
  }

  const created = Array.isArray(data) ? data[0] : undefined;

  // Link the chosen catalog product + store the fourage note (service client:
  // the caller passed orders.create, but the update policy needs orders.edit).
  const productId = String(formData.get('productId') ?? '');
  const patch: { product_id?: string; fourage?: string | null; coating?: string; size_label?: string; delivery_address?: string | null } = {};
  if (productId) patch.product_id = productId;
  if (input.fourage) patch.fourage = input.fourage;
  patch.coating = input.coating;
  patch.size_label = input.cakeSizeCm;
  patch.delivery_address = input.deliveryRequired ? (input.deliveryAddress || null) : null;
  if (created?.id && Object.keys(patch).length > 0) {
    await createServiceClient().from('orders').update(patch).eq('id', created.id);
  }

  redirect(created?.id ? `/orders/${created.id}?created=1` : '/orders');
}

function revalidateOrderViews(id: string) {
  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
}

/**
 * Business rule: once an order is fully paid AND production is READY, it should
 * no longer sit in the READY column — it moves straight to DELIVERED (for pickup
 * and delivery orders alike). Uses the service client to set the terminal
 * delivery status directly (the strict delivery state machine only allows
 * READY→OUT_FOR_DELIVERY→DELIVERED and only for delivery orders). No-op unless
 * the order is READY, not returned, not already delivered, and remaining ≤ 0.
 */
async function autoDeliverIfFullyPaid(orderId: string): Promise<void> {
  if (!orderId) return;
  const service = createServiceClient();
  const { data: o } = await service
    .from('orders')
    .select('production_status, delivery_status, fulfillment, returned_at, reported_at, production_stage, delivery_date')
    .eq('id', orderId)
    .maybeSingle();
  if (!o || o.returned_at || o.delivery_status === 'DELIVERED') return;
  // Only when the order currently sits in the READY column (canonical status),
  // which can come from production or delivery state — not just production_status.
  if (orderCanonicalStatus(o) !== 'READY') return;
  const { data: fin } = await service
    .from('order_financials')
    .select('remaining_amount')
    .eq('order_id', orderId)
    .maybeSingle();
  if (!fin || Number(fin.remaining_amount) > 0.005) return;

  await service
    .from('orders')
    .update({ delivery_status: 'DELIVERED', delivered_at: new Date().toISOString() })
    .eq('id', orderId);
  await service.from('order_status_history').insert({
    order_id: orderId,
    field: 'delivery_status',
    from_value: o.delivery_status ?? null,
    to_value: 'DELIVERED',
    changed_by: null,
  });
  revalidatePath('/clients');
  revalidatePath('/calendar');
}

/** Shop action: send an order to the laboratory (NEW -> IN_PRODUCTION). */
export async function sendToLab(formData: FormData): Promise<void> {
  await requirePermission('orders.edit');
  const id = String(formData.get('orderId') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_order_production_status', {
    p_order_id: id,
    p_to: 'IN_PRODUCTION',
  });
  if (error) {
    redirect(`/orders/${id}?error=${encodeURIComponent('Could not send to laboratory.')}`);
  }
  revalidateOrderViews(id);
  redirect(`/orders/${id}?sent=1`);
}

/**
 * Start production on an order. Preparation is auto-passed (no agent, no
 * piece-work) and the order moves straight to EN_MASKAGE.
 */
export async function startProduction(formData: FormData): Promise<void> {
  await requirePermission('orders.edit');
  const id = String(formData.get('orderId') ?? '');
  const fromList = String(formData.get('from') ?? '') === 'list';
  const supabase = await createClient();
  const { error } = await supabase.rpc('start_production_auto', { p_order_id: id });
  if (error) {
    redirect(`/orders/${id}?error=${encodeURIComponent('Could not start production.')}`);
  }
  revalidateOrderViews(id);
  redirect(fromList ? '/orders' : `/orders/${id}?sent=1`);
}

/** Complete a production stage, attributing it to an employee. */
export async function completeStage(formData: FormData): Promise<void> {
  await requirePermission('production.update');
  const id = String(formData.get('orderId') ?? '');
  const stage = String(formData.get('stage') ?? '');
  const agentProfileId = String(formData.get('employeeId') ?? '');
  const fromList = String(formData.get('from') ?? '') === 'list';
  if (!agentProfileId) {
    redirect(`/orders/${id}?error=${encodeURIComponent('Choisissez l’agent qui a fait cette étape.')}`);
  }
  // The picked agent is an app user; resolve (create on first use) their employee.
  const employeeId = await ensureAgentEmployeeId(agentProfileId);
  if (!employeeId) {
    redirect(`/orders/${id}?error=${encodeURIComponent('Could not resolve the agent.')}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('complete_order_stage', {
    p_order_id: id,
    p_stage: stage,
    p_employee_id: employeeId,
  });
  if (error) {
    redirect(`/orders/${id}?error=${encodeURIComponent('Could not complete the stage.')}`);
  }
  // Finishing the last stage makes it READY; if it's already fully paid, deliver.
  await autoDeliverIfFullyPaid(id);
  revalidateOrderViews(id);
  redirect(fromList ? '/orders' : `/orders/${id}?stage=${stage}`);
}

/** Mark an in-production order as ready (IN_PRODUCTION -> READY). */
export async function markOrderReady(formData: FormData): Promise<void> {
  await requirePermission('production.update');
  const id = String(formData.get('orderId') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_order_production_status', {
    p_order_id: id,
    p_to: 'READY',
  });
  if (error) {
    redirect(`/orders/${id}?error=${encodeURIComponent('Could not mark this order ready.')}`);
  }
  // If it was already fully paid, skip the READY column entirely → DELIVERED.
  await autoDeliverIfFullyPaid(id);
  revalidateOrderViews(id);
  redirect(`/orders/${id}?ready=1`);
}

/** Mark a ready delivery order as out for delivery (delivery READY -> OUT_FOR_DELIVERY). */
export async function markOutForDelivery(formData: FormData): Promise<void> {
  await requirePermission('delivery.update');
  const id = String(formData.get('orderId') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_order_delivery_status', {
    p_order_id: id,
    p_to: 'OUT_FOR_DELIVERY',
  });
  if (error) {
    redirect(`/orders/${id}?error=${encodeURIComponent('Could not update delivery status.')}`);
  }
  revalidateOrderViews(id);
  redirect(`/orders/${id}?dispatched=1`);
}

/** Mark an order delivered (delivery OUT_FOR_DELIVERY -> DELIVERED). */
export async function markDelivered(formData: FormData): Promise<void> {
  await requirePermission('delivery.update');
  const id = String(formData.get('orderId') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_order_delivery_status', {
    p_order_id: id,
    p_to: 'DELIVERED',
  });
  if (error) {
    redirect(`/orders/${id}?error=${encodeURIComponent('Could not update delivery status.')}`);
  }
  revalidateOrderViews(id);
  revalidatePath('/clients');
  redirect(`/orders/${id}?delivered=1`);
}

/** Delete an order. Blocked by FK if it has recorded financial transactions. */
export async function deleteOrder(formData: FormData): Promise<void> {
  await requirePermission('orders.delete');
  const id = String(formData.get('orderId') ?? '');
  const supabase = await createClient();

  const { data: imgs } = await supabase
    .from('order_images')
    .select('bucket, object_path')
    .eq('order_id', id);

  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) {
    redirect(
      `/orders/${id}?error=${encodeURIComponent(
        'Cannot delete this order (it may have recorded payments).',
      )}`,
    );
  }

  if (imgs && imgs.length > 0) {
    const service = createServiceClient();
    for (const img of imgs) {
      await service.storage.from(img.bucket).remove([img.object_path]);
    }
  }

  revalidatePath('/orders');
  redirect('/orders?deleted=1');
}

/** Mark an order as returned/refused (feeds the client "returned" badge). */
export async function markOrderReturned(formData: FormData): Promise<void> {
  await requirePermission('orders.edit');
  const id = String(formData.get('orderId') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_order_returned', {
    p_order_id: id,
    p_reason: reason || null,
  });
  if (error) {
    redirect(`/orders/${id}?error=${encodeURIComponent('Could not mark the order returned.')}`);
  }
  revalidateOrderViews(id);
  revalidatePath('/clients');
  revalidatePath('/finance');
  revalidatePath('/finance/transactions');
  revalidatePath('/finance/magasin');
  redirect(`/orders/${id}?returned=1`);
}

/** Undo a returned mark. */
export async function unmarkOrderReturned(formData: FormData): Promise<void> {
  await requirePermission('orders.edit');
  const id = String(formData.get('orderId') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.rpc('unmark_order_returned', { p_order_id: id });
  if (error) {
    redirect(`/orders/${id}?error=${encodeURIComponent('Could not clear the returned mark.')}`);
  }
  revalidateOrderViews(id);
  revalidatePath('/clients');
  revalidatePath('/finance');
  revalidatePath('/finance/transactions');
  revalidatePath('/finance/magasin');
  redirect(`/orders/${id}?returncleared=1`);
}

/** Assign (or clear) an order's custom status, from the Orders list. */
export async function setOrderCustomStatus(formData: FormData): Promise<void> {
  await requirePermission('orders.edit');
  const id = String(formData.get('orderId') ?? '');
  const raw = String(formData.get('customStatusId') ?? '');
  const supabase = await createClient();
  await supabase
    .from('orders')
    .update({ custom_status_id: raw ? raw : null })
    .eq('id', id);
  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
}

export type ReportState = { error?: string };

/** Report (postpone / reschedule) an order to a new delivery date, time and type. */
export async function reportOrder(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  await requirePermission('orders.edit');
  const id = String(formData.get('orderId') ?? '');
  const deliveryDate = String(formData.get('deliveryDate') ?? '');
  const deliveryTime = String(formData.get('deliveryTime') ?? '');
  const deliveryRequired = formData.get('deliveryRequired') === 'on';
  const reason = String(formData.get('reason') ?? '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) return { error: 'Choose a new delivery date.' };
  if (!/^\d{2}:\d{2}$/.test(deliveryTime)) return { error: 'Choose a new delivery time.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('report_order', {
    p_order_id: id,
    p_delivery_date: deliveryDate,
    p_delivery_time: deliveryTime,
    p_delivery_required: deliveryRequired,
    p_reason: reason || null,
  });
  if (error) return { error: 'Could not report the order.' };

  revalidateOrderViews(id);
  revalidatePath('/calendar');
  revalidatePath('/clients');
  redirect(`/orders/${id}?reported=1`);
}

/** Undo a report/postpone mark. */
export async function unreportOrder(formData: FormData): Promise<void> {
  await requirePermission('orders.edit');
  const id = String(formData.get('orderId') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.rpc('unreport_order', { p_order_id: id });
  if (error) {
    redirect(`/orders/${id}?error=${encodeURIComponent('Could not clear the report.')}`);
  }
  revalidateOrderViews(id);
  revalidatePath('/calendar');
  redirect(`/orders/${id}?reportcleared=1`);
}

export type UpdateOrderState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/** Edit an order. Operational fields need orders.edit; amounts need finance.view. */
export async function updateOrder(
  _prev: UpdateOrderState,
  formData: FormData,
): Promise<UpdateOrderState> {
  await requirePermission('orders.edit');
  const id = String(formData.get('orderId') ?? '');

  const parsed = OperationalOrderSchema.safeParse({
    customerName: formData.get('customerName'),
    customerPhone: formData.get('customerPhone'),
    cakeSizeCm: formData.get('cakeSizeCm'),
    description: formData.get('description') ?? '',
    fourage: formData.get('fourage') ?? '',
    coating: formData.get('coating') ?? '',
    deliveryDate: formData.get('deliveryDate'),
    deliveryTime: formData.get('deliveryTime'),
    deliveryRequired: formData.get('deliveryRequired') === 'on',
    deliveryAddress: formData.get('deliveryAddress') ?? '',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }
  const input = parsed.data;
  const supabase = await createClient();

  const productId = String(formData.get('productId') ?? '').trim();

  const { error: orderErr } = await supabase
    .from('orders')
    .update({
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      cake_size_cm: parseSizeNumber(input.cakeSizeCm) ?? 1,
      size_label: input.cakeSizeCm,
      description: input.description,
      fourage: input.fourage || null,
      coating: input.coating,
      delivery_date: input.deliveryDate,
      delivery_time: input.deliveryTime,
      delivery_required: input.deliveryRequired,
      delivery_address: input.deliveryRequired ? (input.deliveryAddress || null) : null,
      fulfillment: input.deliveryRequired ? 'DELIVERY' : 'PICKUP',
      ...(productId ? { product_id: productId } : {}),
    })
    .eq('id', id);
  if (orderErr) {
    return { error: 'Could not update the order.' };
  }

  // Replace the reference image if a new one was uploaded (directly to Storage
  // from the browser). Old image rows + objects are removed first.
  const newImagePath = ((formData.get('imagePath') as string) || '').trim() || null;
  if (newImagePath) {
    const newImageMime = ((formData.get('imageMime') as string) || '').trim() || null;
    const newImageSizeRaw = formData.get('imageSize');
    const newImageSize = newImageSizeRaw ? Number(newImageSizeRaw) : null;
    const service = createServiceClient();
    const { data: olds } = await service
      .from('order_images')
      .select('bucket, object_path')
      .eq('order_id', id);
    await service.from('order_images').delete().eq('order_id', id);
    for (const o of olds ?? []) {
      await service.storage.from(o.bucket).remove([o.object_path]);
    }
    await service.from('order_images').insert({
      order_id: id,
      bucket: BUCKET,
      object_path: newImagePath,
      mime_type: newImageMime,
      size_bytes: newImageSize,
    });
  }

  // Amounts only when the user holds finance permission (also enforced by RLS).
  const perms = await getMyPermissions();
  if (perms.has('finance.view') && formData.get('totalAmount') !== null) {
    const fin = FinancialOrderSchema.safeParse({
      totalAmount: formData.get('totalAmount'),
      montageAmount: formData.get('montageAmount') || 0,
      advancePayment: formData.get('advancePayment') || 0,
      deliveryAmount: formData.get('deliveryAmount') || 0,
    });
    if (!fin.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of fin.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return { error: 'Please fix the highlighted amounts.', fieldErrors };
    }
    const { error: finErr } = await supabase
      .from('order_financials')
      .update({
        total_amount: fin.data.totalAmount,
        montage_amount: fin.data.montageAmount,
        advance_payment: fin.data.advancePayment,
        delivery_amount: input.deliveryRequired ? fin.data.deliveryAmount : 0,
      })
      .eq('order_id', id);
    if (finErr) {
      return { error: 'Order saved, but amounts could not be updated.' };
    }
  }

  revalidateOrderViews(id);
  redirect(`/orders/${id}?updated=1`);
}

export type PaymentState = { error?: string };

/** Record a customer payment (cake amount) and optionally the delivery fee. */
export async function recordOrderPayment(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  await requirePermission('finance.income.create');
  const orderId = String(formData.get('orderId') ?? '');
  const amount = Number(formData.get('amount'));
  const kind = String(formData.get('kind') || 'PAYMENT');
  const receivedBy = String(formData.get('receivedBy') ?? '');

  if (!(amount > 0)) return { error: 'Enter a valid amount.' };

  // The picked agent is an app user; resolve their backing employee.
  const receivedByEmployee = await ensureAgentEmployeeId(receivedBy);

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_order_payment', {
    p_order_id: orderId,
    p_amount: amount,
    p_kind: kind,
    p_received_by: receivedByEmployee,
  });
  if (error) {
    return { error: /exceeds/.test(error.message) ? 'Payment exceeds the remaining amount.' : 'Could not record the payment.' };
  }

  // Fully paid + ready → move it out of READY into DELIVERED automatically.
  await autoDeliverIfFullyPaid(orderId);

  revalidateOrderViews(orderId);
  revalidatePath('/finance');
  revalidatePath('/finance/transactions');
  redirect(`/orders/${orderId}?paid=1`);
}
