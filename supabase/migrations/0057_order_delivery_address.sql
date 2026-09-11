-- 0057 — Delivery address on orders
-- Nahla Cake Panel
--
-- Free-text delivery address, filled on /orders/new when "This order requires
-- delivery" is checked. Set via the post-create patch in createOrder (service
-- client) and by updateOrder, so the create_order RPC is unchanged.

alter table public.orders add column if not exists delivery_address text;
