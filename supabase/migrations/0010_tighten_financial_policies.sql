-- 0010 — Restrict direct financial writes to finance users
-- Nahla Cake Panel
--
-- order_financials rows are created atomically by create_order (SECURITY DEFINER,
-- bypasses RLS), so we can safely restrict DIRECT insert/update on the table to
-- finance users only. This prevents an operational (non-finance) user from
-- altering amounts through the edit flow, matching the spec's finance boundary.

drop policy if exists "order_financials_insert" on public.order_financials;
drop policy if exists "order_financials_update" on public.order_financials;

create policy "order_financials_insert" on public.order_financials
  for insert to authenticated
  with check (public.has_permission('finance.view'));

create policy "order_financials_update" on public.order_financials
  for update to authenticated
  using (public.has_permission('finance.view'))
  with check (public.has_permission('finance.view'));
