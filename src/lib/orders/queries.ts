import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getSignedOrderImageUrl } from '@/lib/orders/images';
import type {
  ProductionStatus,
  DeliveryStatus,
  Fulfillment,
  BadgeTone,
} from '@/lib/orders/status';
import { orderCanonicalStatus } from '@/lib/statuses/derive';
import { isCanonicalKey } from '@/lib/statuses/constants';

export type OrderListRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  cake_size_cm: number;
  delivery_date: string;
  delivery_time: string;
  production_status: ProductionStatus;
  delivery_status: DeliveryStatus | null;
  fulfillment: Fulfillment;
  returned_at: string | null;
  reported_at: string | null;
  production_stage: string | null;
  custom_status_id: string | null;
  customer_id: string | null;
  fourage: string | null;
  coating: string | null;
  size_label: string | null;
  remaining?: number;
  product_name: string | null;
  image_url: string | null;
  client_delivered: number;
  client_returned: number;
};

const LIST_COLUMNS =
  'id, order_number, customer_id, customer_name, customer_phone, cake_size_cm, delivery_date, delivery_time, production_status, delivery_status, fulfillment, returned_at, reported_at, production_stage, custom_status_id, fourage, coating, size_label';

/** Remove characters that would break a PostgREST or()/ilike filter. */
function sanitize(term: string): string {
  return term.replace(/[,()%*]/g, ' ').trim();
}

export async function getOrders({
  status,
  q,
  withBalances,
}: {
  status?: string;
  q?: string;
  withBalances?: boolean;
}): Promise<OrderListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('orders')
    .select(`${LIST_COLUMNS}, product:products(name, diameter_cm), order_images(bucket, object_path)`)
    // Newest first, by when the order was placed (creation time).
    .order('created_at', { ascending: false })
    .limit(2000);

  const term = q ? sanitize(q) : '';
  if (term) {
    query = query.or(
      `order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`,
    );
  }

  type RawOrder = OrderListRow & {
    product: { name: string | null; diameter_cm: number } | null;
    order_images: { bucket: string; object_path: string }[] | null;
  };
  const { data } = await query;
  let raw = (data ?? []) as unknown as RawOrder[];

  // Filter by canonical status (derived from production/delivery/returned state).
  if (status && isCanonicalKey(status)) {
    raw = raw.filter((o) => orderCanonicalStatus(o) === status);
  }

  // Remaining balance per order (needs finance RLS). Not a filter.
  const remaining = new Map<string, number>();
  if (withBalances && raw.length > 0) {
    const ids = raw.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 500) {
      const { data: fin } = await supabase
        .from('order_financials')
        .select('order_id, remaining_amount')
        .in('order_id', ids.slice(i, i + 500));
      for (const f of fin ?? []) remaining.set(f.order_id as string, Number(f.remaining_amount ?? 0));
    }
  }

  // Per-customer standing (delivered / returned counts) for the name badge.
  const clientStats = new Map<string, { delivered: number; returned: number }>();
  const custIds = [...new Set(raw.map((r) => r.customer_id).filter(Boolean) as string[])];
  if (custIds.length > 0) {
    for (let i = 0; i < custIds.length; i += 500) {
      const { data: co } = await supabase
        .from('client_overview')
        .select('id, delivered_count, returned_count')
        .in('id', custIds.slice(i, i + 500));
      for (const c of co ?? []) {
        clientStats.set(c.id as string, {
          delivered: Number(c.delivered_count ?? 0),
          returned: Number(c.returned_count ?? 0),
        });
      }
    }
  }

  // Product name + signed reference-image URL per row.
  const rows: OrderListRow[] = await Promise.all(
    raw.map(async (o) => {
      const img = Array.isArray(o.order_images) ? o.order_images[0] : null;
      const image_url = img ? await getSignedOrderImageUrl(img.bucket, img.object_path) : null;
      const productName = o.product
        ? o.product.name || `⌀ ${o.product.diameter_cm} cm`
        : null;
      const stat = o.customer_id ? clientStats.get(o.customer_id) : null;
      const { product: _p, order_images: _oi, ...rest } = o;
      void _p; void _oi;
      return {
        ...(rest as OrderListRow),
        product_name: productName,
        image_url,
        remaining: withBalances ? remaining.get(o.id) ?? 0 : undefined,
        client_delivered: stat?.delivered ?? 0,
        client_returned: stat?.returned ?? 0,
      };
    }),
  );

  return rows;
}

export type OrderStatusCounts = { total: number; byCanonical: Record<string, number> };

/** Counts of orders by canonical status (for the status tabs). */
export async function getOrderStatusCounts(): Promise<OrderStatusCounts> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('production_status, delivery_status, fulfillment, returned_at, reported_at, production_stage, delivery_date')
    .limit(100000);
  const rows = (data ?? []) as Pick<
    OrderListRow,
    'production_status' | 'delivery_status' | 'fulfillment' | 'returned_at' | 'reported_at' | 'production_stage' | 'delivery_date'
  >[];
  const byCanonical: Record<string, number> = {};
  for (const r of rows) {
    const k = orderCanonicalStatus(r);
    byCanonical[k] = (byCanonical[k] ?? 0) + 1;
  }
  return { total: rows.length, byCanonical };
}

export type OrderDetail = {
  order: {
    id: string;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    cake_size_cm: number;
    size_label: string | null;
    description: string | null;
    fourage: string | null;
    coating: string | null;
    delivery_date: string;
    delivery_time: string;
    delivery_required: boolean;
    fulfillment: Fulfillment;
    production_status: ProductionStatus;
    production_stage: string | null;
    delivery_status: DeliveryStatus | null;
    sent_to_lab_at: string | null;
    ready_at: string | null;
    returned_at: string | null;
    return_reason: string | null;
    reported_at: string | null;
    report_reason: string | null;
    created_at: string;
    created_by: string | null;
    product_id: string | null;
  } | null;
  financials: {
    total_amount: number;
    montage_amount: number;
    advance_payment: number;
    delivery_amount: number;
    remaining_amount: number;
  } | null;
  image: { bucket: string; object_path: string } | null;
};

export async function getOrderDetail(id: string): Promise<OrderDetail> {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, order_number, customer_name, customer_phone, cake_size_cm, size_label, description, fourage, coating, delivery_date, delivery_time, delivery_required, fulfillment, production_status, production_stage, delivery_status, sent_to_lab_at, ready_at, returned_at, return_reason, reported_at, report_reason, created_at, created_by, product_id',
    )
    .eq('id', id)
    .maybeSingle();

  // RLS returns nothing here for users without finance permission.
  const { data: financials } = await supabase
    .from('order_financials')
    .select('total_amount, montage_amount, advance_payment, delivery_amount, remaining_amount')
    .eq('order_id', id)
    .maybeSingle();

  const { data: image } = await supabase
    .from('order_images')
    .select('bucket, object_path')
    .eq('order_id', id)
    .maybeSingle();

  return {
    order: order as OrderDetail['order'],
    financials: financials as OrderDetail['financials'],
    image: image as OrderDetail['image'],
  };
}

export type StatusEvent = {
  key: string;
  label: string;
  tone: BadgeTone;
  note: string | null;
  at: string;
  actor: string;
};

/** Map a production/delivery status value to a display label + tone. */
function statusMeta(field: string, value: string | null): { label: string; tone: BadgeTone } {
  if (field === 'production_status') {
    if (value === 'READY') return { label: 'READY', tone: 'green' };
    if (value === 'IN_PRODUCTION') return { label: 'EN PRÉPARATION', tone: 'amber' };
    return { label: 'NOUVEAU', tone: 'blue' };
  }
  // delivery_status
  if (value === 'DELIVERED') return { label: 'DELIVERED', tone: 'neutral' };
  if (value === 'OUT_FOR_DELIVERY') return { label: 'EN LIVRAISON', tone: 'violet' };
  return { label: 'PRÊT À LIVRER', tone: 'green' };
}

/**
 * Unified status history for one order: creation, production/delivery
 * transitions (order_status_history), and returned/return-cleared events
 * (audit_log). Each event carries the timestamp and the acting user. Newest
 * first. Audit-sourced events are visible to settings.manage holders (RLS);
 * creation and status transitions are visible to any order viewer.
 */
export async function getOrderStatusHistory(orderId: string): Promise<StatusEvent[]> {
  const supabase = await createClient();

  const [{ data: order }, { data: history }, { data: audits }] = await Promise.all([
    supabase.from('orders').select('created_at, created_by').eq('id', orderId).maybeSingle(),
    supabase
      .from('order_status_history')
      .select('id, field, to_value, changed_by, changed_at')
      .eq('order_id', orderId)
      .order('changed_at', { ascending: false }),
    supabase
      .from('audit_log')
      .select('id, action, metadata, actor_id, created_at')
      .eq('entity_type', 'order')
      .eq('entity_id', orderId)
      .in('action', ['order.returned', 'order.return_cleared', 'order.reported', 'order.report_cleared', 'order.stage_done', 'order.production_start']),
  ]);

  // Resolve actor names in one query.
  const ids = new Set<string>();
  if (order?.created_by) ids.add(order.created_by as string);
  for (const h of history ?? []) if (h.changed_by) ids.add(h.changed_by as string);
  for (const a of audits ?? []) if (a.actor_id) ids.add(a.actor_id as string);
  const names = new Map<string, string>();
  if (ids.size > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', [...ids]);
    for (const p of profs ?? []) names.set(p.id as string, (p.full_name as string) ?? '');
  }
  const nameOf = (id: string | null) => (id && names.get(id)) || 'Système';

  const events: StatusEvent[] = [];

  for (const h of history ?? []) {
    const meta = statusMeta(h.field as string, h.to_value as string | null);
    events.push({
      key: `h-${h.id}`,
      label: meta.label,
      tone: meta.tone,
      note: null,
      at: h.changed_at as string,
      actor: nameOf(h.changed_by as string | null),
    });
  }

  const STAGE_FR: Record<string, string> = { PREPARATION: 'PRÉPARATION', MASKAGE: 'MASKAGE', FINITION: 'FINITION' };
  for (const a of audits ?? []) {
    const action = a.action as string;
    const meta = (a.metadata as { reason?: string; delivery_date?: string; delivery_time?: string; stage?: string; employee_name?: string } | null) ?? {};
    let label = 'RETOUR ANNULÉ';
    let tone: BadgeTone = 'neutral';
    let note: string | null = null;
    if (action === 'order.returned') {
      label = 'RETURNED';
      tone = 'rose';
      note = meta.reason ?? null;
    } else if (action === 'order.reported') {
      label = 'REPORTED';
      tone = 'amber';
      const parts: string[] = [];
      if (meta.delivery_date) {
        parts.push(`Reprogrammé au ${meta.delivery_date}${meta.delivery_time ? ` ${meta.delivery_time.slice(0, 5)}` : ''}`);
      }
      if (meta.reason) parts.push(meta.reason);
      note = parts.length ? parts.join(' · ') : null;
    } else if (action === 'order.report_cleared') {
      label = 'REPORT ANNULÉ';
      tone = 'neutral';
    } else if (action === 'order.production_start') {
      label = 'PRODUCTION DÉMARRÉE';
      tone = 'blue';
    } else if (action === 'order.stage_done') {
      label = `${STAGE_FR[meta.stage ?? ''] ?? meta.stage ?? 'ÉTAPE'} ✓`;
      tone = 'green';
      note = meta.employee_name ? `Par ${meta.employee_name}` : null;
    }
    events.push({
      key: `a-${a.id}`,
      label,
      tone,
      note,
      at: a.created_at as string,
      actor: nameOf(a.actor_id as string | null),
    });
  }

  if (order?.created_at) {
    events.push({
      key: 'created',
      label: 'COMMANDE CRÉÉE',
      tone: 'blue',
      note: null,
      at: order.created_at as string,
      actor: nameOf(order.created_by as string | null),
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events;
}

export type OrderStageRow = { stage: string; employee_name: string | null; done_at: string };

/** Completed production stages for an order, with the employee who did each. */
export async function getOrderStages(orderId: string): Promise<OrderStageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('order_stages')
    .select('stage, done_at, employee:employee_id(full_name)')
    .eq('order_id', orderId);
  return (data ?? []).map((r) => ({
    stage: r.stage as string,
    employee_name: (r.employee as unknown as { full_name: string } | null)?.full_name ?? null,
    done_at: r.done_at as string,
  }));
}
