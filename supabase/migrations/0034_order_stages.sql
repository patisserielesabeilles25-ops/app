-- 0034 — Production stage attribution (Préparation / Maskage / Finition)
-- Nahla Cake Panel
--
-- Tracks WHICH employee completed each production stage of an order, so work is
-- attributed and piece-based earnings become real. Completing a stage:
--   * logs the employee in order_stages,
--   * creates a piece_work_records earning row (rate resolved from the employee),
--   * advances the order's production_stage (and status when finished).

-- Granular production stage on the order.
alter table public.orders
  add column if not exists production_stage text not null default 'NOUVEAU'
    check (production_stage in ('NOUVEAU', 'EN_PREPARATION', 'EN_MASKAGE', 'EN_FINITION', 'READY'));

-- Backfill from the legacy production_status so existing orders read correctly.
update public.orders set production_stage = case
  when production_status = 'READY' then 'READY'
  when production_status = 'IN_PRODUCTION' then 'EN_PREPARATION'
  else 'NOUVEAU'
end
where production_stage = 'NOUVEAU';

-- One row per (order, stage) recording who did it.
create table public.order_stages (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  stage         text not null check (stage in ('PREPARATION', 'MASKAGE', 'FINITION')),
  employee_id   uuid references public.employees(id),
  piece_work_id uuid references public.piece_work_records(id) on delete set null,
  done_by       uuid references public.profiles(id),
  done_at       timestamptz not null default now(),
  unique (order_id, stage)
);
create index idx_order_stages_order on public.order_stages(order_id);
create index idx_order_stages_emp on public.order_stages(employee_id);

alter table public.order_stages enable row level security;
create policy "order_stages_select" on public.order_stages
  for select to authenticated
  using (
    public.has_permission('orders.view')
    or public.has_permission('laboratory.view')
    or public.has_permission('payroll.view')
  );
-- Writes go through complete_order_stage (SECURITY DEFINER) only.

-- Start production on an order (NOUVEAU -> EN_PREPARATION).
create or replace function public.start_order_production(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_num text;
begin
  if v_uid is null or not (public.has_permission('production.update') or public.has_permission('orders.edit')) then
    raise exception 'forbidden: production.update or orders.edit required';
  end if;
  update public.orders set
    production_stage = 'EN_PREPARATION',
    production_status = 'IN_PRODUCTION',
    sent_to_lab_at = coalesce(sent_to_lab_at, now()),
    in_production_at = coalesce(in_production_at, now()),
    updated_by = v_uid
  where id = p_order_id and production_stage = 'NOUVEAU'
  returning order_number into v_num;
  if v_num is null then raise exception 'order not found or already started'; end if;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.production_start', 'order', p_order_id, jsonb_build_object('order_number', v_num));
end; $$;

-- Complete a stage, attributing it to an employee and creating an earning row.
create or replace function public.complete_order_stage(
  p_order_id uuid,
  p_stage    text,
  p_employee_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_size text;
  v_rate numeric;
  v_pw   uuid;
  v_next text;
  v_emp  text;
begin
  if v_uid is null or not (public.has_permission('production.update') or public.has_permission('orders.edit')) then
    raise exception 'forbidden: production.update or orders.edit required';
  end if;
  if p_stage not in ('PREPARATION', 'MASKAGE', 'FINITION') then raise exception 'invalid stage'; end if;
  if p_employee_id is null then raise exception 'employee required'; end if;

  select cake_size_cm::text into v_size from public.orders where id = p_order_id;
  if v_size is null then raise exception 'order not found'; end if;
  select full_name into v_emp from public.employees where id = p_employee_id;
  if v_emp is null then raise exception 'employee not found'; end if;

  -- Resolve the employee's piece rate (stage-specific first, then generic). 0 if none.
  v_rate := coalesce(
    public.resolve_rate(p_employee_id, p_stage, v_size, (now() at time zone 'Africa/Algiers')::date, 'PIECE'),
    0
  );

  insert into public.piece_work_records
    (employee_id, work_date, order_id, work_category, product_size, quantity, applied_rate, entered_by)
  values
    (p_employee_id, (now() at time zone 'Africa/Algiers')::date, p_order_id, p_stage, v_size, 1, v_rate, v_uid)
  returning id into v_pw;

  insert into public.order_stages (order_id, stage, employee_id, piece_work_id, done_by)
  values (p_order_id, p_stage, p_employee_id, v_pw, v_uid)
  on conflict (order_id, stage) do update
    set employee_id = excluded.employee_id, piece_work_id = excluded.piece_work_id,
        done_by = excluded.done_by, done_at = now();

  v_next := case p_stage
    when 'PREPARATION' then 'EN_MASKAGE'
    when 'MASKAGE' then 'EN_FINITION'
    when 'FINITION' then 'READY'
  end;

  update public.orders set
    production_stage = v_next,
    production_status = case when v_next = 'READY' then 'READY' else 'IN_PRODUCTION' end,
    ready_at = case when v_next = 'READY' then now() else ready_at end,
    delivery_status = case when v_next = 'READY' and fulfillment = 'DELIVERY' then 'READY' else delivery_status end,
    updated_by = v_uid
  where id = p_order_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.stage_done', 'order', p_order_id,
          jsonb_build_object('stage', p_stage, 'employee', p_employee_id, 'employee_name', v_emp, 'rate', v_rate));
end; $$;
