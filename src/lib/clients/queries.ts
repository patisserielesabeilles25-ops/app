import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type {
  ProductionStatus,
  DeliveryStatus,
  Fulfillment,
} from '@/lib/orders/status';

export type ClientRow = {
  id: string;
  name: string;
  phone: string;
  date_of_birth: string | null;
  notes: string | null;
  created_at: string;
  total_orders: number;
  delivered_count: number;
  returned_count: number;
  last_order_date: string | null;
};

/** Remove characters that would break a PostgREST or()/ilike filter. */
function sanitize(term: string): string {
  return term.replace(/[,()%*]/g, ' ').trim();
}

export async function getClients({ q }: { q?: string }): Promise<ClientRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('client_overview')
    .select(
      'id, name, phone, date_of_birth, notes, created_at, total_orders, delivered_count, returned_count, last_order_date',
    )
    .order('name', { ascending: true })
    .limit(500);

  const term = q ? sanitize(q) : '';
  if (term) {
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
  }

  const { data } = await query;
  return (data ?? []) as ClientRow[];
}

export async function getClient(id: string): Promise<ClientRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('client_overview')
    .select(
      'id, name, phone, date_of_birth, notes, created_at, total_orders, delivered_count, returned_count, last_order_date',
    )
    .eq('id', id)
    .maybeSingle();
  return (data as ClientRow) ?? null;
}

export type ClientOrderRow = {
  id: string;
  order_number: string;
  cake_size_cm: number;
  delivery_date: string;
  delivery_time: string;
  fulfillment: Fulfillment;
  production_status: ProductionStatus;
  delivery_status: DeliveryStatus | null;
  returned_at: string | null;
};

export async function getClientOrders(customerId: string): Promise<ClientOrderRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select(
      'id, order_number, cake_size_cm, delivery_date, delivery_time, fulfillment, production_status, delivery_status, returned_at',
    )
    .eq('customer_id', customerId)
    .order('delivery_date', { ascending: false })
    .limit(200);
  return (data ?? []) as ClientOrderRow[];
}
