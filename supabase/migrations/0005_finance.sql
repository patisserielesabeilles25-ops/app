-- 0005 — Finance: order financials (split for data-layer protection) + ledger
-- Nahla Cake Panel
--
-- DESIGN NOTE: financial amounts for an order live here, NOT on public.orders,
-- so RLS can deny them to operational/lab users (all signed-in users share the
-- `authenticated` role, so per-column RLS on `orders` is not possible).

-- ---------------------------------------------------------------------------
-- Per-order financial amounts (1:1 with orders)
-- ---------------------------------------------------------------------------
create table public.order_financials (
  order_id         uuid primary key references public.orders(id) on delete cascade,
  total_amount     numeric(12,2) not null default 0 check (total_amount >= 0),
  advance_payment  numeric(12,2) not null default 0 check (advance_payment >= 0),
  delivery_amount  numeric(12,2) not null default 0 check (delivery_amount >= 0),
  remaining_amount numeric(12,2) generated always as (total_amount - advance_payment) stored,
  created_by       uuid references public.profiles(id),
  updated_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint advance_not_over_total check (advance_payment <= total_amount)
);
create trigger trg_order_financials_updated
  before update on public.order_financials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Append-only financial ledger. Balance is derived, never stored mutably.
-- ---------------------------------------------------------------------------
create table public.financial_transactions (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('INCOME', 'EXPENSE')),
  category    text not null,           -- ORDER_ADVANCE | ORDER_FINAL | PURCHASE | SERVICE | OTHER ...
  amount      numeric(12,2) not null check (amount > 0),  -- sign implied by `type`
  occurred_at timestamptz not null default now(),
  order_id    uuid references public.orders(id),
  item_name   text,
  description text,
  reverses_transaction_id uuid references public.financial_transactions(id),
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index idx_fin_tx_occurred on public.financial_transactions(occurred_at);
create index idx_fin_tx_type     on public.financial_transactions(type);
create index idx_fin_tx_category on public.financial_transactions(category);
create index idx_fin_tx_order    on public.financial_transactions(order_id);

-- ---------------------------------------------------------------------------
-- Sensitive attachments (receipts / invoices). Metadata only.
-- ---------------------------------------------------------------------------
create table public.financial_attachments (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.financial_transactions(id) on delete restrict,
  bucket         text not null default 'finance-attachments',
  object_path    text not null,
  mime_type      text,
  size_bytes     int,
  uploaded_by    uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);
create index idx_fin_att_tx on public.financial_attachments(transaction_id);

-- ---------------------------------------------------------------------------
-- Derived balance — guarded function (raises for non-finance users).
-- ---------------------------------------------------------------------------
create or replace function public.current_balance()
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('finance.transactions.view') then
    raise exception 'forbidden: finance.transactions.view required';
  end if;

  return (
    select coalesce(sum(case when type = 'INCOME' then amount else -amount end), 0)
    from public.financial_transactions
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.order_financials        enable row level security;
alter table public.financial_transactions  enable row level security;
alter table public.financial_attachments   enable row level security;

-- order_financials: only finance users may READ; order creators/editors may WRITE
-- (so amounts can be captured at order creation) but cannot read back without finance perms.
create policy "order_financials_select" on public.order_financials
  for select to authenticated
  using (public.has_permission('finance.view') or public.has_permission('finance.transactions.view'));
create policy "order_financials_insert" on public.order_financials
  for insert to authenticated
  with check (public.has_permission('orders.create') or public.has_permission('finance.view'));
create policy "order_financials_update" on public.order_financials
  for update to authenticated
  using (public.has_permission('orders.edit') or public.has_permission('finance.view'))
  with check (public.has_permission('orders.edit') or public.has_permission('finance.view'));

-- financial_transactions: append-only. No UPDATE/DELETE policies => denied for all
-- (corrections are reversing rows inserted via server actions / service role).
create policy "fin_tx_select" on public.financial_transactions
  for select to authenticated
  using (public.has_permission('finance.transactions.view'));
create policy "fin_tx_insert" on public.financial_transactions
  for insert to authenticated
  with check (
    public.has_permission('finance.income.create')
    or public.has_permission('finance.expense.create')
  );

-- financial_attachments: strictly finance-gated.
create policy "fin_att_select" on public.financial_attachments
  for select to authenticated
  using (public.has_permission('finance.attachments.view'));
create policy "fin_att_insert" on public.financial_attachments
  for insert to authenticated
  with check (
    public.has_permission('finance.income.create')
    or public.has_permission('finance.expense.create')
  );
