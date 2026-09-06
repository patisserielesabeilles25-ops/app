-- 0035 — Direct salary payment (posts a charge to the central ledger)
-- Nahla Cake Panel
--
-- Records a salary payment to an employee as a real EXPENSE in the finance
-- ledger (category PAYROLL, marked PAYROLL_SALARY), attributed to the employee.
-- Used by the "Payer" modal on the Users page.

create or replace function public.record_salary_payment(
  p_employee_id uuid,
  p_amount      numeric,
  p_paid_on     date,
  p_note        text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_dept text;
  v_name text;
  v_cat  uuid;
  v_tx   uuid;
  v_date date := coalesce(p_paid_on, (now() at time zone 'Africa/Algiers')::date);
begin
  if v_uid is null or not public.has_permission('payroll.pay') then
    raise exception 'forbidden: payroll.pay required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select department, full_name into v_dept, v_name from public.employees where id = p_employee_id;
  if v_name is null then raise exception 'employee not found'; end if;

  select id into v_cat from public.financial_categories where key = 'PAYROLL';

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, employee_id, description, created_by)
  values
    ('EXPENSE', 'PAYROLL_SALARY', p_amount, v_date::timestamptz, 'PAYROLL', coalesce(v_dept, 'GENERAL'),
     v_cat, p_employee_id, coalesce(nullif(p_note, ''), 'Salaire — ' || v_name), v_uid)
  returning id into v_tx;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'payroll.salary.pay', 'financial_transaction', v_tx,
          jsonb_build_object('employee', p_employee_id, 'amount', p_amount));

  return v_tx;
end;
$$;
