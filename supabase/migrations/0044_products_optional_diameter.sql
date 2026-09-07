-- 0044 — Products: make diameter optional; prices no longer captured on the form
-- Nahla Cake Panel
--
-- The product form drops the purchase/selling price inputs (columns kept with
-- their 0 default) and makes the diameter optional, so a product can be just a
-- name. Orders still capture a cake size: the order form now lets the user enter
-- it (auto-filled from the product's diameter when the product has one).

alter table public.products alter column diameter_cm drop not null;
alter table public.products drop constraint if exists products_diameter_cm_check;
