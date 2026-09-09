-- 0053 — Cake coating / finish on the order
-- Nahla Cake Panel
--
-- Every order records one coating: Pâte à Sucre, Ganache, Voulaire, or
-- Crème Chantilly. Shown in the order details.
alter table public.orders
  add column if not exists coating text;

comment on column public.orders.coating is
  'Cake coating/finish: Pâte à Sucre | Ganache | Voulaire | Crème Chantilly.';
