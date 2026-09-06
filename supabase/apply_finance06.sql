-- ============================================================
-- Nahla Cake Panel — Finance Phase 6 (MAGASIN sales:
-- magasin_sales + lines, ledger link, record_magasin_sale,
-- magasin_daily_summary). Run in Supabase SQL Editor.
-- ============================================================

-- 0018 — MAGASIN sales (operational shop entry → central ledger)
-- Nahla Cake Panel — Finance expansion Phase 6
--
-- Shop staff (magasin.sale.create) record sales; the SECURITY DEFINER function
-- recomputes totals and posts ONE INCOME row to the central ledger. The ledger
-- SELECT policy still requires finance.transactions.view, so shop staff can
-- write without reading the treasury. Their daily summary comes from a scoped
-- SECURITY DEFINER function.

create table public.magasin_sales (
  id           uuid primary key default gen_random_uuid(),
  sale_date    date not null,
  department   text not null default 'SHOP',
  total_amount numeric(12,2) not null default 0,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index idx_magasin_sales_date on public.magasin_sales(sale_date);

create table public.magasin_sale_lines (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.magasin_sales(id) on delete cascade,
  product_name text not null,
  quantity     numeric(12,3) not null check (quantity > 0),
  unit_price   numeric(12,2) not null check (unit_price >= 0),
  line_total   numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored
);
create index idx_magasin_sale_lines_sale on public.magasin_sale_lines(sale_id);

-- Link ledger rows to the originating sale
alter table public.financial_transactions
  add column if not exists magasin_sale_id uuid references public.magasin_sales(id);
create index if not exists idx_fin_tx_magasin_sale on public.financial_transactions(magasin_sale_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.magasin_sales      enable row level security;
alter table public.magasin_sale_lines enable row level security;

create policy "magasin_sales_select" on public.magasin_sales
  for select to authenticated
  using (public.has_permission('magasin.view') or public.has_permission('finance.transactions.view'));
create policy "magasin_sales_insert" on public.magasin_sales
  for insert to authenticated
  with check (public.has_permission('magasin.sale.create'));

create policy "magasin_sale_lines_select" on public.magasin_sale_lines
  for select to authenticated
  using (public.has_permission('magasin.view') or public.has_permission('finance.transactions.view'));
create policy "magasin_sale_lines_insert" on public.magasin_sale_lines
  for insert to authenticated
  with check (public.has_permission('magasin.sale.create'));

-- ---------------------------------------------------------------------------
-- Record a sale: recompute totals server-side, post one INCOME to the ledger
-- ---------------------------------------------------------------------------
create or replace function public.record_magasin_sale(p_sale_date date, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_sale  uuid;
  v_total numeric(12,2);
  v_cat   uuid;
  v_line  jsonb;
begin
  if v_uid is null or not public.has_permission('magasin.sale.create') then
    raise exception 'forbidden: magasin.sale.create required';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'at least one product line is required';
  end if;

  insert into public.magasin_sales (sale_date, department, total_amount, created_by)
  values (coalesce(p_sale_date, (now() at time zone 'Africa/Algiers')::date), 'SHOP', 0, v_uid)
  returning id into v_sale;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    if coalesce((v_line->>'quantity')::numeric, 0) <= 0 then
      raise exception 'quantity must be positive';
    end if;
    insert into public.magasin_sale_lines (sale_id, product_name, quantity, unit_price)
    values (
      v_sale,
      coalesce(nullif(trim(v_line->>'product_name'), ''), 'Item'),
      (v_line->>'quantity')::numeric,
      coalesce((v_line->>'unit_price')::numeric, 0)
    );
  end loop;

  select coalesce(sum(line_total), 0) into v_total
  from public.magasin_sale_lines where sale_id = v_sale;

  update public.magasin_sales set total_amount = v_total where id = v_sale;

  if v_total > 0 then
    select id into v_cat from public.financial_categories where key = 'MAGASIN_SALE';
    insert into public.financial_transactions
      (type, category, amount, occurred_at, source, department, category_id, magasin_sale_id, description, created_by)
    values
      ('INCOME', 'MAGASIN_SALE', v_total, now(), 'MAGASIN', 'SHOP', v_cat, v_sale,
       'Magasin sale ' || to_char(coalesce(p_sale_date, (now() at time zone 'Africa/Algiers')::date), 'YYYY-MM-DD'), v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'magasin.sale.create', 'magasin_sale', v_sale, jsonb_build_object('total', v_total));

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scoped daily summary for the MAGASIN screen (no treasury exposure)
-- ---------------------------------------------------------------------------
create or replace function public.magasin_daily_summary(p_date date)
returns table (sales numeric, expenses numeric, net numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (public.has_permission('magasin.view') or public.has_permission('finance.transactions.view')) then
    raise exception 'forbidden';
  end if;
  return query
    select
      coalesce(sum(amount) filter (where type = 'INCOME'), 0),
      coalesce(sum(amount) filter (where type = 'EXPENSE'), 0),
      coalesce(sum(case when type = 'INCOME' then amount else -amount end), 0)
    from public.financial_transactions
    where source = 'MAGASIN'
      and (occurred_at at time zone 'Africa/Algiers')::date = p_date;
end;
$$;
