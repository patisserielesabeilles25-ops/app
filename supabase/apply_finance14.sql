-- ============================================================
-- Nahla Cake Panel — Finance Phase 14 (salary payments:
-- record_payroll_payment + status machine). Run in SQL Editor.
-- ============================================================

-- 0024 — Salary payments: post to ledger + advance the status machine
-- Nahla Cake Panel — Finance expansion Phase 14

create or replace function public.record_payroll_payment(
  p_record_id uuid,
  p_amount    numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_emp       uuid;
  v_name      text;
  v_dept      text;
  v_gross     numeric;
  v_adv       numeric;
  v_adj       numeric;
  v_paid      numeric;
  v_status    text;
  v_remaining numeric;
  v_cat       uuid;
  v_tx        uuid;
  v_new_paid  numeric;
  v_new_status text;
begin
  if v_uid is null or not public.has_permission('payroll.pay') then
    raise exception 'forbidden: payroll.pay required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select pr.employee_id, e.full_name, e.department,
         pr.gross_amount, pr.advances_total, pr.adjustments, pr.paid_amount, pr.status
    into v_emp, v_name, v_dept, v_gross, v_adv, v_adj, v_paid, v_status
  from public.payroll_records pr
  join public.employees e on e.id = pr.employee_id
  where pr.id = p_record_id
  for update;

  if v_emp is null then raise exception 'payroll record not found'; end if;
  if v_status not in ('CALCULATED', 'PARTIALLY_PAID') then
    raise exception 'payroll is %; not payable', v_status;
  end if;

  v_remaining := v_gross + v_adj - v_adv - v_paid;
  if p_amount > v_remaining then
    raise exception 'payment exceeds the remaining amount';
  end if;

  select id into v_cat from public.financial_categories where key = 'PAYROLL';

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, employee_id, payroll_record_id, description, created_by)
  values
    ('EXPENSE', 'PAYROLL_PAYMENT', p_amount, now(), 'PAYROLL', coalesce(v_dept, 'GENERAL'),
     v_cat, v_emp, p_record_id, 'Salary payment for ' || v_name, v_uid)
  returning id into v_tx;

  v_new_paid := v_paid + p_amount;
  v_new_status := case when (v_gross + v_adj - v_adv - v_new_paid) <= 0 then 'PAID' else 'PARTIALLY_PAID' end;

  update public.payroll_records
    set paid_amount = v_new_paid, status = v_new_status, updated_at = now()
  where id = p_record_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'payroll.payment.create', 'payroll_record', p_record_id,
          jsonb_build_object('amount', p_amount, 'employee', v_emp, 'status', v_new_status));

  return v_tx;
end;
$$;
