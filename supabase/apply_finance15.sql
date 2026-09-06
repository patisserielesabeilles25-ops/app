-- ============================================================
-- Nahla Cake Panel — Finance Phase 15/16 (reports drill-down:
-- finance_by_category now returns category_id). SQL Editor.
-- ============================================================

-- 0025 — Add category_id to the category breakdown (for drill-down)
-- Nahla Cake Panel — Finance expansion Phase 15/16

drop function if exists public.finance_by_category(timestamptz, timestamptz);

create function public.finance_by_category(p_from timestamptz, p_to timestamptz)
returns table (category_id uuid, category_key text, category_name text, income numeric, expense numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._finance_can_report() then raise exception 'forbidden'; end if;
  return query
    select
      fc.id,
      coalesce(fc.key, 'OTHER'),
      coalesce(fc.name, 'Other'),
      coalesce(sum(t.amount) filter (where t.type = 'INCOME'), 0),
      coalesce(sum(t.amount) filter (where t.type = 'EXPENSE'), 0)
    from public.financial_transactions t
    left join public.financial_categories fc on fc.id = t.category_id
    where t.source <> 'OPENING_BALANCE'
      and t.occurred_at >= p_from and t.occurred_at < p_to
    group by fc.id, fc.key, fc.name
    order by coalesce(sum(t.amount), 0) desc;
end;
$$;
