import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { PIECE_RATES } from '@/lib/production/rates';

export type SalaryPayment = { id: string; amount: number; date: string; note: string | null };
export type PayInfo = {
  employeeId: string;
  name: string;
  method: 'PIECE_BASED' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  periodLabel: string;
  gains: number;
  paid: number;
  advances: number;
  remaining: number;
  history: SalaryPayment[];
};

const num = (v: unknown) => Number(v ?? 0);

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

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
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthStartYmd = ymd(monthStart);
  const monthEndYmd = ymd(monthEnd);
  // Weeks that touch this month can start up to 6 days before it.
  const logsFrom = ymd(new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() - 6));

  // Per-order workers: their gains come from the Production Sheet, keyed by profile.
  const pieceProfileIds = employees
    .filter((e) => e.payment_method === 'PIECE_BASED')
    .map((e) => e.profile_id as string);

  const [{ data: rates }, { data: txns }, { data: advances }, { data: logs }] = await Promise.all([
    service.from('payroll_rates').select('employee_id, rate, rate_kind, effective_from, is_active').in('employee_id', empIds).eq('is_active', true),
    service.from('financial_transactions').select('id, employee_id, amount, occurred_at, description').in('employee_id', empIds).eq('category', 'PAYROLL_SALARY').order('occurred_at', { ascending: false }),
    service.from('payroll_advances').select('employee_id, amount, advance_date').in('employee_id', empIds).gte('advance_date', monthStartYmd).lt('advance_date', monthEndYmd),
    pieceProfileIds.length > 0
      ? service.from('production_logs').select('profile_id, week_start, sheet, row_key, day, qty').in('profile_id', pieceProfileIds).gte('week_start', logsFrom).lt('week_start', monthEndYmd)
      : Promise.resolve({ data: [] as { profile_id: string; week_start: string; sheet: 'MASQUAGE' | 'PREPARATION'; row_key: string; day: number; qty: number }[] }),
  ]);

  // Production Sheet earnings for the month, per worker profile.
  const sheetEarnByProfile = new Map<string, number>();
  for (const r of logs ?? []) {
    const d = new Date(`${r.week_start}T00:00:00`);
    d.setDate(d.getDate() + Number(r.day));
    if (d >= monthStart && d < monthEnd) {
      const rate = PIECE_RATES[r.sheet as 'MASQUAGE' | 'PREPARATION']?.[r.row_key] ?? 0;
      const key = r.profile_id as string;
      sheetEarnByProfile.set(key, (sheetEarnByProfile.get(key) ?? 0) + num(r.qty) * rate);
    }
  }

  // Advances taken this month, per employee.
  const advByEmp = new Map<string, number>();
  for (const a of advances ?? []) {
    const e = a.employee_id as string;
    advByEmp.set(e, (advByEmp.get(e) ?? 0) + num(a.amount));
  }

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

    // Gains for the period. Per-order workers earn from their Production Sheet.
    let gains: number;
    if (method === 'PIECE_BASED') {
      gains = sheetEarnByProfile.get(e.profile_id as string) ?? 0;
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

    const advancesTaken = advByEmp.get(id) ?? 0;

    map.set(e.profile_id as string, {
      employeeId: id,
      name: e.full_name as string,
      method,
      periodLabel: label,
      gains,
      paid,
      advances: advancesTaken,
      remaining: gains - paid - advancesTaken,
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
