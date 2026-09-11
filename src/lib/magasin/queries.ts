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

/** Africa/Algiers is UTC+1 year-round (no DST), so a fixed +01:00 offset is exact. */
function algiersDayStartIso(date: string): string {
  return `${date}T00:00:00+01:00`;
}

/**
 * Same shape as getMagasinDay but over an inclusive [from, to] date range.
 * Uses direct table reads (RLS-gated by finance.transactions.view) rather than
 * the per-day RPCs, so it mirrors the daily summary/expense logic across a span.
 */
export async function getMagasinRange(from: string, to: string): Promise<MagasinDay> {
  const supabase = await createClient();

  // Range boundaries: [from 00:00 +01:00, day-after-to 00:00 +01:00).
  const startIso = algiersDayStartIso(from);
  const endExclusive = new Date(algiersDayStartIso(to));
  endExclusive.setDate(endExclusive.getDate() + 1);
  const endIso = endExclusive.toISOString();

  const { data: sales } = await supabase
    .from('magasin_sales')
    .select('id, total_amount, created_at, employee:employee_id(full_name), magasin_sale_lines(product_name, quantity, unit_price, line_total)')
    .gte('sale_date', from)
    .lte('sale_date', to)
    .order('created_at', { ascending: false });

  const { data: orderPays } = await supabase
    .from('financial_transactions')
    .select('id, amount, description, occurred_at')
    .eq('type', 'INCOME')
    .ilike('category', 'ORDER%')
    .gte('occurred_at', startIso)
    .lt('occurred_at', endIso)
    .order('occurred_at', { ascending: false });

  // Magasin expenses + salary payments (mirrors magasin_day_expenses).
  const { data: exp } = await supabase
    .from('financial_transactions')
    .select('id, amount, description, occurred_at, category, cat:financial_categories(name), employee:employees(full_name)')
    .eq('type', 'EXPENSE')
    .or('source.eq.MAGASIN,category.eq.PAYROLL_SALARY')
    .gte('occurred_at', startIso)
    .lt('occurred_at', endIso)
    .order('occurred_at', { ascending: false });

  const salesRows = (sales ?? []).map((x) => ({
    id: x.id as string,
    total_amount: Number(x.total_amount),
    agent: ((x.employee as unknown as { full_name?: string } | null)?.full_name) ?? null,
    lines: ((x.magasin_sale_lines ?? []) as Record<string, unknown>[]).map((l) => ({
      product_name: String(l.product_name),
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
      line_total: Number(l.line_total),
    })),
  }));
  const expenseRows = ((exp ?? []) as Record<string, unknown>[]).map((e) => ({
    id: String(e.id),
    amount: Number(e.amount),
    category: ((e.cat as { name?: string } | null)?.name) || String(e.category ?? 'Other'),
    description: (e.description as string) ?? null,
    agent: ((e.employee as { full_name?: string } | null)?.full_name) ?? null,
  }));
  const orderPaymentRows = (orderPays ?? []).map((p) => ({
    id: p.id as string,
    amount: Number(p.amount),
    description: (p.description as string) ?? null,
  }));

  const salesTotal = salesRows.reduce((t, s) => t + s.total_amount, 0);
  const orderPaymentsTotal = orderPaymentRows.reduce((t, p) => t + p.amount, 0);
  const expensesTotal = expenseRows.reduce((t, e) => t + e.amount, 0);
  const incomeTotal = salesTotal + orderPaymentsTotal;

  return {
    sales: salesRows,
    orderPayments: orderPaymentRows,
    expenses: expenseRows,
    summary: { sales: incomeTotal, expenses: expensesTotal, net: incomeTotal - expensesTotal },
  };
}

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
