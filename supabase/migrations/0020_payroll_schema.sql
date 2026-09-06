-- 0020 — Payroll architecture: employees, rates, periods, records, advances,
--        piece work. Nahla Cake Panel — Finance expansion Phase 10.

-- ---------------------------------------------------------------------------
-- Employees
-- ---------------------------------------------------------------------------
create table public.employees (
  id             uuid primary key default gen_random_uuid(),
  code           text unique,
  full_name      text not null,
  phone          text,
  job            text,
  department     text not null default 'LABORATORY',
  payment_method text not null check (payment_method in ('PIECE_BASED', 'DAILY', 'WEEKLY', 'MONTHLY')),
  is_active      boolean not null default true,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_employees_active on public.employees(is_active);
create trigger trg_employees_updated
  before update on public.employees
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rates (flexible: employee/job × work_category × product_size × effective date)
-- product_size is a free-text label (e.g. "20 CM").
-- ---------------------------------------------------------------------------
create table public.payroll_rates (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid references public.employees(id) on delete cascade,
  job            text,
  work_category  text,
  product_size   text,
  rate           numeric(12,2) not null check (rate >= 0),
  rate_kind      text not null check (rate_kind in ('PIECE', 'DAILY', 'WEEKLY', 'MONTHLY')),
  effective_from date not null default now(),
  is_active      boolean not null default true,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);
create index idx_payroll_rates_emp on public.payroll_rates(employee_id);

-- ---------------------------------------------------------------------------
-- Payroll periods
-- ---------------------------------------------------------------------------
create table public.payroll_periods (
  id          uuid primary key default gen_random_uuid(),
  period_type text not null check (period_type in ('DAILY', 'WEEKLY', 'MONTHLY')),
  start_date  date not null,
  end_date    date not null,
  label       text,
  created_at  timestamptz not null default now(),
  unique (period_type, start_date, end_date)
);

-- ---------------------------------------------------------------------------
-- Payroll records (one per employee per period; state machine)
-- ---------------------------------------------------------------------------
create table public.payroll_records (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees(id) on delete cascade,
  period_id      uuid not null references public.payroll_periods(id) on delete cascade,
  payment_method text not null,
  gross_amount   numeric(12,2) not null default 0,
  advances_total numeric(12,2) not null default 0,
  adjustments    numeric(12,2) not null default 0,
  paid_amount    numeric(12,2) not null default 0,
  remaining      numeric(12,2) generated always as
                   (gross_amount + adjustments - advances_total - paid_amount) stored,
  status         text not null default 'DRAFT'
                   check (status in ('DRAFT', 'CALCULATED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (employee_id, period_id)
);
create index idx_payroll_records_emp on public.payroll_records(employee_id);
create trigger trg_payroll_records_updated
  before update on public.payroll_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Advances (never overwritten; multiple per period)
-- ---------------------------------------------------------------------------
create table public.payroll_advances (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees(id) on delete cascade,
  amount            numeric(12,2) not null check (amount > 0),
  advance_date      date not null default now(),
  payroll_record_id uuid references public.payroll_records(id) on delete set null,
  transaction_id    uuid references public.financial_transactions(id),
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);
create index idx_payroll_advances_emp on public.payroll_advances(employee_id);

-- ---------------------------------------------------------------------------
-- Piece work records (store inputs, not just totals)
-- ---------------------------------------------------------------------------
create table public.piece_work_records (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees(id) on delete cascade,
  work_date         date not null,
  order_id          uuid references public.orders(id),
  work_category     text,
  product_size      text,
  quantity          numeric(12,3) not null check (quantity > 0),
  applied_rate      numeric(12,2) not null check (applied_rate >= 0),
  amount            numeric(12,2) generated always as (round(quantity * applied_rate, 2)) stored,
  payroll_record_id uuid references public.payroll_records(id) on delete set null,
  entered_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);
create index idx_piece_work_emp on public.piece_work_records(employee_id);
create index idx_piece_work_date on public.piece_work_records(work_date);

-- ---------------------------------------------------------------------------
-- Ledger link columns (now that the tables exist)
-- ---------------------------------------------------------------------------
alter table public.financial_transactions
  add column if not exists employee_id       uuid references public.employees(id),
  add column if not exists payroll_record_id uuid references public.payroll_records(id),
  add column if not exists payroll_advance_id uuid references public.payroll_advances(id);
create index if not exists idx_fin_tx_employee on public.financial_transactions(employee_id);
create index if not exists idx_fin_tx_payroll_record on public.financial_transactions(payroll_record_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.employees          enable row level security;
alter table public.payroll_rates      enable row level security;
alter table public.payroll_periods    enable row level security;
alter table public.payroll_records    enable row level security;
alter table public.payroll_advances   enable row level security;
alter table public.piece_work_records enable row level security;

create policy "employees_select" on public.employees for select to authenticated
  using (public.has_permission('employees.view') or public.has_permission('payroll.view'));
create policy "employees_write" on public.employees for all to authenticated
  using (public.has_permission('employees.manage')) with check (public.has_permission('employees.manage'));

create policy "payroll_rates_select" on public.payroll_rates for select to authenticated
  using (public.has_permission('payroll.view'));
create policy "payroll_rates_write" on public.payroll_rates for all to authenticated
  using (public.has_permission('payroll.manage')) with check (public.has_permission('payroll.manage'));

create policy "payroll_periods_select" on public.payroll_periods for select to authenticated
  using (public.has_permission('payroll.view'));
create policy "payroll_periods_write" on public.payroll_periods for all to authenticated
  using (public.has_permission('payroll.manage')) with check (public.has_permission('payroll.manage'));

create policy "payroll_records_select" on public.payroll_records for select to authenticated
  using (public.has_permission('payroll.view'));
create policy "payroll_records_write" on public.payroll_records for all to authenticated
  using (public.has_permission('payroll.manage')) with check (public.has_permission('payroll.manage'));

create policy "payroll_advances_select" on public.payroll_advances for select to authenticated
  using (public.has_permission('payroll.view'));
-- advances/payments are written through SECURITY DEFINER functions in later phases

create policy "piece_work_select" on public.piece_work_records for select to authenticated
  using (public.has_permission('payroll.view'));
create policy "piece_work_write" on public.piece_work_records for all to authenticated
  using (public.has_permission('payroll.manage')) with check (public.has_permission('payroll.manage'));
