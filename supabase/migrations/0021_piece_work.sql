-- 0021 — Piece-based payroll: rate resolution + work records
-- Nahla Cake Panel — Finance expansion Phase 11

-- Resolve the most specific active rate for a piece of work.
-- Specificity: employee-specific > job-generic; matching size/category > wildcard;
-- latest effective_from wins.
create or replace function public.resolve_rate(
  p_employee_id  uuid,
  p_work_category text,
  p_product_size  text,
  p_work_date     date,
  p_rate_kind     text default 'PIECE'
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select r.rate
  from public.payroll_rates r
  where r.is_active
    and r.rate_kind = p_rate_kind
    and r.effective_from <= p_work_date
    and (r.employee_id = p_employee_id or r.employee_id is null)
    and (r.work_category is null or r.work_category = p_work_category)
    and (r.product_size is null or r.product_size = p_product_size)
  order by (r.employee_id = p_employee_id) desc nulls last,
           (r.product_size = p_product_size) desc nulls last,
           (r.work_category = p_work_category) desc nulls last,
           r.effective_from desc
  limit 1;
$$;

-- Add a piece-work record with the resolved rate stored (auditable).
create or replace function public.add_work_record(
  p_employee_id   uuid,
  p_work_date     date,
  p_order_id      uuid,
  p_work_category text,
  p_product_size  text,
  p_quantity      numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_rate numeric;
  v_id   uuid;
  v_date date := coalesce(p_work_date, (now() at time zone 'Africa/Algiers')::date);
begin
  if v_uid is null or not public.has_permission('payroll.manage') then
    raise exception 'forbidden: payroll.manage required';
  end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'quantity must be positive'; end if;

  v_rate := public.resolve_rate(p_employee_id, p_work_category, p_product_size, v_date, 'PIECE');
  if v_rate is null then
    raise exception 'no matching piece rate configured for this work';
  end if;

  insert into public.piece_work_records
    (employee_id, work_date, order_id, work_category, product_size, quantity, applied_rate, entered_by)
  values
    (p_employee_id, v_date, p_order_id, p_work_category, p_product_size, p_quantity, v_rate, v_uid)
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'payroll.work_record.create', 'piece_work_record', v_id,
          jsonb_build_object('employee', p_employee_id, 'quantity', p_quantity, 'rate', v_rate));

  return v_id;
end;
$$;
