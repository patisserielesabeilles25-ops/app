-- 0055 — Returning an order refunds its advance (removes it from the ledger)
-- Nahla Cake Panel
--
-- Marking an order returned now deletes the order's income entries (advance +
-- any payments) from financial_transactions, so the money leaves the finance
-- entries and treasury. Clearing the returned mark restores the advance income
-- from the order's recorded advance_payment.

create or replace function public.mark_order_returned(
  p_order_id uuid,
  p_reason   text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_num text;
begin
  if v_uid is null
     or not (public.has_permission('orders.edit') or public.has_permission('delivery.update')) then
    raise exception 'forbidden: orders.edit or delivery.update required';
  end if;

  update public.orders set
    returned_at   = coalesce(returned_at, now()),
    return_reason = p_reason,
    updated_by    = v_uid
  where id = p_order_id
  returning order_number into v_num;

  if v_num is null then
    raise exception 'order not found';
  end if;

  -- Refund: the advance/payments no longer count once the order is returned.
  delete from public.financial_transactions
  where order_id = p_order_id and type = 'INCOME';

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.returned', 'order', p_order_id,
          jsonb_build_object('order_number', v_num, 'reason', p_reason));
end;
$$;

create or replace function public.unmark_order_returned(
  p_order_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_num text;
  v_adv numeric;
  v_cat uuid;
begin
  if v_uid is null
     or not (public.has_permission('orders.edit') or public.has_permission('delivery.update')) then
    raise exception 'forbidden: orders.edit or delivery.update required';
  end if;

  update public.orders set
    returned_at   = null,
    return_reason = null,
    updated_by    = v_uid
  where id = p_order_id
  returning order_number into v_num;

  if v_num is null then
    raise exception 'order not found';
  end if;

  -- Restore the advance income removed on return (only if none exists now).
  select f.advance_payment into v_adv from public.order_financials f where f.order_id = p_order_id;
  if v_adv is not null and v_adv > 0
     and not exists (
       select 1 from public.financial_transactions t
       where t.order_id = p_order_id and t.type = 'INCOME'
     ) then
    select id into v_cat from public.financial_categories where key = 'ORDER_PAYMENT';
    insert into public.financial_transactions
      (type, category, amount, occurred_at, source, department, category_id, order_id, description, created_by)
    values ('INCOME', 'ORDER_ADVANCE', v_adv, now(), 'ORDER', 'SHOP', v_cat, p_order_id,
            'Advance payment for ' || v_num, v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.return_cleared', 'order', p_order_id,
          jsonb_build_object('order_number', v_num));
end;
$$;
