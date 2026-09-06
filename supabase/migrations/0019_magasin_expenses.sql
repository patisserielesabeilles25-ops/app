-- 0019 — MAGASIN expenses (operational shop spending → central ledger)
-- Nahla Cake Panel — Finance expansion Phase 7
--
-- Shop staff (magasin.expense.create) record shop spending; posted to the central
-- ledger as EXPENSE (source=MAGASIN, dept SHOP). Listing for the shop screen is a
-- scoped SECURITY DEFINER function so staff never read the whole ledger.

create or replace function public.record_magasin_expense(
  p_amount      numeric,
  p_category_id uuid,
  p_description text,
  p_occurred_at timestamptz,
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
  v_key text;
  v_tx  uuid;
begin
  if v_uid is null or not public.has_permission('magasin.expense.create') then
    raise exception 'forbidden: magasin.expense.create required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select key into v_key from public.financial_categories where id = p_category_id;

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, description, created_by)
  values
    ('EXPENSE', coalesce(v_key, 'OTHER'), p_amount, coalesce(p_occurred_at, now()),
     'MAGASIN', 'SHOP', p_category_id, p_description, v_uid)
  returning id into v_tx;

  if p_image_path is not null then
    insert into public.financial_attachments (transaction_id, bucket, object_path, mime_type, size_bytes, uploaded_by)
    values (v_tx, 'finance-attachments', p_image_path, p_image_mime, p_image_size, v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'magasin.expense.create', 'financial_transaction', v_tx,
          jsonb_build_object('amount', p_amount, 'category', v_key));

  return v_tx;
end;
$$;

-- Scoped list of a day's MAGASIN expenses for the shop screen.
create or replace function public.magasin_day_expenses(p_date date)
returns table (id uuid, amount numeric, category text, description text, occurred_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (public.has_permission('magasin.view') or public.has_permission('finance.transactions.view')) then
    raise exception 'forbidden';
  end if;
  return query
    select t.id, t.amount,
           coalesce(fc.name, t.category),
           t.description, t.occurred_at
    from public.financial_transactions t
    left join public.financial_categories fc on fc.id = t.category_id
    where t.source = 'MAGASIN' and t.type = 'EXPENSE'
      and (t.occurred_at at time zone 'Africa/Algiers')::date = p_date
    order by t.occurred_at desc;
end;
$$;
