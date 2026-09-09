-- 0056 — Free-text size on orders and products
-- Nahla Cake Panel
--
-- Cake size (orders) and product size/diameter can now be entered freely
-- (e.g. "Mini", "1/2 plateau", "20 cm", "?/…"). The free text is shown in the
-- UI; the existing numeric columns keep a parsed value for piece-work rate
-- lookups and sorting.
alter table public.orders
  add column if not exists size_label text;

alter table public.products
  add column if not exists size_label text;

comment on column public.orders.size_label is
  'Free-text cake size shown in the UI. cake_size_cm keeps the numeric value for rate lookups.';
comment on column public.products.size_label is
  'Free-text product size shown in the UI. diameter_cm keeps the numeric value.';
