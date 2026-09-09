import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { PIECE_RATES } from '@/lib/production/rates';

export type SalaryPayment = { id: string; amount: number; date: string; note: string | null };
export type PayInfo = {
  /** The user (profile) being paid. The backing employee is resolved at pay time. */
  profileId: string;
  employeeId: string | null;
  name: string;
  method: 'PIECE_BASED' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  periodLabel: string;
  gains: number;
  /** Money already given this cycle (Magasin payroll expenses + salary payments). */
  advance: number;
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

  // Every active user is payable, whether or not they have an employee row yet.
  const { data: profs } = await service
    .from('profiles')
    .select('id, full_name')
    .eq('is_active', true);
  const profiles = profs ?? [];
  if (profiles.length === 0) return new Map();
  const profileIds = profiles.map((p) => p.id as string);

  const { data: emps } = await service
    .from('employees')
    .select('id, profile_id, payment_method, last_settled_at')
    .in('profile_id', profileIds);
  const employees = emps ?? [];
  const empByProfile = new Map<string, (typeof employees)[number]>();
  for (const e of employees) empByProfile.set(e.profile_id as string, e);

  const empIds = employees.map((e) => e.id as string);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEndYmd = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  // Weeks that touch this month can start up to 6 days before it.
  const logsFrom = ymd(new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() - 6));

  const pieceProfileIds = employees
    .filter((e) => e.payment_method === 'PIECE_BASED')
    .map((e) => e.profile_id as string);

  const [{ data: rates }, { data: txns }, { data: logs }] = await Promise.all([
    service.from('payroll_rates').select('employee_id, rate, rate_kind, is_active').in('employee_id', empIds).eq('is_active', true),
    // Payroll money given to the worker: Magasin "Employee payroll" expenses
    // (PAYROLL) and salary settlements (PAYROLL_SALARY).
    service.from('financial_transactions').select('id, employee_id, amount, occurred_at, description, category').in('employee_id', empIds).in('category', ['PAYROLL', 'PAYROLL_SALARY']).order('occurred_at', { ascending: false }),
    pieceProfileIds.length > 0
      ? service.from('production_logs').select('profile_id, week_start, sheet, row_key, day, qty').in('profile_id', pieceProfileIds).gte('week_start', logsFrom).lt('week_start', monthEndYmd)
      : Promise.resolve({ data: [] as { profile_id: string; week_start: string; sheet: 'MASQUAGE' | 'PREPARATION'; row_key: string; day: number; qty: number }[] }),
  ]);

  // Production Sheet entries per profile, with their real calendar date (ms).
  const sheetEntriesByProfile = new Map<string, { t: number; amt: number }[]>();
  for (const r of logs ?? []) {
    const d = new Date(`${r.week_start}T00:00:00`);
    d.setDate(d.getDate() + Number(r.day));
    const rate = PIECE_RATES[r.sheet as 'MASQUAGE' | 'PREPARATION']?.[r.row_key] ?? 0;
    const key = r.profile_id as string;
    const list = sheetEntriesByProfile.get(key) ?? [];
    list.push({ t: d.getTime(), amt: num(r.qty) * rate });
    sheetEntriesByProfile.set(key, list);
  }

  // Latest active rate per employee by kind.
  const rateByEmp = new Map<string, Map<string, number>>();
  for (const r of rates ?? []) {
    const e = r.employee_id as string;
    const m = rateByEmp.get(e) ?? new Map<string, number>();
    m.set(r.rate_kind as string, num(r.rate));
    rateByEmp.set(e, m);
  }

  const map = new Map<string, PayInfo>();
  for (const p of profiles) {
    const profileId = p.id as string;
    const name = (p.full_name as string)?.trim() || 'Employé';
    const emp = empByProfile.get(profileId);

    // No employee yet → payable with a manual amount; nothing has accrued.
    if (!emp) {
      map.set(profileId, {
        profileId,
        employeeId: null,
        name,
        method: 'MONTHLY',
        periodLabel: periodStart('MONTHLY').label,
        gains: 0,
        advance: 0,
        remaining: 0,
        history: [],
      });
      continue;
    }

    const id = emp.id as string;
    const method = emp.payment_method as PayInfo['method'];
    const { start: pStart, label } = periodStart(method);
    const kind = method === 'PIECE_BASED' ? 'PIECE' : method;

    const settledAt = emp.last_settled_at ? new Date(emp.last_settled_at as string) : null;
    const settledThisPeriod = settledAt !== null && settledAt >= pStart;
    // Everything from here on counts toward the current (open) cycle.
    const cycleStart = settledThisPeriod ? (settledAt as Date) : pStart;

    // Gains for the open cycle.
    let gains: number;
    if (method === 'PIECE_BASED') {
      gains = (sheetEntriesByProfile.get(profileId) ?? [])
        .filter((x) => x.t >= cycleStart.getTime())
        .reduce((s, x) => s + x.amt, 0);
    } else {
      // Fixed-rate wage: owed once per period, cleared once settled in it.
      gains = settledThisPeriod ? 0 : (rateByEmp.get(id)?.get(kind) ?? 0);
    }

    // Money given this cycle + settlement-payment history (for receipts).
    const empTx = (txns ?? []).filter((t) => t.employee_id === id);
    const advance = empTx
      .filter((t) => new Date(t.occurred_at as string) >= cycleStart)
      .reduce((s, t) => s + num(t.amount), 0);
    const history: SalaryPayment[] = empTx
      .filter((t) => t.category === 'PAYROLL_SALARY')
      .slice(0, 12)
      .map((t) => ({
        id: t.id as string,
        amount: num(t.amount),
        date: (t.occurred_at as string).slice(0, 10),
        note: (t.description as string) ?? null,
      }));

    map.set(profileId, {
      profileId,
      employeeId: id,
      name,
      method,
      periodLabel: label,
      gains,
      advance,
      remaining: gains - advance,
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
