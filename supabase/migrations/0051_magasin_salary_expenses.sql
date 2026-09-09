-- 0051 — Show agent salary payments in the Magasin daily expenses
-- Nahla Cake Panel
--
-- Salary payments (category PAYROLL_SALARY, attributed to the agent) now appear
-- in the Magasin "Today's expenses" list and count in the daily summary,
-- alongside regular MAGASIN expenses.

create or replace function public.magasin_day_expenses(p_date date)
returns table (id uuid, amount numeric, category text, description text, occurred_at timestamptz, agent text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (public.has_permission('magasin.view') or public.has_permission('finance.transactions.view')) then
    raise exception 'forbidden';
  end if;
  return query
    select t.id, t.amount, coalesce(fc.name, t.category), t.description, t.occurred_at, e.full_name
    from public.financial_transactions t
    left join public.financial_categories fc on fc.id = t.category_id
    left join public.employees e on e.id = t.employee_id
    where t.type = 'EXPENSE'
      and (t.source = 'MAGASIN' or t.category = 'PAYROLL_SALARY')
      and (t.occurred_at at time zone 'Africa/Algiers')::date = p_date
    order by t.occurred_at desc;
end;
$$;

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
    where (source = 'MAGASIN' or category = 'PAYROLL_SALARY')
      and (occurred_at at time zone 'Africa/Algiers')::date = p_date;
end;
$$;
