-- Fourrage: free-text note for an extra ingredient the customer wants added,
-- or a modification to the standard recipe. When set, the Orders list flags
-- the row with a red "NEW" badge so the kitchen notices the special request.
alter table public.orders
  add column if not exists fourage text;

comment on column public.orders.fourage is
  'Optional: extra/modified ingredient requested by the customer. Flags the order NEW (red) in the Orders list.';
