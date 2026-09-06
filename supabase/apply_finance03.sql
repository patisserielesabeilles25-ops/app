-- ============================================================
-- Nahla Cake Panel — Finance Phase 3 (ledger extension:
-- classification columns + backfill + finance_balance +
-- opening balance + post_transaction + reverse_transaction).
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================

-- 0015 — Central ledger extension: classification, balance, opening balance,
--        atomic post + reverse. Nahla Cake Panel — Finance expansion Phase 3.
--
-- financial_transactions stays append-only. Link columns to employees /
-- magasin_sales / payroll_* are added in their own later migrations (the tables
-- don't exist yet). Here we add classification + generic posting/reversal.

-- ---------------------------------------------------------------------------
-- New classification columns
-- ---------------------------------------------------------------------------
alter table public.financial_transactions
  add column if not exists department  text not null default 'GENERAL',
  add column if not exists source       text not null default 'OTHER',
  add column if not exists category_id  uuid references public.financial_categories(id),
  add column if not exists notes        text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fin_tx_source_chk'
  ) then
    alter table public.financial_transactions
      add constraint fin_tx_source_chk check (source in (
        'ORDER','MAGASIN','PAYROLL','PURCHASE','MACHINE','DELIVERY',
        'INVESTMENT','OPENING_BALANCE','REVERSAL','OTHER'
      ));
  end if;
end $$;

create index if not exists idx_fin_tx_category_id on public.financial_transactions(category_id);
create index if not exists idx_fin_tx_department  on public.financial_transactions(department);
create index if not exists idx_fin_tx_source      on public.financial_transactions(source);

-- Only ONE opening-balance row ever.
create unique index if not exists uq_fin_tx_opening_balance
  on public.financial_transactions ((source)) where source = 'OPENING_BALANCE';

-- ---------------------------------------------------------------------------
-- Backfill existing rows from the legacy `category` text
-- ---------------------------------------------------------------------------
update public.financial_transactions t set
  source = 'ORDER', department = 'SHOP',
  category_id = (select id from public.financial_categories where key = 'ORDER_PAYMENT')
where t.category in ('ORDER_ADVANCE', 'ORDER_FINAL');

update public.financial_transactions t set
  source = 'PURCHASE', department = 'SHOP',
  category_id = (select id from public.financial_categories where key = 'GOODS')
where t.category = 'PURCHASE';

update public.financial_transactions t set
  category_id = (select id from public.financial_categories where key = 'OTHER')
where t.category_id is null and t.type = 'EXPENSE';

update public.financial_transactions t set
  category_id = (select id from public.financial_categories where key = 'OTHER_INCOME')
where t.category_id is null and t.type = 'INCOME' and t.source <> 'OPENING_BALANCE';

-- ---------------------------------------------------------------------------
-- Derived balance (guarded)
-- ---------------------------------------------------------------------------
create or replace function public.finance_balance()
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
-- Opening balance: single dedicated event. 0 clears it (removes the row).
-- ---------------------------------------------------------------------------
create or replace function public.set_opening_balance(p_amount numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null or not public.has_permission('finance.categories.manage') then
    raise exception 'forbidden: finance.categories.manage required';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'opening balance cannot be negative';
  end if;

  select id into v_id from public.financial_transactions where source = 'OPENING_BALANCE';

  if p_amount = 0 then
    if v_id is not null then delete from public.financial_transactions where id = v_id; end if;
  elsif v_id is null then
    insert into public.financial_transactions
      (type, category, amount, occurred_at, source, department, description, created_by)
    values
      ('INCOME', 'OPENING_BALANCE', p_amount, now(), 'OPENING_BALANCE', 'GENERAL', 'Opening balance', v_uid);
  else
    update public.financial_transactions set amount = p_amount where id = v_id;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, metadata)
  values (v_uid, 'finance.opening_balance.set', 'financial_transaction', jsonb_build_object('amount', p_amount));
end;
$$;

-- ---------------------------------------------------------------------------
-- Generic atomic posting (income/expense with full classification + attachment)
-- ---------------------------------------------------------------------------
create or replace function public.post_transaction(
  p_type        text,
  p_amount      numeric,
  p_category_id uuid,
  p_department  text,
  p_source      text,
  p_occurred_at timestamptz,
  p_description text,
  p_order_id    uuid default null,
  p_notes       text default null,
  p_image_path  text default null,
  p_image_mime  text default null,
  p_image_size  int  default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tx  uuid;
  v_key text;
begin
  if v_uid is null then raise exception 'forbidden'; end if;
  if p_type not in ('INCOME', 'EXPENSE') then raise exception 'invalid type: %', p_type; end if;
  if p_type = 'INCOME' and not public.has_permission('finance.income.create') then
    raise exception 'forbidden: finance.income.create required';
  end if;
  if p_type = 'EXPENSE' and not public.has_permission('finance.expense.create') then
    raise exception 'forbidden: finance.expense.create required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select key into v_key from public.financial_categories where id = p_category_id;

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, order_id, description, notes, created_by)
  values
    (p_type, coalesce(v_key, 'OTHER'), p_amount, coalesce(p_occurred_at, now()),
     coalesce(p_source, 'OTHER'), coalesce(p_department, 'GENERAL'), p_category_id, p_order_id,
     p_description, p_notes, v_uid)
  returning id into v_tx;

  if p_image_path is not null then
    insert into public.financial_attachments (transaction_id, bucket, object_path, mime_type, size_bytes, uploaded_by)
    values (v_tx, 'finance-attachments', p_image_path, p_image_mime, p_image_size, v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.transaction.create', 'financial_transaction', v_tx,
          jsonb_build_object('type', p_type, 'amount', p_amount, 'source', p_source, 'department', p_department));

  return v_tx;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reversal / correction (never edits/deletes the original)
-- ---------------------------------------------------------------------------
create or replace function public.reverse_transaction(p_txn_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  o     public.financial_transactions%rowtype;
  v_new uuid;
begin
  if v_uid is null or not public.has_permission('finance.reverse') then
    raise exception 'forbidden: finance.reverse required';
  end if;

  select * into o from public.financial_transactions where id = p_txn_id;
  if o.id is null then raise exception 'transaction not found'; end if;
  if o.source = 'REVERSAL' then raise exception 'cannot reverse a reversal'; end if;
  if o.source = 'OPENING_BALANCE' then raise exception 'cannot reverse the opening balance'; end if;
  if exists (select 1 from public.financial_transactions where reverses_transaction_id = p_txn_id) then
    raise exception 'transaction already reversed';
  end if;

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, order_id,
     description, reverses_transaction_id, created_by)
  values
    (case when o.type = 'INCOME' then 'EXPENSE' else 'INCOME' end,
     o.category, o.amount, now(), 'REVERSAL', o.department, o.category_id, o.order_id,
     'Reversal of transaction ' || p_txn_id::text, p_txn_id, v_uid)
  returning id into v_new;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.transaction.reverse', 'financial_transaction', v_new,
          jsonb_build_object('reverses', p_txn_id, 'amount', o.amount));

  return v_new;
end;
$$;
