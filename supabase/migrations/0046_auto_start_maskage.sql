-- 0046 — Start Production goes straight to Maskage
-- Nahla Cake Panel
--
-- Business rule: starting production on an order should not require picking a
-- worker for Preparation. Preparation is auto-passed (no agent, no piece-work
-- earning) and the order lands directly in EN_MASKAGE. Masking and Finition are
-- still validated per worker as before.

create or replace function public.start_production_auto(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_num text;
begin
  if v_uid is null or not (public.has_permission('production.update') or public.has_permission('orders.edit')) then
    raise exception 'forbidden: production.update or orders.edit required';
  end if;

  update public.orders set
    production_stage  = 'EN_MASKAGE',
    production_status = 'IN_PRODUCTION',
    sent_to_lab_at    = coalesce(sent_to_lab_at, now()),
    in_production_at   = coalesce(in_production_at, now()),
    updated_by        = v_uid
  where id = p_order_id and production_stage = 'NOUVEAU'
  returning order_number into v_num;

  if v_num is null then
    raise exception 'order not found or already started';
  end if;

  -- Auto-pass Preparation: recorded as done, with no worker and no earning.
  insert into public.order_stages (order_id, stage, employee_id, piece_work_id, done_by)
  values (p_order_id, 'PREPARATION', null, null, v_uid)
  on conflict (order_id, stage) do nothing;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.production_start', 'order', p_order_id,
          jsonb_build_object('order_number', v_num, 'auto_maskage', true));
end;
$$;
