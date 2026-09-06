import 'server-only';

import { createClient } from '@/lib/supabase/server';

export type MagasinLine = {
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};
export type MagasinSale = { id: string; total_amount: number; agent: string | null; lines: MagasinLine[] };
export type MagasinExpense = {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  agent: string | null;
};
export type OrderPayment = { id: string; amount: number; description: string | null };
export type MagasinDay = {
  sales: MagasinSale[];
  orderPayments: OrderPayment[];
  expenses: MagasinExpense[];
  summary: { sales: number; expenses: number; net: number };
};

export async function getMagasinDay(date: string): Promise<MagasinDay> {
  const supabase = await createClient();

  const { data: sales } = await supabase
    .from('magasin_sales')
    .select('id, total_amount, created_at, employee:employee_id(full_name), magasin_sale_lines(product_name, quantity, unit_price, line_total)')
    .eq('sale_date', date)
    .order('created_at', { ascending: false });

  // Order payments received on this day (RLS: needs finance.transactions.view).
  const startIso = `${date}T00:00:00+01:00`;
  const next = new Date(startIso);
  next.setDate(next.getDate() + 1);
  const { data: orderPays } = await supabase
    .from('financial_transactions')
    .select('id, amount, description, occurred_at')
    .eq('type', 'INCOME')
    .ilike('category', 'ORDER%')
    .gte('occurred_at', startIso)
    .lt('occurred_at', next.toISOString())
    .order('occurred_at', { ascending: false });

  const { data: sum } = await supabase.rpc('magasin_daily_summary', { p_date: date });
  const s = Array.isArray(sum) ? sum[0] : sum;

  const { data: exp } = await supabase.rpc('magasin_day_expenses', { p_date: date });

  const orderPaymentsTotal = (orderPays ?? []).reduce((t, p) => t + Number(p.amount), 0);
  const magasinSales = Number(s?.sales ?? 0);
  const dayExpenses = Number(s?.expenses ?? 0);

  return {
    expenses: ((exp ?? []) as Record<string, unknown>[]).map((e) => ({
      id: String(e.id),
      amount: Number(e.amount),
      category: String(e.category ?? 'Other'),
      description: (e.description as string) ?? null,
      agent: (e.agent as string) ?? null,
    })),
    sales: (sales ?? []).map((x) => ({
      id: x.id as string,
      total_amount: Number(x.total_amount),
      agent: ((x.employee as unknown as { full_name?: string } | null)?.full_name) ?? null,
      lines: ((x.magasin_sale_lines ?? []) as Record<string, unknown>[]).map((l) => ({
        product_name: String(l.product_name),
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        line_total: Number(l.line_total),
      })),
    })),
    orderPayments: (orderPays ?? []).map((p) => ({
      id: p.id as string,
      amount: Number(p.amount),
      description: (p.description as string) ?? null,
    })),
    summary: {
      sales: magasinSales + orderPaymentsTotal,
      expenses: dayExpenses,
      net: magasinSales + orderPaymentsTotal - dayExpenses,
    },
  };
}
