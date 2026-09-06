import 'server-only';

import { createClient } from '@/lib/supabase/server';

export type Employee = {
  id: string;
  code: string | null;
  full_name: string;
  phone: string | null;
  job: string | null;
  department: string;
  payment_method: 'PIECE_BASED' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  is_active: boolean;
};

export type UserRemuneration = {
  employeeId: string;
  paymentMethod: 'PIECE_BASED' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  amount: number;
};

/** The payroll employee (method + current active rate) linked to a user, if any. */
export async function getUserRemuneration(profileId: string): Promise<UserRemuneration | null> {
  const supabase = await createClient();
  const { data: emp } = await supabase
    .from('employees')
    .select('id, payment_method')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (!emp) return null;

  const { data: rate } = await supabase
    .from('payroll_rates')
    .select('rate')
    .eq('employee_id', emp.id)
    .eq('is_active', true)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    employeeId: emp.id as string,
    paymentMethod: emp.payment_method as UserRemuneration['paymentMethod'],
    amount: rate ? Number(rate.rate) : 0,
  };
}

export type Rate = {
  id: string;
  employee_id: string | null;
  employee_name: string | null;
  job: string | null;
  work_category: string | null;
  product_size: string | null;
  rate: number;
  rate_kind: string;
  effective_from: string;
  is_active: boolean;
};

export async function getEmployees(): Promise<Employee[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('employees')
    .select('id, code, full_name, phone, job, department, payment_method, is_active')
    .order('full_name');
  return (data ?? []) as Employee[];
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('employees')
    .select('id, code, full_name, phone, job, department, payment_method, is_active')
    .eq('id', id)
    .maybeSingle();
  return (data as Employee) ?? null;
}

export type WorkRecord = {
  id: string;
  work_date: string;
  work_category: string | null;
  product_size: string | null;
  quantity: number;
  applied_rate: number;
  amount: number;
  paid: boolean;
};

export async function getPieceWork(
  employeeId: string,
): Promise<{ records: WorkRecord[]; unpaidTotal: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('piece_work_records')
    .select('id, work_date, work_category, product_size, quantity, applied_rate, amount, payroll_record_id')
    .eq('employee_id', employeeId)
    .order('work_date', { ascending: false })
    .limit(200);
  const records = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    work_date: String(r.work_date),
    work_category: (r.work_category as string) ?? null,
    product_size: (r.product_size as string) ?? null,
    quantity: Number(r.quantity),
    applied_rate: Number(r.applied_rate),
    amount: Number(r.amount),
    paid: r.payroll_record_id != null,
  }));
  const unpaidTotal = records.filter((r) => !r.paid).reduce((s, r) => s + r.amount, 0);
  return { records, unpaidTotal };
}

export async function getRates(): Promise<Rate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payroll_rates')
    .select('id, employee_id, job, work_category, product_size, rate, rate_kind, effective_from, is_active, employees(full_name)')
    .order('created_at', { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    employee_id: (r.employee_id as string) ?? null,
    employee_name: (r.employees as { full_name?: string } | null)?.full_name ?? null,
    job: (r.job as string) ?? null,
    work_category: (r.work_category as string) ?? null,
    product_size: (r.product_size as string) ?? null,
    rate: Number(r.rate),
    rate_kind: String(r.rate_kind),
    effective_from: String(r.effective_from),
    is_active: Boolean(r.is_active),
  }));
}

export type PayrollPeriod = {
  id: string;
  period_type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  start_date: string;
  end_date: string;
  label: string | null;
};

export type PayrollRecord = {
  id: string;
  employee_id: string;
  gross_amount: number;
  advances_total: number;
  paid_amount: number;
  remaining: number;
  status: string;
  payment_method: string;
};

export async function getPeriods(): Promise<PayrollPeriod[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payroll_periods')
    .select('id, period_type, start_date, end_date, label')
    .order('start_date', { ascending: false })
    .limit(100);
  return (data ?? []) as PayrollPeriod[];
}

export async function getPeriod(id: string): Promise<PayrollPeriod | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payroll_periods')
    .select('id, period_type, start_date, end_date, label')
    .eq('id', id)
    .maybeSingle();
  return (data as PayrollPeriod) ?? null;
}

export async function getPeriodRecords(
  periodId: string,
): Promise<{ employee: Employee; record: PayrollRecord | null }[]> {
  const supabase = await createClient();
  const employees = await getEmployees();
  const { data: recs } = await supabase
    .from('payroll_records')
    .select('id, employee_id, gross_amount, advances_total, paid_amount, remaining, status, payment_method')
    .eq('period_id', periodId);
  const byEmp = new Map<string, PayrollRecord>();
  for (const r of (recs ?? []) as Record<string, unknown>[]) {
    byEmp.set(String(r.employee_id), {
      id: String(r.id),
      employee_id: String(r.employee_id),
      gross_amount: Number(r.gross_amount),
      advances_total: Number(r.advances_total),
      paid_amount: Number(r.paid_amount),
      remaining: Number(r.remaining),
      status: String(r.status),
      payment_method: String(r.payment_method),
    });
  }
  return employees
    .filter((e) => e.is_active)
    .map((e) => ({ employee: e, record: byEmp.get(e.id) ?? null }));
}

export type Advance = { id: string; amount: number; advance_date: string };

export async function getAdvances(
  employeeId: string,
): Promise<{ advances: Advance[]; total: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payroll_advances')
    .select('id, amount, advance_date')
    .eq('employee_id', employeeId)
    .order('advance_date', { ascending: false })
    .limit(100);
  const advances = ((data ?? []) as Record<string, unknown>[]).map((a) => ({
    id: String(a.id),
    amount: Number(a.amount),
    advance_date: String(a.advance_date),
  }));
  return { advances, total: advances.reduce((s, a) => s + a.amount, 0) };
}
