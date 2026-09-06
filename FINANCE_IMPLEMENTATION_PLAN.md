# Finance Module — Implementation Plan

Incremental, one phase at a time. After each phase: type-check, lint, verify migrations + RLS,
verify calculations, verify UI permission gating, fix errors before continuing. Each DB phase ships
a version-controlled migration (`0014+`) and, since direct DB access is via the SQL Editor, a small
`apply_financeNN.sql` for the user to run. Nothing sensitive is committed.

Legend: **DB** = migration, **SVR** = server actions/RPCs, **UI** = pages/components, **T** = tests.

---

### Phase 1 — Architecture ✅ (this deliverable)
Docs: FINANCE_ARCHITECTURE / FINANCE_DATABASE_DESIGN / FINANCE_SECURITY / FINANCE_IMPLEMENTATION_PLAN.
No code. Await approval.

### Phase 2 — Categories & departments
- **DB**: `departments`, `financial_categories` (+ seed §24 & income cats); RLS; new permissions
  seeded and granted to `main`; optional `shop_magasin` role.
- **UI**: read-only catalog under Finance → (extend `/permissions`-style view); management for
  `finance.categories.manage`.
- **T**: seed present; RLS denies non-finance.
- **Done when**: categories/departments exist, gated, configurable.

### Phase 3 — Ledger extension
- **DB**: add `department, source, category_id, employee_id, magasin_sale_id, payroll_record_id,
  payroll_advance_id, notes` to `financial_transactions`; backfill `source/department/category_id`
  from existing rows (order advances → source=ORDER/dept SHOP/cat ORDER_PAYMENT); add indexes;
  `finance_balance()`; opening-balance function.
- **SVR**: generic `post_transaction()` SECURITY DEFINER (income/expense with full classification +
  optional attachment + audit); `reverse_transaction()`.
- **T**: integrity test (§77) — opening 100k, +20k, −5k ⇒ 115k, −payroll 10k ⇒ 105k, +magasin 7.5k
  ⇒ 112.5k.

### Phase 4 — Central cash register calculations
- **SVR/UI**: Finance **Overview** dashboard — balance, today/week/month/year income/expense/net,
  income & expense & department breakdowns, recent transactions. Server-side aggregation RPCs
  (`finance_summary/by_category/by_department/by_source`), business-tz period math.
- **T**: totals match seeded ledger; unauthorized denied.

### Phase 5 — Order payment integration
- **DB/SVR**: `record_order_payment(order_id, amount, kind[ADVANCE|FINAL])` → INCOME source=ORDER,
  idempotent (no duplicate advance/final); keeps `order_financials` consistent; delivery fee posts
  separately (source=DELIVERY) when received.
- **UI**: "Record payment" on order detail.
- **T**: advance then final = total received; duplicate prevented; delivery fee separable.

### Phase 6 — MAGASIN sales
- **DB**: `magasin_sales`, `magasin_sale_lines`; RLS (write=magasin.sale.create, read=magasin.view).
- **SVR**: `record_magasin_sale(lines[])` — recompute totals server-side → one INCOME row
  (source=MAGASIN); daily-summary RPC scoped to MAGASIN.
- **UI**: `/finance/magasin` fast entry + today's sales + daily summary (no treasury exposure).
- **T**: line/day totals server-recomputed; posts to central ledger; shop user cannot read balance.

### Phase 7 — MAGASIN expenses
- **SVR/UI**: shop expense entry (source=MAGASIN, dept SHOP) + receipt; included in daily net.
- **T**: expense posts; net movement correct.

### Phase 8 — General expenses
- **UI/SVR**: full expense entry with category (Rent/Utilities/Goods/Machines/Car/Personal/
  Investment/Insurance/Taxes/Other), department, attachment. Machine **sale = income**.
- **T**: each category posts with correct classification; machine sale is INCOME.

### Phase 9 — Attachments
- Reuse `financial_attachments` + gated route for all finance transactions; add/remove with audit.
- **T**: unauthorized attachment access blocked; upload validation.

### Phase 10 — Employees & payroll architecture
- **DB**: `employees`, `payroll_rates`, `payroll_periods`, `payroll_records`, `payroll_advances`,
  `piece_work_records`; RLS. **SVR**: employee CRUD, rate CRUD. **UI**: Payroll → Employees, Rates.
- **T**: salary data hidden without `payroll.view`.

### Phase 11 — Piece-based payroll
- **SVR**: rate resolution (employee>job × category × size × effective date); `add_work_record()`
  stores inputs + computed amount. **UI**: work records entry. **T**: §78 (Ahmed decoration 20cm ×5
  @500 = 2,500).

### Phase 12 — Daily/weekly/monthly payroll
- **SVR**: `calculate_payroll(employee, period)` → gross from method; record state
  DRAFT→CALCULATED. **UI**: periods + calculation. **T**: each method's gross deterministic.

### Phase 13 — Worker advances
- **SVR**: `record_payroll_advance()` → EXPENSE (source=PAYROLL) + advance row; multiple advances;
  never overwritten; updates `advances_total`. **T**: §43/§44 (multiple advances reduce net).

### Phase 14 — Payroll payments
- **SVR**: `record_payroll_payment()` → EXPENSE + `paid_amount`; state → PARTIALLY_PAID/PAID;
  duplicate-payment guard. **UI**: employee payroll detail (gross/advances/paid/remaining/history).
- **T**: §45/§46 state machine; remaining correct.

### Phase 15 — Reports (daily/weekly/monthly/annual/custom)
- **UI**: report pages powered by the same RPCs; period presets + custom range (business tz);
  category/department/source breakdowns; counts; opening/closing where derivable.
- **T**: §18–22 figures reconcile to ledger.

### Phase 16 — Drill-down analytics
- Every summary value → filtered transaction list → transaction detail (§51). Payroll & category &
  department drill-downs. **T**: drill paths reconcile.

### Phase 17 — Audit trail
- Ensure all finance/magasin/payroll actions write `audit_log`; Finance → Audit History view.
- **T**: each action produces an audit row with actor/entity/metadata.

### Phase 18 — Security review
- Verify §75 leak paths, RLS on every finance table, SECURITY DEFINER guards, gated storage,
  MAGASIN write-without-read, no realtime finance exposure. Client-bundle secret scan.

### Phase 19 — Automated tests
- Implement §76 scenarios (1–23) + §77 integrity + §78 payroll as a runnable suite (Vitest against
  a test Supabase project / seeded fixtures). Wire `npm test`.

### Phase 20 — Production hardening
- Indexes verified, query performance, empty/error states, responsive pass, docs update, final
  build + lint. Regenerate combined `apply_all.sql`.

---

## Cross-cutting
- Reuse existing RBAC/orders/ledger/storage/audit — no duplication.
- Money `numeric(12,2)` DZD; server-recompute all totals; business timezone for period boundaries.
- Append-only ledger; corrections via reversal; balance always derived.
- Each phase gated by permission at UI + server + RLS; verified before moving on.
