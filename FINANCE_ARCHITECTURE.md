# Finance Module — Architecture

Expansion of the existing Nahla Cake Panel finance capability into a full, auditable financial
management system. This document describes *how* it fits the current app. Data model lives in
`FINANCE_DATABASE_DESIGN.md`, security in `FINANCE_SECURITY.md`, sequencing in
`FINANCE_IMPLEMENTATION_PLAN.md`.

---

## 1. What already exists (reuse — do NOT duplicate)

| Concern | Existing asset | In the expansion |
| --- | --- | --- |
| Auth & identity | `profiles`, Supabase Auth, `@supabase/ssr` | reused as-is |
| RBAC | `roles`, `permissions`, `role_permissions`, `user_roles`, `has_permission()`, `my_permissions()` | **extended** with new finance/magasin/payroll permissions |
| App-layer guard | `requirePermission()` / `hasPermission()` (`src/lib/auth`) | reused |
| Orders | `orders`, `order_financials`, `create_order()` | order payments link to these |
| **Central ledger** | `financial_transactions` (append-only, `type` INCOME/EXPENSE, `amount>0`, `reverses_transaction_id`) | **the single source of truth — extended, never replaced** |
| Attachments | `financial_attachments` + private `finance-attachments` bucket + gated route `/api/finance-attachments/[id]` | reused/generalized |
| Audit | `audit_log`, `writeAudit()` | reused for all finance actions |
| Derived balance | `current_balance()` (guarded) | replaced by `finance_balance()` incl. opening balance |
| Realtime | `orders` publication | finance is **not** broadcast (sensitive) |

**Principle:** there is exactly one treasury = the `financial_transactions` ledger. MAGASIN,
laboratory, delivery, payroll, machines, investment are all *classifications* on that one ledger,
never separate balances.

---

## 2. Layered design

```
Browser (client components: forms, tables, report views)
  │  session cookie (RLS-scoped anon key only)
  ▼
Next.js server
  ├─ Server Components ...... read ledger/reports as the user (RLS applies)
  ├─ Server Actions ......... all financial writes (permission-checked)
  │     └─ call SECURITY DEFINER SQL fns (atomic post + link + audit)
  └─ Route Handlers ......... gated signed URLs for attachments
  ▼
Supabase Postgres
  ├─ financial_transactions (ledger) + classification tables
  ├─ magasin_sales, employees, payroll_* 
  ├─ RLS on every table (finance perms; MAGASIN write-only for shop staff)
  ├─ aggregation RPCs (finance_summary / by_category / by_department / by_source)
  └─ Storage: finance-attachments (private)
```

Two enforcement layers, always both: **application** (`requirePermission`) **and** **database**
(RLS + SECURITY DEFINER functions). Every money-moving write goes through a DB function so the
posting, its links, and its audit row are one atomic transaction.

---

## 3. The ledger as source of truth

`financial_transactions` stays append-only. A row is one real money movement. Classification is
normalized to avoid duplicate concepts:

- **`type`** — direction only: `INCOME` | `EXPENSE` (drives the sign; `amount` always > 0).
- **`source`** — origin module: `ORDER | MAGASIN | PAYROLL | PURCHASE | MACHINE | DELIVERY | INVESTMENT | OPENING_BALANCE | REVERSAL | OTHER`.
- **`department`** — `SHOP | LABORATORY | DELIVERY | ADMINISTRATION | GENERAL | INVESTMENT` (backed by a configurable `departments` table).
- **`category_id`** — FK to `financial_categories` (configurable; e.g. Goods, Rent, Utilities, Payroll…).

The high-level "transaction types" in the brief (PAYOUT, PAYROLL, ADVANCE_PAYMENT, ORDER_PAYMENT,
MAGASIN_SALE, ASSET_SALE, INVESTMENT, REFUND, ADJUSTMENT) are **derived** from
`(type, source, category)` — not stored as a separate redundant column.

Linkage uses explicit nullable FKs on the ledger row (queryable, index-friendly):
`order_id`, `employee_id`, `magasin_sale_id`, `payroll_record_id`, `payroll_advance_id`.

Balance is **derived**: `opening_balance + Σ income − Σ expense`, opening set via a single
`source='OPENING_BALANCE'` transaction. No mutable balance field ever.

---

## 4. Money accounting rules (enforced, not conventions)

- Order money reflects **cash actually received**: advance at creation, final on payment — never
  the order total on creation (already true; extended with an explicit "record order payment" flow).
- Delivery fee is stored separately (`order_financials.delivery_amount`) and, when posted, carries
  `source='DELIVERY'` / department DELIVERY so it is independently reportable.
- Machine **purchase/repair = EXPENSE**; machine **sale = INCOME** (`source='MACHINE'`).
- Payroll **advance** is its own transaction linked to the employee; it **reduces** the later net
  payable but is never deleted or overwritten.
- Investment is its own `source`/department, never merged into operating expenses.
- Corrections are **reversals** (opposite entry, `reverses_transaction_id`), never edits/deletes.

---

## 5. MAGASIN (operational entry point, not a treasury)

MAGASIN is a fast, simple screen for the shop employee. It records daily direct sales and shop
expenses that **post into the central ledger** (`source='MAGASIN'`, department SHOP). The shop
employee holds `magasin.*` permissions but **not** `finance.transactions.view` — so they can
create sales/expenses (via SECURITY DEFINER functions that recompute totals server-side) yet
**cannot see the treasury balance or full reports**. The MAGASIN page shows only its own daily
sales/expenses/net for the selected day.

---

## 6. Payroll subsystem

Employees + flexible rates + work records + periods + records + advances + payments. Piece/daily/
weekly/monthly models. Gross is computed from stored inputs (quantity × resolved rate; days ×
rate; period rate). A payment or advance creates a real EXPENSE ledger row (`source='PAYROLL'`,
department set per employee). Payroll records use a controlled state machine
(DRAFT→CALCULATED→PARTIALLY_PAID→PAID / CANCELLED). Salary figures are visible only with
`payroll.view`.

---

## 7. Reporting

All reports read the one ledger via **server-side SQL aggregation** (never client-side sums over
the whole ledger). Provided as SECURITY DEFINER RPCs guarded by `finance.reports.view` /
`finance.transactions.view`:

- `finance_summary(from, to)` → income, expense, net, counts.
- `finance_by_category(from, to)` / `finance_by_department(from, to)` / `finance_by_source(from, to)`.
- Period presets (today/week/month/year/custom) computed in the **business timezone**
  (`Africa/Algiers`) so day boundaries are stable regardless of browser tz.
- Every summary value is drillable → filtered transaction list → transaction detail.

Indexes on `occurred_at`, `type`, `category_id`, `department`, `source`, `employee_id`,
`order_id`, `created_by` back the aggregations.

---

## 8. Folder structure (additions)

```
src/lib/finance/        # extend: queries (reports), actions (post/reverse)
src/lib/magasin/        # sales/expenses queries + actions
src/lib/payroll/        # employees, rates, work records, periods, advances, payments
src/lib/reports/        # period math (business tz), report query wrappers
src/components/finance/  finance/magasin/  payroll/  reports/   # UI
src/app/(app)/finance/{overview,income,expenses,magasin,payroll,reports,transactions,attachments,audit}/
supabase/migrations/0014+…    # categories/departments, ledger extension, magasin, payroll, RPCs, RLS
```

Existing `/finance` becomes **Overview**; current transactions/income/expense pages are folded in
and extended. No parallel finance database is created.

---

## 9. Key decisions

- **One ledger, normalized classification** (type/source/department/category) — no redundant
  "transaction_type" column, no per-module balances.
- **SECURITY DEFINER write functions** for every money movement — atomic post+link+audit, and the
  only way MAGASIN staff can add rows without read access to the treasury.
- **Reversals over edits** — history is immutable.
- **`numeric(12,2)` DZD** everywhere (matches existing); no floating-point accounting.
- **Business-timezone reporting** to avoid off-by-one day totals.
