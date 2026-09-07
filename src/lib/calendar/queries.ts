import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type {
  ProductionStatus,
  DeliveryStatus,
  Fulfillment,
} from '@/lib/orders/status';

export type CalendarOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  delivery_date: string;
  delivery_time: string;
  cake_size_cm: number;
  production_status: ProductionStatus;
  delivery_status: DeliveryStatus | null;
  fulfillment: Fulfillment;
  returned_at: string | null;
  reported_at: string | null;
  production_stage: string | null;
  /** Reference image metadata (binary lives in Storage). Sign a URL to display. */
  image: { bucket: string; object_path: string } | null;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Orders whose delivery_date falls in the given month, grouped by day (yyyy-mm-dd). */
export async function getMonthOrders(
  year: number,
  month: number,
): Promise<Map<string, CalendarOrder[]>> {
  const start = `${year}-${pad(month)}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${pad(nextMonth)}-01`;

  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select(
      'id, order_number, customer_name, delivery_date, delivery_time, cake_size_cm, production_status, delivery_status, fulfillment, returned_at, reported_at, production_stage, order_images(bucket, object_path)',
    )
    .gte('delivery_date', start)
    .lt('delivery_date', end)
    .order('delivery_time', { ascending: true });

  type Raw = Omit<CalendarOrder, 'image'> & {
    order_images: { bucket: string; object_path: string }[] | null;
  };

  const byDay = new Map<string, CalendarOrder[]>();
  for (const raw of (data ?? []) as unknown as Raw[]) {
    const { order_images, ...rest } = raw;
    const order: CalendarOrder = {
      ...rest,
      image: Array.isArray(order_images) ? order_images[0] ?? null : null,
    };
    const key = order.delivery_date;
    const list = byDay.get(key);
    if (list) list.push(order);
    else byDay.set(key, [order]);
  }
  return byDay;
}
