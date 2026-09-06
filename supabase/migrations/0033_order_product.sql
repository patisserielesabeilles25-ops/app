-- 0033 — Link an order to a catalog product
-- Nahla Cake Panel
--
-- Orders are created for a product from the catalog (instead of a free-text
-- size). We keep cake_size_cm (set from the product's diameter) for existing
-- views, and record which product it was for real product analytics.

alter table public.orders
  add column if not exists product_id uuid references public.products(id);
create index if not exists idx_orders_product on public.orders(product_id);
