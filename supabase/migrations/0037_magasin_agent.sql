-- 0037 — Record which agent performed a Magasin sale / expense
-- Nahla Cake Panel

alter table public.magasin_sales
  add column if not exists employee_id uuid references public.employees(id);

-- record_magasin_sale (+ p_agent) --------------------------------------------
drop function if exists public.record_magasin_sale(date, jsonb);
create or replace function public.record_magasin_sale(p_sale_date date, p_lines jsonb, p_agent uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_sale uuid; v_total numeric(12,2); v_cat uuid; v_line jsonb;
begin
  if v_uid is null or not public.has_permission('magasin.sale.create') then raise exception 'forbidden: magasin.sale.create required'; end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then raise exception 'at least one product line is required'; end if;

  insert into public.magasin_sales (sale_date, department, total_amount, employee_id, created_by)
  values (coalesce(p_sale_date, (now() at time zone 'Africa/Algiers')::date), 'SHOP', 0, p_agent, v_uid)
  returning id into v_sale;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    if coalesce((v_line->>'quantity')::numeric, 0) <= 0 then raise exception 'quantity must be positive'; end if;
    insert into public.magasin_sale_lines (sale_id, product_name, quantity, unit_price)
    values (v_sale, coalesce(nullif(trim(v_line->>'product_name'), ''), 'Item'),
            (v_line->>'quantity')::numeric, coalesce((v_line->>'unit_price')::numeric, 0));
  end loop;

  select coalesce(sum(line_total), 0) into v_total from public.magasin_sale_lines where sale_id = v_sale;
  update public.magasin_sales set total_amount = v_total where id = v_sale;

  if v_total > 0 then
    select id into v_cat from public.financial_categories where key = 'MAGASIN_SALE';
    insert into public.financial_transactions
      (type, category, amount, occurred_at, source, department, category_id, magasin_sale_id, employee_id, description, created_by)
    values ('INCOME', 'MAGASIN_SALE', v_total, now(), 'MAGASIN', 'SHOP', v_cat, v_sale, p_agent,
            'Magasin sale ' || to_char(coalesce(p_sale_date, (now() at time zone 'Africa/Algiers')::date), 'YYYY-MM-DD'), v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'magasin.sale.create', 'magasin_sale', v_sale, jsonb_build_object('total', v_total, 'agent', p_agent));
  return v_sale;
end; $$;

-- record_magasin_expense (+ p_agent) -----------------------------------------
drop function if exists public.record_magasin_expense(numeric, uuid, text, timestamptz, text, text, int);
create or replace function public.record_magasin_expense(
  p_amount numeric, p_category_id uuid, p_description text, p_occurred_at timestamptz,
  p_image_path text default null, p_image_mime text default null, p_image_size int default null,
  p_agent uuid default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_key text; v_tx uuid;
begin
  if v_uid is null or not public.has_permission('magasin.expense.create') then raise exception 'forbidden: magasin.expense.create required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select key into v_key from public.financial_categories where id = p_category_id;

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, employee_id, description, created_by)
  values ('EXPENSE', coalesce(v_key, 'OTHER'), p_amount, coalesce(p_occurred_at, now()), 'MAGASIN', 'SHOP', p_category_id, p_agent, p_description, v_uid)
  returning id into v_tx;

  if p_image_path is not null then
    insert into public.financial_attachments (transaction_id, bucket, object_path, mime_type, size_bytes, uploaded_by)
    values (v_tx, 'finance-attachments', p_image_path, p_image_mime, p_image_size, v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'magasin.expense.create', 'financial_transaction', v_tx, jsonb_build_object('amount', p_amount, 'category', v_key, 'agent', p_agent));
  return v_tx;
end; $$;

-- magasin_day_expenses (+ agent column) --------------------------------------
drop function if exists public.magasin_day_expenses(date);
create or replace function public.magasin_day_expenses(p_date date)
returns table (id uuid, amount numeric, category text, description text, occurred_at timestamptz, agent text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.has_permission('magasin.view') or public.has_permission('finance.transactions.view')) then raise exception 'forbidden'; end if;
  return query
    select t.id, t.amount, coalesce(fc.name, t.category), t.description, t.occurred_at, e.full_name
    from public.financial_transactions t
    left join public.financial_categories fc on fc.id = t.category_id
    left join public.employees e on e.id = t.employee_id
    where t.source = 'MAGASIN' and t.type = 'EXPENSE'
      and (t.occurred_at at time zone 'Africa/Algiers')::date = p_date
    order by t.occurred_at desc;
end; $$;
