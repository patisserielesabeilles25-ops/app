import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import type { Range } from '@/lib/reports/period';

export type OrderAnalytics = {
  totalOrders: number;
  activeClients: number;
  newClients: number;
  returningClients: number;
  recurrentPct: number;
  recurrentAllTimePct: number;
  totalClients: number;
  revenue: number;
  collected: number;
  outstanding: number;
  avgOrderValue: number;
  returnRate: number;
  reportedRate: number;
  pickup: number;
  delivery: number;
  topClients: { name: string; orders: number }[];
  topProducts: { name: string; count: number }[];
  topSizes: { size: number; count: number }[];
  revenueByMonth: { label: string; revenue: number }[];
  weekdays: { label: string; count: number }[];
  birthdays: { name: string; day: number }[];
};

const num = (v: unknown) => Number(v ?? 0);
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/**
 * Business analytics derived from orders/customers for a period. Uses the
 * service client (the page already enforces finance.reports.view), so it works
 * regardless of the viewer's orders/finance row-level permissions.
 */
export async function getOrderAnalytics(range: Range): Promise<OrderAnalytics> {
  const service = createServiceClient();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const sixIso = sixMonthsAgo.toISOString();

  const [{ data: allRows }, { data: periodRows }, { data: trendRows }, { data: custRows }, { data: prodRows }] = await Promise.all([
    service.from('orders').select('customer_id, created_at').limit(100000),
    service
      .from('orders')
      .select('id, customer_id, cake_size_cm, fulfillment, returned_at, reported_at, delivery_date, created_at, product_id')
      .gte('created_at', range.from)
      .lte('created_at', range.to)
      .limit(100000),
    service.from('orders').select('id, created_at').gte('created_at', sixIso).limit(100000),
    service.from('customers').select('id, name, date_of_birth').limit(100000),
    service.from('products').select('id, name, diameter_cm').limit(100000),
  ]);

  const all = allRows ?? [];
  const period = periodRows ?? [];
  const trend = trendRows ?? [];
  const customers = custRows ?? [];
  const products = prodRows ?? [];
  const productLabel = new Map<string, string>();
  for (const p of products) productLabel.set(p.id as string, (p.name as string) || `⌀ ${num(p.diameter_cm)} cm`);

  // Per-customer lifetime count + first order date.
  const perCustomer = new Map<string, { count: number; first: string }>();
  for (const o of all) {
    const id = o.customer_id as string | null;
    if (!id) continue;
    const cur = perCustomer.get(id);
    const at = o.created_at as string;
    if (cur) {
      cur.count += 1;
      if (at < cur.first) cur.first = at;
    } else {
      perCustomer.set(id, { count: 1, first: at });
    }
  }

  const totalClients = perCustomer.size;
  const recurrentAllTime = [...perCustomer.values()].filter((c) => c.count >= 2).length;
  const recurrentAllTimePct = totalClients ? (recurrentAllTime / totalClients) * 100 : 0;

  const activeIds = new Set<string>();
  for (const o of period) if (o.customer_id) activeIds.add(o.customer_id as string);
  let newClients = 0;
  for (const id of activeIds) {
    const c = perCustomer.get(id);
    if (c && c.first >= range.from) newClients += 1;
  }
  const activeClients = activeIds.size;
  const returningClients = activeClients - newClients;
  const recurrentPct = activeClients ? (returningClients / activeClients) * 100 : 0;

  // Fulfillment / returns / reported / weekday / sizes over the period.
  let pickup = 0;
  let delivery = 0;
  let returned = 0;
  let reported = 0;
  const sizeCounts = new Map<number, number>();
  const productCounts = new Map<string, number>();
  const weekdayCounts = new Array(7).fill(0);
  for (const o of period) {
    if (o.fulfillment === 'DELIVERY') delivery += 1;
    else pickup += 1;
    if (o.returned_at) returned += 1;
    if (o.reported_at) reported += 1;
    const s = num(o.cake_size_cm);
    if (s > 0) sizeCounts.set(s, (sizeCounts.get(s) ?? 0) + 1);
    const pid = o.product_id as string | null;
    if (pid) productCounts.set(pid, (productCounts.get(pid) ?? 0) + 1);
    if (o.delivery_date) {
      const d = new Date(`${o.delivery_date}T00:00:00`);
      if (!Number.isNaN(d.getTime())) weekdayCounts[d.getDay()] += 1;
    }
  }
  const totalOrders = period.length;
  const returnRate = totalOrders ? (returned / totalOrders) * 100 : 0;
  const reportedRate = totalOrders ? (reported / totalOrders) * 100 : 0;

  // Revenue / collected / outstanding from financials of the period's orders.
  const periodIds = period.map((o) => o.id as string);
  let revenue = 0;
  let collected = 0;
  let outstanding = 0;
  if (periodIds.length > 0) {
    const { data: fin } = await service
      .from('order_financials')
      .select('total_amount, advance_payment, remaining_amount')
      .in('order_id', periodIds);
    for (const f of fin ?? []) {
      revenue += num(f.total_amount);
      collected += num(f.advance_payment);
      outstanding += num(f.remaining_amount);
    }
  }
  const avgOrderValue = totalOrders ? revenue / totalOrders : 0;

  // Top clients (lifetime order count).
  const topEntries = [...perCustomer.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);
  const nameById = new Map<string, string>();
  for (const c of customers) nameById.set(c.id as string, (c.name as string) ?? '');
  const topClients = topEntries.map(([id, v]) => ({ name: nameById.get(id) || 'Client', orders: v.count }));

  const topSizes = [...sizeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([size, count]) => ({ size, count }));

  const topProducts = [...productCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ name: productLabel.get(id) || 'Produit', count }));

  // Revenue by month (last 6 months) from a total_amount lookup.
  const revByMonthKey = new Map<string, number>();
  if (trend.length > 0) {
    const trendIds = trend.map((o) => o.id as string);
    const totalById = new Map<string, number>();
    // Fetch financials in chunks to stay well within limits.
    for (let i = 0; i < trendIds.length; i += 500) {
      const chunk = trendIds.slice(i, i + 500);
      const { data: fin } = await service
        .from('order_financials')
        .select('order_id, total_amount')
        .in('order_id', chunk);
      for (const f of fin ?? []) totalById.set(f.order_id as string, num(f.total_amount));
    }
    for (const o of trend) {
      const d = new Date(o.created_at as string);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      revByMonthKey.set(key, (revByMonthKey.get(key) ?? 0) + (totalById.get(o.id as string) ?? 0));
    }
  }
  const revenueByMonth: { label: string; revenue: number }[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() - 5);
  for (let i = 0; i < 6; i++) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    revenueByMonth.push({ label: MONTHS[cursor.getMonth()], revenue: revByMonthKey.get(key) ?? 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const weekdays = weekdayCounts.map((count, i) => ({ label: WEEKDAYS[i], count }));

  // Birthdays this calendar month.
  const thisMonth = new Date().getMonth() + 1; // 1-12
  const birthdays = customers
    .filter((c) => c.date_of_birth)
    .map((c) => {
      const parts = String(c.date_of_birth).split('-'); // yyyy-mm-dd
      return { name: (c.name as string) ?? 'Client', month: Number(parts[1]), day: Number(parts[2]) };
    })
    .filter((b) => b.month === thisMonth)
    .sort((a, b) => a.day - b.day)
    .slice(0, 12)
    .map((b) => ({ name: b.name, day: b.day }));

  return {
    totalOrders,
    activeClients,
    newClients,
    returningClients,
    recurrentPct,
    recurrentAllTimePct,
    totalClients,
    revenue,
    collected,
    outstanding,
    avgOrderValue,
    returnRate,
    reportedRate,
    pickup,
    delivery,
    topClients,
    topProducts,
    topSizes,
    revenueByMonth,
    weekdays,
    birthdays,
  };
}
