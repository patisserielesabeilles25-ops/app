import 'server-only';

import { createClient } from '@/lib/supabase/server';

export type TransactionRow = {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  occurred_at: string;
  item_name: string | null;
  description: string | null;
  order_id: string | null;
  created_by_name: string | null;
  hasAttachment: boolean;
};

export type FinanceSummary = {
  balance: number;
  incomeTotal: number;
  expenseTotal: number;
  count: number;
};

/**
 * Loads transactions (RLS-gated by finance.transactions.view) and flags which
 * have an attachment. Returns [] for users without the permission.
 */
export type TransactionFilter = {
  type?: 'INCOME' | 'EXPENSE';
  from?: string;
  to?: string;
  department?: string;
  source?: string;
  categoryId?: string;
};

export async function getTransactions(filter?: TransactionFilter): Promise<TransactionRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('financial_transactions')
    .select('id, type, category, amount, occurred_at, item_name, description, order_id, creator:profiles!created_by(full_name)')
    .order('occurred_at', { ascending: false })
    .limit(500);
  if (filter?.type) query = query.eq('type', filter.type);
  if (filter?.from) query = query.gte('occurred_at', filter.from);
  if (filter?.to) query = query.lt('occurred_at', filter.to);
  if (filter?.department) query = query.eq('department', filter.department);
  if (filter?.source) query = query.eq('source', filter.source);
  if (filter?.categoryId) query = query.eq('category_id', filter.categoryId);

  const { data } = await query;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: atts } = await supabase
    .from('financial_attachments')
    .select('transaction_id')
    .in('transaction_id', ids);
  const withAtt = new Set((atts ?? []).map((a) => a.transaction_id));

  return rows.map((r) => {
    const { creator, ...rest } = r as typeof r & { creator: { full_name?: string } | null };
    return {
      ...rest,
      type: r.type as 'INCOME' | 'EXPENSE',
      created_by_name: creator?.full_name ?? null,
      hasAttachment: withAtt.has(r.id),
    };
  });
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('financial_transactions')
    .select('type, amount')
    .limit(100000);
  const rows = data ?? [];
  let incomeTotal = 0;
  let expenseTotal = 0;
  for (const r of rows) {
    if (r.type === 'INCOME') incomeTotal += Number(r.amount);
    else expenseTotal += Number(r.amount);
  }
  return {
    balance: incomeTotal - expenseTotal,
    incomeTotal,
    expenseTotal,
    count: rows.length,
  };
}

export type TransactionDetail = {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  occurred_at: string;
  source: string;
  department: string;
  category_name: string | null;
  item_name: string | null;
  description: string | null;
  order_id: string | null;
  employee_name: string | null;
  created_by_name: string | null;
  reverses_transaction_id: string | null;
  hasAttachment: boolean;
};

export async function getTransactionDetail(id: string): Promise<TransactionDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('financial_transactions')
    .select('id, type, amount, occurred_at, source, department, item_name, description, order_id, reverses_transaction_id, category:financial_categories(name), employee:employees(full_name), creator:profiles!created_by(full_name)')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const d = data as Record<string, unknown>;
  const { data: att } = await supabase
    .from('financial_attachments')
    .select('id')
    .eq('transaction_id', id)
    .limit(1);
  return {
    id: String(d.id),
    type: d.type as 'INCOME' | 'EXPENSE',
    amount: Number(d.amount),
    occurred_at: String(d.occurred_at),
    source: String(d.source),
    department: String(d.department),
    category_name: (d.category as { name?: string } | null)?.name ?? null,
    item_name: (d.item_name as string) ?? null,
    description: (d.description as string) ?? null,
    order_id: (d.order_id as string) ?? null,
    employee_name: (d.employee as { full_name?: string } | null)?.full_name ?? null,
    created_by_name: (d.creator as { full_name?: string } | null)?.full_name ?? null,
    reverses_transaction_id: (d.reverses_transaction_id as string) ?? null,
    hasAttachment: (att ?? []).length > 0,
  };
}
