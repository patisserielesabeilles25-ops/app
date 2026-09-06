# Nahla Cake Panel — Database Design

Normalized PostgreSQL design (Supabase). All tables have RLS enabled. Types illustrative;
final DDL lives in `supabase/migrations/`. Verified against every V1 workflow in §9.

---

## 1. Entities

`profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `customers`, `orders`,
`order_number_counters`, `order_status_history`, `order_images`, `order_financials`,
`deliveries`, `financial_transactions`, `financial_attachments`,
`ready_made_daily_production`, `audit_log`.

> **Design decision (Phase 2):** financial amounts were moved OFF `orders` into a separate
> `order_financials` table. All signed-in users share the `authenticated` Postgres role, so
> per-column RLS on `orders` cannot distinguish finance vs non-finance users. Splitting the
> amounts into their own table lets RLS deny them at the row level to operational/lab users —
> satisfying the spec's "enforce finance visibility at the data layer" requirement.

Conventions: UUID PKs (`gen_random_uuid()`), `created_at timestamptz default now()`,
`updated_at` maintained by trigger, explicit FKs, `citext`/`numeric(12,2)` where relevant.

---

## 2. Identity & RBAC

### profiles
Mirrors `auth.users` (1:1). Created by trigger on new auth user.
- `id uuid PK` → FK `auth.users.id`
- `full_name text`, `phone text`, `is_active boolean default true`
- `created_at`, `updated_at`

### roles
- `id uuid PK`, `key text UNIQUE` (e.g. `main`, `operations`), `name text`, `description text`
- `is_system boolean default false` (protect built-ins from deletion)

### permissions
- `id uuid PK`, `key text UNIQUE` (e.g. `finance.view`), `description text`

### role_permissions  (M:N roles↔permissions)
- `role_id uuid FK roles`, `permission_id uuid FK permissions`
- `PRIMARY KEY (role_id, permission_id)`

### user_roles  (M:N users↔roles)
- `user_id uuid FK profiles`, `role_id uuid FK roles`
- `PRIMARY KEY (user_id, role_id)`

**Effective permissions** of a user = union of permissions across their roles. Exposed via SQL
function `has_permission(perm text) returns boolean` used in RLS and app guards.

Seed permission keys (V1): `dashboard.view`, `shop.view`, `orders.view`, `orders.create`,
`orders.edit`, `orders.delete`, `laboratory.view`, `production.update`, `calendar.view`,
`delivery.view`, `delivery.update`, `finance.view`, `finance.income.create`,
`finance.expense.create`, `finance.transactions.view`, `finance.attachments.view`,
`users.view`, `users.create`, `users.edit`, `users.delete`, `roles.view`, `roles.create`,
`roles.edit`, `permissions.manage`, `settings.manage`.

Seed roles: **`main`** (all permissions) and **`operations`** (all except every `finance.*`
and the user/role/permission management perms). 4 initial main users get `main`.

---

## 3. Customers & orders

### customers
- `id uuid PK`, `name text NOT NULL`, `phone text NOT NULL`
- optional `notes text`; `created_at`, `updated_at`
- Index on `phone`. (Orders may also snapshot name/phone for history.)

### orders
- `id uuid PK`
- `order_number text UNIQUE NOT NULL` — allocated via yearly sequence (see §7)
- `customer_id uuid FK customers` (+ denormalized `customer_name`, `customer_phone` snapshot)
- `cake_size_cm numeric NOT NULL CHECK (cake_size_cm > 0)`
- `description text`
- `delivery_date date NOT NULL`
- `delivery_time time NOT NULL`
- `delivery_required boolean NOT NULL default false`
- *(financial amounts — total, advance, delivery, remaining — live in `order_financials`, see §5)*
- `production_status text NOT NULL default 'NEW'`
  `CHECK (production_status IN ('NEW','IN_PRODUCTION','READY'))`
- `delivery_status text` `CHECK (delivery_status IN ('READY','OUT_FOR_DELIVERY','DELIVERED'))`
- `fulfillment text NOT NULL default 'PICKUP' CHECK (fulfillment IN ('PICKUP','DELIVERY'))`
- Transition timestamps: `sent_to_lab_at`, `in_production_at`, `ready_at`,
  `out_for_delivery_at`, `delivered_at` (all `timestamptz`, nullable)
- `created_by uuid FK profiles`, `updated_by uuid FK profiles`, `created_at`, `updated_at`
- Indexes: `delivery_date`, `production_status`, `delivery_status`, `customer_id`,
  `(delivery_date, delivery_time)` for calendar/day queries.

### order_number_counters  (atomic per-year sequence)
- `year int PK`, `last_value bigint NOT NULL default 0`
- RLS enabled, **no policies** — reachable only via `allocate_order_number()` (SECURITY DEFINER)
  or the service role.

### order_status_history  (audit of state changes)
- `id uuid PK`, `order_id uuid FK orders`
- `field text` (`production_status` | `delivery_status`), `from_value text`, `to_value text`
- `changed_by uuid FK profiles`, `changed_at timestamptz default now()`

### order_images
- `id uuid PK`, `order_id uuid FK orders ON DELETE CASCADE`
- `bucket text default 'order-images'`, `object_path text NOT NULL`
- `mime_type text`, `size_bytes int`, `uploaded_by uuid FK profiles`, `created_at`
- No binary data — path only.

---

## 4. Delivery

### deliveries
One row per order that leaves via delivery (1:1 with order where `fulfillment='DELIVERY'`).
- `id uuid PK`, `order_id uuid FK orders UNIQUE`
- `status text` mirrors delivery states, `driver text` (optional, extensible)
- `out_for_delivery_at`, `delivered_at timestamptz`
- `created_by`, `updated_by`, `created_at`, `updated_at`

> Delivery timestamps are duplicated on `orders` for fast listing; `deliveries` holds the
> authoritative delivery record and future delivery-specific fields.

---

## 5. Finance (ledger)

### order_financials  (1:1 with orders — finance-gated)
- `order_id uuid PK` → FK `orders(id) ON DELETE CASCADE`
- `total_amount numeric(12,2) NOT NULL default 0 CHECK (>= 0)`
- `advance_payment numeric(12,2) NOT NULL default 0 CHECK (>= 0)`
- `delivery_amount numeric(12,2) NOT NULL default 0 CHECK (>= 0)`
- `remaining_amount numeric(12,2) GENERATED ALWAYS AS (total_amount - advance_payment) STORED`
- `created_by`, `updated_by`, `created_at`, `updated_at`
- **CHECK**: `advance_payment <= total_amount`
- **RLS**: SELECT requires `finance.view`/`finance.transactions.view`; INSERT allowed with
  `orders.create` (capture amounts at order creation) but a non-finance creator cannot read them back.

### financial_transactions  (append-only)
- `id uuid PK`
- `type text NOT NULL CHECK (type IN ('INCOME','EXPENSE'))`
- `category text NOT NULL` (e.g. `ORDER_ADVANCE`, `ORDER_FINAL`, `PURCHASE`, `SERVICE`, `OTHER`)
- `amount numeric(12,2) NOT NULL CHECK (amount > 0)`  — always positive; sign implied by `type`
- `occurred_at timestamptz NOT NULL default now()`
- `order_id uuid FK orders NULL` (set for order-related income)
- `item_name text NULL` (for purchases), `description text`
- `created_by uuid FK profiles NOT NULL`, `created_at timestamptz default now()`
- `reverses_transaction_id uuid FK financial_transactions NULL` (corrections)
- Indexes: `occurred_at`, `type`, `category`, `order_id`.
- **No UPDATE/DELETE** in normal operation (enforced by RLS: no update/delete policy for
  non-admins; corrections = new reversing rows).

### Derived balance
Implemented as a **guarded SECURITY DEFINER function** rather than a plain view, so it can
explicitly deny non-finance users (a view would return an unguarded 0 to them):
```sql
CREATE FUNCTION public.current_balance() RETURNS numeric ... SECURITY DEFINER AS $$
BEGIN
  IF NOT public.has_permission('finance.transactions.view') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN (SELECT COALESCE(SUM(CASE WHEN type='INCOME' THEN amount ELSE -amount END),0)
          FROM public.financial_transactions);
END; $$;
```

### financial_attachments
- `id uuid PK`, `transaction_id uuid FK financial_transactions ON DELETE RESTRICT`
- `bucket text default 'finance-attachments'`, `object_path text NOT NULL`
- `mime_type text`, `size_bytes int`, `uploaded_by uuid FK profiles`, `created_at`
- Sensitive — access gated by `finance.attachments.view` (see §8).

---

## 6. Ready-made production & audit

### ready_made_daily_production
- `id uuid PK`, `production_date date NOT NULL UNIQUE`
- `small_qty int NOT NULL default 0 CHECK (small_qty >= 0)`
- `medium_qty int NOT NULL default 0 CHECK (medium_qty >= 0)`
- `large_qty int NOT NULL default 0 CHECK (large_qty >= 0)`
- `created_by`, `updated_by`, `created_at`, `updated_at`
- Extensible: future per-size inventory can reference this or a normalized `ready_made_items`.

### audit_log  (generic important-action trail)
- `id uuid PK`, `actor_id uuid FK profiles`
- `action text` (e.g. `order.create`, `order.status_change`, `finance.transaction.create`,
  `user.permission_change`), `entity_type text`, `entity_id uuid`
- `metadata jsonb`, `created_at timestamptz default now()`
- Append-only; no user-facing edit/delete.

---

## 7. Order-number generation (atomic)

- Per-year sequence table or `bigint` sequence: allocate next value in the same DB transaction
  as the order insert (SQL function `allocate_order_number(year int) returns text`).
- Format: `NC-<YEAR>-<zero-padded 6>` e.g. `NC-2026-000123`.
- `orders.order_number` has a UNIQUE constraint as the final guard against duplicates.

---

## 8. RLS strategy

Every table above has `ENABLE ROW LEVEL SECURITY`. Helper functions (SECURITY DEFINER, safe):
- `auth_user_id()` → current user id from JWT.
- `has_permission(perm text)` → boolean over the user's roles→permissions.

Policy summary:

| Table                     | SELECT                                  | INSERT/UPDATE/DELETE                                   |
| ------------------------- | --------------------------------------- | ----------------------------------------------------- |
| profiles                  | authenticated (self + `users.view`)     | self limited; `users.edit` for others                 |
| roles/permissions/*_perms | `roles.view` / `permissions.manage`     | `roles.*` / `permissions.manage`                      |
| customers                 | `orders.view`                           | `orders.create` / `orders.edit`                       |
| orders                    | `orders.view` or `laboratory.view`      | `orders.create` / `orders.edit`; status via functions |
| order_images              | `orders.view`                           | `orders.create`/`orders.edit`                         |
| deliveries                | `delivery.view`                         | `delivery.update`                                      |
| financial_transactions    | `finance.transactions.view`             | INSERT via server action w/ `finance.income.create` / `finance.expense.create`; **no** UPDATE/DELETE |
| financial_attachments     | `finance.attachments.view`              | insert w/ finance perms                               |
| ready_made_daily_prod.    | `laboratory.view` or `dashboard.view`   | `production.update`                                   |
| order_status_history      | `orders.view`/`laboratory.view`         | insert-only via status functions                      |
| audit_log                 | `settings.manage` (admins)              | insert-only (server)                                  |

Finance tables have **no SELECT** for users lacking finance permissions — the data layer,
not the UI, denies access. Storage buckets enforce matching policies (see `SECURITY.md`).

Privileged operations (order-number allocation, ledger posting, permission changes) run in
server actions using the service-role client **after** an app-level `requirePermission()` —
belt-and-suspenders with RLS.

---

## 9. Workflow verification

- **Shop → lab**: insert `orders` (status `NEW`) → server action sets `IN_PRODUCTION`/records
  `sent_to_lab_at`; lab sees rows via `laboratory.view`. ✔
- **Production**: `production.update` transitions to `READY`, sets `ready_at`, writes history +
  realtime. Shop/dashboard see READY. ✔
- **Calendar**: query `orders` by `delivery_date` (indexed); group by year/month/day. ✔
- **Delivery**: `deliveries` + orders transition `READY → OUT_FOR_DELIVERY → DELIVERED` with
  timestamps. ✔
- **Finance**: advance/final/expense as separate ledger rows; balance from view; attachments
  gated. Order creation posts nothing until money received. ✔
- **Users/roles/permissions**: RBAC tables + RLS; changes audited. ✔
- **Ready-made**: one row per date, S/M/L quantities. ✔

Indexes, UNIQUE constraints, CHECKs, and FKs above cover the integrity risks in
`PROJECT_SPEC.md §12`.
