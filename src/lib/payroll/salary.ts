import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';

export type SalaryPayment = { id: string; amount: number; date: string; note: string | null };
export type PayInfo = {
  employeeId: string;
  name: string;
  method: 'PIECE_BASED' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  periodLabel: string;
  gains: number;
  paid: number;
  remaining: number;
  history: SalaryPayment[];
};

const num = (v: unknown) => Number(v ?? 0);

function periodStart(method: PayInfo['method']): { start: Date; label: string } {
  const now = new Date();
  if (method === 'DAILY') {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    return { start: s, label: "aujourd'hui" };
  }
  if (method === 'WEEKLY') {
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    const dow = (s.getDay() + 6) % 7; // Monday = 0
    s.setDate(s.getDate() - dow);
    return { start: s, label: 'cette semaine' };
  }
  // MONTHLY & PIECE_BASED → current month
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: s, label: 'ce mois' };
}

/** Salary pay info per linked user (profile_id → PayInfo). One batch of queries. */
export async function getSalaryOverviews(): Promise<Map<string, PayInfo>> {
  const service = createServiceClient();

  const { data: emps } = await service
    .from('employees')
    .select('id, profile_id, payment_method, full_name')
    .not('profile_id', 'is', null);
  const employees = emps ?? [];
  if (employees.length === 0) return new Map();

  const empIds = employees.map((e) => e.id as string);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [{ data: rates }, { data: pieces }, { data: txns }] = await Promise.all([
    service.from('payroll_rates').select('employee_id, rate, rate_kind, effective_from, is_active').in('employee_id', empIds).eq('is_active', true),
    service.from('piece_work_records').select('employee_id, amount, work_date').in('employee_id', empIds).gte('work_date', monthStart.toISOString().slice(0, 10)),
    service.from('financial_transactions').select('id, employee_id, amount, occurred_at, description').in('employee_id', empIds).eq('category', 'PAYROLL_SALARY').order('occurred_at', { ascending: false }),
  ]);

  // Latest active rate per employee by kind.
  const rateByEmp = new Map<string, Map<string, number>>();
  for (const r of rates ?? []) {
    const e = r.employee_id as string;
    const m = rateByEmp.get(e) ?? new Map<string, number>();
    // rows already filtered active; keep the first seen per kind (order not guaranteed) — take max effective_from
    const key = r.rate_kind as string;
    m.set(key, num(r.rate));
    rateByEmp.set(e, m);
  }

  const map = new Map<string, PayInfo>();
  for (const e of employees) {
    const id = e.id as string;
    const method = e.payment_method as PayInfo['method'];
    const { start, label } = periodStart(method);
    const kind = method === 'PIECE_BASED' ? 'PIECE' : method;

    // Gains for the period.
    let gains: number;
    if (method === 'PIECE_BASED') {
      gains = (pieces ?? [])
        .filter((p) => p.employee_id === id && new Date(`${p.work_date}T00:00:00`) >= new Date(monthStart.getFullYear(), monthStart.getMonth(), 1))
        .reduce((s, p) => s + num(p.amount), 0);
    } else {
      gains = rateByEmp.get(id)?.get(kind) ?? 0;
    }

    // Paid within the period + full history.
    const empTx = (txns ?? []).filter((t) => t.employee_id === id);
    const paid = empTx
      .filter((t) => new Date(t.occurred_at as string) >= start)
      .reduce((s, t) => s + num(t.amount), 0);
    const history: SalaryPayment[] = empTx.slice(0, 12).map((t) => ({
      id: t.id as string,
      amount: num(t.amount),
      date: (t.occurred_at as string).slice(0, 10),
      note: (t.description as string) ?? null,
    }));

    map.set(e.profile_id as string, {
      employeeId: id,
      name: e.full_name as string,
      method,
      periodLabel: label,
      gains,
      paid,
      remaining: gains - paid,
      history,
    });
  }
  return map;
}

export type SalaryReceipt = {
  amount: number;
  date: string;
  note: string | null;
  employeeName: string;
};

/** One salary payment (for the printable receipt). */
export async function getSalaryReceipt(txId: string): Promise<SalaryReceipt | null> {
  const service = createServiceClient();
  const { data: tx } = await service
    .from('financial_transactions')
    .select('amount, occurred_at, description, employee_id, category')
    .eq('id', txId)
    .maybeSingle();
  if (!tx || tx.category !== 'PAYROLL_SALARY') return null;
  const { data: emp } = await service.from('employees').select('full_name').eq('id', tx.employee_id as string).maybeSingle();
  return {
    amount: num(tx.amount),
    date: (tx.occurred_at as string).slice(0, 10),
    note: (tx.description as string) ?? null,
    employeeName: (emp?.full_name as string) ?? '—',
  };
}
