# Finance Module — Database Design

New/extended entities for the finance expansion. Builds on the existing schema
(`DATABASE_DESIGN.md`). All new tables get RLS (see `FINANCE_SECURITY.md`). Money =
`numeric(12,2)` DZD, `amount > 0` (direction from `type`). New migrations start at `0014`.

---

## 1. Configuration tables

### departments  *(configurable; seeds the fixed list)*
- `id uuid PK`, `key text UNIQUE` (SHOP, LABORATORY, DELIVERY, ADMINISTRATION, GENERAL, INVESTMENT)
- `name text`, `is_active boolean default true`, `sort int default 0`

### financial_categories  *(configurable; supports subcategories)*
- `id uuid PK`, `key text UNIQUE`, `name text`
- `direction text CHECK (direction IN ('INCOME','EXPENSE','BOTH'))`
- `parent_id uuid FK financial_categories(id) NULL`  (subcategory tree, e.g. CAR → fuel/maintenance)
- `is_system boolean default false`, `is_active boolean default true`
- **Seed** (§24): SHOP_RENT, LAB_RENT, ELECTRICITY, GAS, WATER, GOODS, MACHINES, CAR, PERSONAL,
  INVESTMENT, INSURANCE, TAXES, PAYROLL, plus income cats ORDER_PAYMENT, MAGASIN_SALE, ASSET_SALE,
  DELIVERY_FEE, OTHER_INCOME, and OTHER.

---

## 2. Central ledger (extend the existing table)

### financial_transactions  *(EXTENDED, still append-only)*
Existing columns kept: `id, type (INCOME|EXPENSE), category (legacy text — retained/backfilled),
amount, occurred_at, order_id, item_name, description, reverses_transaction_id, created_by,
created_at`. **Added:**
- `department text NOT NULL default 'GENERAL'` (FK-checked against `departments.key` via trigger or soft ref)
- `source text NOT NULL default 'OTHER'` CHECK in (ORDER, MAGASIN, PAYROLL, PURCHASE, MACHINE, DELIVERY, INVESTMENT, OPENING_BALANCE, REVERSAL, OTHER)
- `category_id uuid FK financial_categories(id) NULL` (new canonical category; legacy `category` text kept for back-compat and backfilled)
- `employee_id uuid FK employees(id) NULL`
- `magasin_sale_id uuid FK magasin_sales(id) NULL`
- `payroll_record_id uuid FK payroll_records(id) NULL`
- `payroll_advance_id uuid FK payroll_advances(id) NULL`
- `notes text NULL`
- **Indexes (add):** `occurred_at`, `type`, `category_id`, `department`, `source`, `employee_id`,
  `magasin_sale_id`, `payroll_record_id`, `created_by`. (existing: occurred_at, type, category, order_id)
- Still **no UPDATE/DELETE** for anyone (RLS); corrections = reversing rows.
- Idempotency: partial UNIQUE indexes to block duplicates, e.g. one payment row per
  `(order_id, category)` where source='ORDER' for ORDER_ADVANCE/ORDER_FINAL semantics; one row per
  `payroll_advance_id`; one payment per `payroll_record_id` payment slice (see §5/§6).

### Opening balance & derived balance
- Opening balance = a single row `source='OPENING_BALANCE'`, `type='INCOME'`.
- `finance_balance()` (SECURITY DEFINER, guarded) → `Σ(type=INCOME) − Σ(type=EXPENSE)` over all rows
  (opening balance included as an INCOME row). Replaces `current_balance()`.

---

## 3. MAGASIN (operational sales/expenses → central ledger)

### magasin_sales  *(header; one operational sale event)*
- `id uuid PK`, `sale_date date NOT NULL`, `department text default 'SHOP'`
- `total_amount numeric(12,2) NOT NULL default 0` (server-recomputed from lines)
- `created_by uuid FK profiles`, `created_at timestamptz default now()`

### magasin_sale_lines
- `id uuid PK`, `sale_id uuid FK magasin_sales ON DELETE CASCADE`
- `product_name text NOT NULL`, `quantity numeric(12,3) NOT NULL CHECK (>0)`
- `unit_price numeric(12,2) NOT NULL CHECK (>=0)`
- `line_total numeric(12,2) GENERATED ALWAYS AS (round(quantity*unit_price,2)) STORED`

Posting a sale creates ONE `financial_transactions` row (INCOME, source=MAGASIN, category
MAGASIN_SALE, department SHOP, `magasin_sale_id` set), amount = server-summed line totals.
MAGASIN expenses reuse the generic expense flow with source=MAGASIN, department SHOP.

---

## 4. Employees & rates

### employees
- `id uuid PK`, `code text UNIQUE NULL`, `full_name text NOT NULL`, `phone text NULL`
- `job text NULL` (Decoration, Montage, …), `department text default 'LABORATORY'`
- `payment_method text NOT NULL CHECK in ('PIECE_BASED','DAILY','WEEKLY','MONTHLY')`
- `is_active boolean default true`, `created_by`, `created_at`, `updated_at`

### payroll_rates  *(flexible resolution: employee/job × work_category × size × effective date)*
- `id uuid PK`
- `employee_id uuid FK employees NULL` (null = applies by job)
- `job text NULL`, `work_category text NULL`, `product_size text NULL` (Small/Medium/Large or cm bucket)
- `rate numeric(12,2) NOT NULL CHECK (>=0)`
- `rate_kind text CHECK in ('PIECE','DAILY','WEEKLY','MONTHLY')`
- `effective_from date NOT NULL default now()`, `is_active boolean default true`
- Resolution picks the most specific active rate (employee > job) with the latest
  `effective_from <= work_date`.

---

## 5. Payroll records & work

### payroll_periods
- `id uuid PK`, `period_type text CHECK in ('DAILY','WEEKLY','MONTHLY')`
- `start_date date`, `end_date date`, `label text`, `UNIQUE(period_type,start_date,end_date)`

### piece_work_records  *(store inputs, not just totals — auditable)*
- `id uuid PK`, `employee_id FK employees`, `work_date date NOT NULL`
- `order_id uuid FK orders NULL`, `work_category text`, `product_size text`
- `quantity numeric(12,3) CHECK (>0)`, `applied_rate numeric(12,2) CHECK (>=0)`
- `amount numeric(12,2) GENERATED ALWAYS AS (round(quantity*applied_rate,2)) STORED`
- `payroll_record_id uuid FK payroll_records NULL` (set when rolled into a period)
- `entered_by`, `created_at`

### payroll_records  *(one per employee per period; state machine)*
- `id uuid PK`, `employee_id FK employees`, `period_id FK payroll_periods`
- `payment_method text`, `gross_amount numeric(12,2) default 0`
- `advances_total numeric(12,2) default 0`, `adjustments numeric(12,2) default 0`
- `paid_amount numeric(12,2) default 0`
- `remaining numeric(12,2) GENERATED ALWAYS AS (gross_amount + adjustments - advances_total - paid_amount) STORED`
- `status text CHECK in ('DRAFT','CALCULATED','PARTIALLY_PAID','PAID','CANCELLED') default 'DRAFT'`
- `UNIQUE(employee_id, period_id)`, `created_by`, timestamps

### payroll_advances  *(never overwritten; multiple per period)*
- `id uuid PK`, `employee_id FK employees`, `amount numeric(12,2) CHECK (>0)`
- `advance_date date`, `payroll_record_id uuid FK payroll_records NULL`
- `transaction_id uuid FK financial_transactions NULL` (the EXPENSE posting), `created_by`, `created_at`

**Flows:** creating an advance → EXPENSE ledger row (source=PAYROLL) + advance row; it adds to the
record's `advances_total`. A salary payment → EXPENSE ledger row (source=PAYROLL) linked via
`payroll_record_id`, increments `paid_amount`. `remaining = gross + adjustments − advances − paid`.
Duplicate payment/advance blocked by unique/idempotency constraints.

---

## 6. Attachments & audit (reuse)

- `financial_attachments` (existing) — now referenced by any finance transaction; served only via
  the gated route. Metadata: file id, path, bucket, mime, size, uploaded_by, created_at,
  transaction_id.
- `audit_log` (existing) — finance actions write: `finance.transaction.create`,
  `finance.transaction.reverse`, `finance.attachment.add/remove`, `magasin.sale.create`,
  `magasin.expense.create`, `payroll.calculate`, `payroll.advance.create`, `payroll.payment.create`,
  `finance.category.update`, `payroll.rate.update`, plus existing user/permission changes.

---

## 7. Aggregation RPCs (SECURITY DEFINER, guarded)

- `finance_balance()` → numeric
- `finance_summary(p_from timestamptz, p_to timestamptz)` → income, expense, net, income_count, expense_count
- `finance_by_category(p_from, p_to)` → rows (category_id, name, direction, total)
- `finance_by_department(p_from, p_to)` → rows (department, income, expense, net)
- `finance_by_source(p_from, p_to)` → rows (source, income, expense, net)
- `payroll_summary(p_from, p_to)` → by employee/department/method totals, advances, paid, remaining

Each raises unless the caller has the required finance permission (defense-in-depth with RLS).
Period bounds are computed in `Africa/Algiers` by the caller and passed as timestamptz.

---

## 8. Entity relationships (summary)

```
financial_transactions ──┬─ order_id ───────────► orders
                         ├─ employee_id ────────► employees
                         ├─ magasin_sale_id ────► magasin_sales ──< magasin_sale_lines
                         ├─ payroll_record_id ──► payroll_records ──► payroll_periods
                         ├─ payroll_advance_id ─► payroll_advances ─► employees
                         ├─ category_id ────────► financial_categories (self-ref parent)
                         ├─ department (key) ───► departments
                         └─ created_by ─────────► profiles
employees ──< payroll_rates,  ──< piece_work_records,  ──< payroll_records ──< payroll_advances
financial_attachments ── transaction_id ─► financial_transactions
```

## 9. Integrity checklist

- CHECK: all amounts/quantities/rates ≥ 0 (or > 0 where required); advance ≤ configured allowance
  is validated server-side.
- UNIQUE / partial-unique: order payment slices, one advance row per `payroll_advance_id`, payment
  idempotency per record, `(employee_id, period_id)` payroll record, department/category keys.
- Generated columns for `line_total`, work-record `amount`, payroll `remaining`.
- FKs everywhere; no free-text IDs where a relation exists.
- Append-only ledger; reversal via `reverses_transaction_id`.
