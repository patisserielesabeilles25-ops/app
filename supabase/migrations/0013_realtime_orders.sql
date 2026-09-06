-- 0013 — Enable Realtime on the orders table
-- Nahla Cake Panel
--
-- Adds public.orders to the supabase_realtime publication so status changes are
-- broadcast to subscribed clients. Realtime still honors RLS: a client only
-- receives rows its SELECT policy allows. The orders table carries no financial
-- columns (those live in order_financials, which is NOT published), so nothing
-- sensitive is broadcast. Idempotent.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
