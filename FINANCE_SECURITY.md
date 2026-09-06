# Finance Module — Security Model

Extends `SECURITY.md`. Finance data is sensitive: it must be denied at UI, server, database, and
storage layers. No secret values appear here.

---

## 1. Permissions (added to the RBAC catalog)

Existing: `finance.view`, `finance.income.create`, `finance.expense.create`,
`finance.transactions.view`, `finance.attachments.view`.

**New:**
- `finance.reports.view` — daily/weekly/monthly/annual/custom reports.
- `finance.reverse` — create reversal/correction transactions.
- `finance.categories.manage` — manage categories/departments.
- `magasin.view`, `magasin.sale.create`, `magasin.expense.create` — operational shop entry
  (feeds central ledger; **no** treasury/report read access).
- `employees.view`, `employees.manage`.
- `payroll.view` — see salary data & payroll reports.
- `payroll.manage` — employees, rates, work records, periods, calculation.
- `payroll.pay` — record advances and salary payments.

**Roles (seed/update):**
- `main` → all of the above (4 main users).
- `operations` → unchanged (no finance).
- `shop_magasin` (new, optional) → `magasin.view`, `magasin.sale.create`, `magasin.expense.create`
  only — the shop employee who records sales/expenses but cannot see the treasury.

---

## 2. Four-layer enforcement

1. **Navigation/UI** — finance/magasin/payroll nav items filtered by permission (cosmetic only).
2. **Server** — every finance server action / route handler calls `requirePermission(...)` before
   any effect; writes run through SECURITY DEFINER SQL functions that re-check `has_permission()`.
3. **Database (RLS)** — every finance table has RLS; SELECT on ledger/reports requires
   `finance.transactions.view` (or `payroll.view` for payroll tables). No broad
   "authenticated can read" policies.
4. **Storage** — `finance-attachments` stays private; files served only via the gated route after a
   `finance.attachments.view` check + RLS on the row. No public URLs.

## 3. The MAGASIN write-without-read boundary (critical)

The shop employee must add sales/expenses yet never see the treasury. Achieved by:
- `magasin_sales` / `magasin_sale_lines`: INSERT allowed with `magasin.sale.create`; SELECT limited
  to `magasin.view` (their own operational data) — **not** the ledger.
- The resulting `financial_transactions` row is inserted by a SECURITY DEFINER function
  (`record_magasin_sale`) that checks `magasin.sale.create`. The ledger's **SELECT** policy still
  requires `finance.transactions.view`, so MAGASIN staff can create a row they cannot read back.
- The MAGASIN page computes its daily totals via a SECURITY DEFINER function scoped to
  `source='MAGASIN'` + that day, so it never exposes the global balance.

## 4. RLS policy summary (new/changed tables)

| Table | SELECT | INSERT / writes |
| --- | --- | --- |
| departments, financial_categories | any finance perm (`finance.view`) | `finance.categories.manage` |
| financial_transactions | `finance.transactions.view` | via SECURITY DEFINER fns only; **no** UPDATE/DELETE |
| magasin_sales / _lines | `magasin.view` or `finance.transactions.view` | `magasin.sale.create` (self rows) |
| financial_attachments | `finance.attachments.view` | finance/magasin/payroll write perms |
| employees | `employees.view` or `payroll.view` | `employees.manage` |
| payroll_rates | `payroll.view` | `payroll.manage` |
| piece_work_records | `payroll.view` | `payroll.manage` |
| payroll_periods / payroll_records | `payroll.view` | `payroll.manage` / `payroll.pay` |
| payroll_advances | `payroll.view` | `payroll.pay` |

Aggregation RPCs are SECURITY DEFINER and raise unless the caller holds the matching permission.

## 5. Server-side write integrity

- All money writes (income, expense, order payment, magasin sale, advance, salary payment,
  reversal) go through SECURITY DEFINER functions: permission re-check → validation → post + link +
  audit, atomically. The client never writes ledger fields directly.
- `created_by = auth.uid()` inside the function (never a client-supplied value).
- Idempotency/uniqueness prevents duplicate order payments, advances, and salary payments.

## 6. No hidden leaks (reviewed data paths)

Verify a non-finance user gets nothing via: dashboard aggregates (finance widgets already gated),
API/RPC responses (permission-raise + RLS), page source/SSR props (server gates before render),
client state, **realtime** (finance tables are not published; only `orders` is, and it has no money
columns), downloadable reports, and attachments (gated route). Reports are generated server-side —
raw ledger is never shipped to unauthorized clients.

## 7. Integrity & correction rules

- Append-only ledger; **no edits/deletes** of historical transactions (no UPDATE/DELETE policy).
- Corrections via `finance.reverse` → opposite-direction row referencing the original; both remain.
- Opening balance only via a dedicated `OPENING_BALANCE` transaction; balance is always derived.
- `numeric(12,2)` DZD; no floating-point accounting.

## 8. Validation (server-authoritative)

Amounts > 0; quantities > 0; rates ≥ 0; advance not exceeding configured/earned allowance; valid
employee/category/department/period FKs; attachment MIME (jpeg/png/webp/pdf) and size (≤ 5 MB);
dates within sane ranges. Zod on client for UX; SQL/CHECK + function guards are the source of truth.

## 9. Outstanding operational items (carried over)

Rotate the service-role key (was shared in chat) and set a real DB password before go-live; these
are unchanged by this module.
