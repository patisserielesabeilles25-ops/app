import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { orderCanonicalStatus } from '@/lib/statuses/derive';
import type {
  ProductionStatus,
  DeliveryStatus,
  Fulfillment,
} from '@/lib/orders/status';

export type DashboardStats = {
  newCount: number;
  inProduction: number;
  ready: number;
  outForDelivery: number;
  todayCount: number;
  weekCount: number;
  readyMadeToday: number;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const t = today();
  const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const base = () => supabase.from('orders').select('*', { count: 'exact', head: true });
  const num = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

  const [newCount, inProduction, outForDelivery, todayCount, weekCount] =
    await Promise.all([
      num(base().eq('production_status', 'NEW')),
      num(base().eq('production_status', 'IN_PRODUCTION')),
      num(base().eq('delivery_status', 'OUT_FOR_DELIVERY')),
      num(base().eq('delivery_date', t)),
      num(base().gte('delivery_date', t).lte('delivery_date', in7)),
    ]);

  // "Ready" must match the /orders?status=READY list, i.e. the canonical status.
  // A raw production_status='READY' count over-counts, because auto-delivered
  // orders keep production_status='READY' (only delivery_status flips).
  const { data: statusRows } = await supabase
    .from('orders')
    .select('production_status, delivery_status, fulfillment, returned_at, reported_at, production_stage, delivery_date')
    .limit(100000);
  const ready = (statusRows ?? []).filter((r) => orderCanonicalStatus(r) === 'READY').length;

  const { data: rm } = await supabase
    .from('ready_made_daily_production')
    .select('small_qty, medium_qty, large_qty')
    .eq('production_date', t)
    .maybeSingle();
  const readyMadeToday = rm ? rm.small_qty + rm.medium_qty + rm.large_qty : 0;

  return { newCount, inProduction, ready, outForDelivery, todayCount, weekCount, readyMadeToday };
}

export type TodayOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  delivery_time: string;
  cake_size_cm: number;
  size_label: string | null;
  production_status: ProductionStatus;
  delivery_status: DeliveryStatus | null;
  fulfillment: Fulfillment;
};

export async function getTodayOrders(): Promise<TodayOrder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, delivery_time, cake_size_cm, size_label, production_status, delivery_status, fulfillment')
    .eq('delivery_date', today())
    .order('delivery_time', { ascending: true });
  return (data ?? []) as TodayOrder[];
}
