'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { ensureAgentEmployeeId } from '@/lib/agents/resolve';
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
    deliveryDate: formData.get('deliveryDate'),
    deliveryTime: formData.get('deliveryTime'),
    deliveryRequired: formData.get('deliveryRequired') === 'on',
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

  // Optional reference image.
  const file = formData.get('image');
  let imagePath: string | null = null;
  const hasImage = file instanceof File && file.size > 0;

  if (hasImage) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return { error: 'Image must be JPEG, PNG, or WEBP.' };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { error: 'Image must be 5 MB or smaller.' };
    }
    const service = createServiceClient();
    const path = `${crypto.randomUUID()}/${safeName(file.name || 'image')}`;
    const { error: upErr } = await service.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      return { error: `Image upload failed: ${upErr.message}` };
    }
    imagePath = path;
  }

  // The chosen agent is an app user; resolve (create on first use) the backing
  // employee so the advance is attributed in Magasin "Today's sales".
  const receivedByEmployee = await ensureAgentEmployeeId(input.receivedBy);

  // Atomic create via SECURITY DEFINER function (as the signed-in user).
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_order', {
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_cake_size_cm: input.cakeSizeCm,
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
    p_image_mime: hasImage ? (file as File).type : null,
    p_image_size: hasImage ? (file as File).size : null,
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
  const patch: { product_id?: string; fourage?: string | null } = {};
  if (productId) patch.product_id = productId;
  if (input.fourage) patch.fourage = input.fourage;
  if (created?.id && Object.keys(patch).length > 0) {
    await createServiceClient().from('orders').update(patch).eq('id', created.id);
  }

  redirect(created?.id ? `/orders/${created.id}?created=1` : '/orders');
}

function revalidateOrderViews(id: string) {
  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
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
 * Start production on an order (NOUVEAU -> EN_PREPARATION) and immediately
 * auto-complete the Preparation stage — so production advances straight to
 * EN_MASKAGE — crediting it to the user who clicked Start (users are agents).
 */
export async function startProduction(formData: FormData): Promise<void> {
  await requirePermission('orders.edit');
  const id = String(formData.get('orderId') ?? '');
  const fromList = String(formData.get('from') ?? '') === 'list';
  const supabase = await createClient();
  const { error } = await supabase.rpc('start_order_production', { p_order_id: id });
  if (error) {
    redirect(`/orders/${id}?error=${encodeURIComponent('Could not start production.')}`);
  }

  // Auto-record the Preparation stage as done, attributed to the current user.
  const { data: auth } = await supabase.auth.getUser();
  const employeeId = auth.user ? await ensureAgentEmployeeId(auth.user.id) : null;
  if (employeeId) {
    await supabase.rpc('complete_order_stage', {
      p_order_id: id,
      p_stage: 'PREPARATION',
      p_employee_id: employeeId,
    });
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
    deliveryDate: formData.get('deliveryDate'),
    deliveryTime: formData.get('deliveryTime'),
    deliveryRequired: formData.get('deliveryRequired') === 'on',
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

  const { error: orderErr } = await supabase
    .from('orders')
    .update({
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      cake_size_cm: input.cakeSizeCm,
      description: input.description,
      fourage: input.fourage || null,
      delivery_date: input.deliveryDate,
      delivery_time: input.deliveryTime,
      delivery_required: input.deliveryRequired,
      fulfillment: input.deliveryRequired ? 'DELIVERY' : 'PICKUP',
    })
    .eq('id', id);
  if (orderErr) {
    return { error: 'Could not update the order.' };
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

  revalidateOrderViews(orderId);
  revalidatePath('/finance');
  revalidatePath('/finance/transactions');
  redirect(`/orders/${orderId}?paid=1`);
}
