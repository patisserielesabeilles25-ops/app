-- 0031 — Per-order custom status
-- Nahla Cake Panel
--
-- Lets each order be tagged with one custom status (from public.custom_statuses,
-- managed on the Statuses page). Shown as an editable column on the Orders page.
-- Nullable; clearing the linked custom status sets this back to NULL.

alter table public.orders
  add column if not exists custom_status_id uuid references public.custom_statuses(id) on delete set null;
create index if not exists idx_orders_custom_status on public.orders(custom_status_id);
