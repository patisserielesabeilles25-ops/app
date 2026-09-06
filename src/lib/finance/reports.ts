import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getRange, getCustomRange, type Range, type PeriodPreset } from '@/lib/reports/period';

export type Summary = {
  income: number;
  expense: number;
  net: number;
  income_count: number;
  expense_count: number;
};
export type CategoryRow = { category_id: string | null; category_key: string; category_name: string; income: number; expense: number };
export type DepartmentRow = { department: string; income: number; expense: number; net: number };
export type SourceRow = { source: string; income: number; expense: number; net: number };

const n = (v: unknown) => Number(v ?? 0);

type SB = Awaited<ReturnType<typeof createClient>>;

export async function financeBalance(supabase: SB): Promise<number> {
  const { data } = await supabase.rpc('finance_balance');
  return n(data);
}

export async function financeSummary(supabase: SB, r: Range): Promise<Summary> {
  const { data } = await supabase.rpc('finance_summary', { p_from: r.from, p_to: r.to });
  const row = Array.isArray(data) ? data[0] : data;
  return {
    income: n(row?.income),
    expense: n(row?.expense),
    net: n(row?.net),
    income_count: n(row?.income_count),
    expense_count: n(row?.expense_count),
  };
}

export async function financeByCategory(supabase: SB, r: Range): Promise<CategoryRow[]> {
  const { data } = await supabase.rpc('finance_by_category', { p_from: r.from, p_to: r.to });
  return (data ?? []).map((d: CategoryRow) => ({
    category_id: d.category_id ?? null,
    category_key: d.category_key,
    category_name: d.category_name,
    income: n(d.income),
    expense: n(d.expense),
  }));
}

export async function financeByDepartment(supabase: SB, r: Range): Promise<DepartmentRow[]> {
  const { data } = await supabase.rpc('finance_by_department', { p_from: r.from, p_to: r.to });
  return (data ?? []).map((d: DepartmentRow) => ({
    department: d.department,
    income: n(d.income),
    expense: n(d.expense),
    net: n(d.net),
  }));
}

export async function financeBySource(supabase: SB, r: Range): Promise<SourceRow[]> {
  const { data } = await supabase.rpc('finance_by_source', { p_from: r.from, p_to: r.to });
  return (data ?? []).map((d: SourceRow) => ({
    source: d.source,
    income: n(d.income),
    expense: n(d.expense),
    net: n(d.net),
  }));
}

export type FinanceOverview = {
  balance: number;
  today: Summary;
  week: Summary;
  month: Summary;
  year: Summary;
  monthCategories: CategoryRow[];
  monthDepartments: DepartmentRow[];
};

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const supabase = await createClient();
  const monthRange = getRange('month');
  const [balance, today, week, month, year, monthCategories, monthDepartments] = await Promise.all([
    financeBalance(supabase),
    financeSummary(supabase, getRange('today')),
    financeSummary(supabase, getRange('week')),
    financeSummary(supabase, monthRange),
    financeSummary(supabase, getRange('year')),
    financeByCategory(supabase, monthRange),
    financeByDepartment(supabase, monthRange),
  ]);
  return { balance, today, week, month, year, monthCategories, monthDepartments };
}

export { getRange, getCustomRange };
export type { Range, PeriodPreset };
