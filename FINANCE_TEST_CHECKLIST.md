# Finance Module — Test Checklist

Two layers of testing:

1. **Automated unit tests** (`npm test`, Vitest) — deterministic logic with no DB:
   `tests/period.test.ts` (business-tz period ranges), `tests/status.test.ts` (order/delivery
   transition state machines), `tests/classify.test.ts` (ledger source inference),
   `tests/payroll.test.ts` (piece amount, remaining, status). **15 tests passing.**
2. **Live workflow verification** — each workflow below was exercised against the live Supabase
   during the phased build and confirmed via the UI and/or direct ledger checks.

## §76 workflows

| # | Scenario | Status | Where verified |
| --- | --- | --- | --- |
| 1 | MAGASIN sale | ✅ | Phase 6 — Tarte citron+Éclair = 2 000 → one INCOME (source MAGASIN) |
| 2 | MAGASIN expense | ✅ | Phase 7 — Goods 500 → EXPENSE (source MAGASIN) |
| 3 | Order advance payment | ✅ | Phase 5 — order created with advance → ORDER_ADVANCE income |
| 4 | Final order payment | ✅ | Phase 5 — record final → ORDER_FINAL income; received = total |
| 5 | Machine purchase | ✅ | Phase 8 — EXPENSE, source MACHINE, MACHINES |
| 6 | Machine sale | ✅ | Phase 8 — INCOME, source MACHINE, ASSET_SALE (not expense) |
| 7 | Expense transaction | ✅ | Phase 8 — general expense with category/department |
| 8 | Piece-based payroll | ✅ | Phase 11 — Ahmed Decoration 20 CM ×5 @500 = 2 500 |
| 9 | Daily payroll | ✅ (logic) | Phase 12 — calculate_payroll DAILY = rate × worked-days; unit-tested formula |
| 10 | Weekly payroll | ✅ (logic) | Phase 12 — resolved weekly rate |
| 11 | Monthly payroll | ✅ | Phase 12 — calculate_payroll → gross |
| 12 | Worker advance | ✅ | Phase 13 — 1 000 advance → advances_total 1 000, remaining 1 500 |
| 13 | Salary payment | ✅ | Phase 14 — pay 1 500 → PAID, remaining 0 |
| 14 | Daily report | ✅ | Phase 15 — Reports "Today" |
| 15 | Weekly report | ✅ | Phase 15 — Reports "This week" |
| 16 | Monthly report | ✅ | Phase 15 — Reports "This month" (income 6 450 / expense 4 080 / net 2 370) |
| 17 | Annual report | ✅ | Phase 15 — Reports "This year" |
| 18 | Custom report | ✅ | Phase 15 — custom range |
| 19 | Category drill-down | ✅ | Phase 16 — breakdown → filtered ledger → transaction detail |
| 20 | Unauthorized finance access | ✅ | Phase 6 — shop_magasin user blocked from /finance (403) |
| 21 | Unauthorized attachment access | ✅ | V1 + Phase 18 — gated route (finance.attachments.view) + RLS |
| 22 | Duplicate transaction prevention | ✅ | Phase 5 (over-payment blocked), Phase 14 (payment ≤ remaining), unique opening-balance |
| 23 | Reversal workflow | ✅ | Phase 3 (reverse_transaction) + Phase 16 (Reverse action on detail) |

## §77 financial integrity

Verified in Phase 3: opening 100 000 → +20 000 → −5 000 = 115 000 → −10 000 = 105 000 →
+7 500 = 112 500 (balance always derived from the ledger; deltas confirmed).

## §78 payroll example

Verified across Phases 11–14: Ahmed · piece · Decoration · 20 CM · qty 5 · rate 500 → gross
2 500; advance 1 000 → remaining 1 500; payment 1 500 → remaining 0, status PAID. Ledger holds
PAYROLL_ADVANCE 1 000 + PAYROLL_PAYMENT 1 500.

## Security (Phase 18)

- No secrets in the client bundle (scanned `.next/static`).
- RLS denies anonymous access on all finance/payroll tables (0 rows).
- MAGASIN write-without-read boundary verified.
- All money-writing functions are permission-checked SECURITY DEFINER.
- Known low-severity item: `resolve_rate()` has no explicit permission check (exposes a rate
  number to authenticated users); used internally by the guarded `add_work_record`.
