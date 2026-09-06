-- 0007 — Storage bucket for order reference images
-- Nahla Cake Panel
--
-- Private bucket. The browser never touches storage directly: uploads go through
-- a server action using the service role, and downloads use short-lived signed
-- URLs generated server-side after a permission check. With the bucket private
-- and no storage.objects policies for anon/authenticated, only the service role
-- (which bypasses RLS) can access objects — exactly the intended model.

insert into storage.buckets (id, name, public)
values ('order-images', 'order-images', false)
on conflict (id) do nothing;
