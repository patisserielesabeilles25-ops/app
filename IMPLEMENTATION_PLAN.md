# Nahla Cake Panel — Implementation Plan

Phased, incremental delivery. Each phase lists: objective, files/modules, DB changes, UI,
security, tests, and completion criteria. Work proceeds one phase at a time; after each major
phase we run the app, run tests, inspect for errors, and document status. No phase is skipped
over broken functionality.

---

## Phase 0 — Environment & planning  ✅ (this deliverable)

- **Objective**: inspect environment, produce planning docs.
- **Done**: `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `SECURITY.md`,
  `IMPLEMENTATION_PLAN.md`.
- **Findings / blockers**:
  - Node.js **not installed** → must install Node 20+ LTS before Phase 1.
  - Empty project directory (only `.claude/`) → greenfield build.
  - Service-role key & DB password were shared in chat → **rotate before go-live** (see `SECURITY.md §0`).
- **Completion criteria**: docs reviewed and approved; Node installed; Supabase project reachable.

---

## Phase 1 — Project architecture / scaffolding

- **Objective**: Next.js + TS (strict) + Tailwind app skeleton; Supabase client factories; env strategy.
- **Files**: `package.json`, `tsconfig.json` (strict), `tailwind.config.ts`, `.env.example`,
  `.gitignore`, `src/lib/supabase/{server,client,service}.ts`, `src/middleware.ts`, base layout.
- **DB**: none yet.
- **Security**: `.env` git-ignored; `server-only` guard on service-role module; only `NEXT_PUBLIC_*` in browser.
- **Tests**: app builds; type-check + lint pass; Supabase connectivity smoke test (server).
- **Completion**: `dev` server runs; a page reads the Supabase session without secrets in the bundle.

## Phase 2 — Database schema & migrations

- **Objective**: all tables, constraints, indexes, RLS helpers, order-number function, balance view, seed.
- **Files**: `supabase/migrations/*.sql`, `supabase/seed.sql`, generated `src/types/database.ts`.
- **DB**: entire `DATABASE_DESIGN.md`; enable RLS everywhere; `has_permission()`, `auth_user_id()`,
  `allocate_order_number()`; seed roles (`main`, `operations`) + permissions.
- **Security**: RLS policies per §8 of DB design; append-only finance/audit.
- **Tests**: migrations apply cleanly; seed loads; RLS smoke tests (authorized vs not).
- **Completion**: schema reproducible from migrations; typed DB access compiles.

## Phase 3 — Authentication & authorization

- **Objective**: login, sessions, `requirePermission`, permission loading, protected routes.
- **Files**: `app/(auth)/login`, `lib/auth/{session,permissions}.ts`, middleware route guards,
  profile-creation trigger wiring.
- **DB**: trigger creating `profiles` on new auth user; verify `has_permission`.
- **Security**: server-side guards; deny-by-default; deactivated-user block.
- **Tests**: login/logout; protected route redirects; a permission-less user is refused a guarded action.
- **Completion**: auth works end-to-end; guard utility used by later phases.

## Phase 4 — App shell & navigation

- **Objective**: responsive layout, permission-aware sidebar, status-badge/dialog/empty/loading primitives.
- **Files**: `components/nav/*`, `components/ui/*`, `app/(app)/layout.tsx`.
- **UI**: sidebar sections from `PROJECT_SPEC §3`; nav items filtered by permission (cosmetic).
- **Security**: nav filtering is supplemental — routes still guarded server-side.
- **Tests**: nav renders per permission set; responsive at mobile/tablet/desktop breakpoints.
- **Completion**: shell navigable on all breakpoints.

## Phase 5 — Shop / order creation

- **Objective**: create custom orders with validation, image upload, atomic order number.
- **Files**: `app/(app)/shop/*`, `lib/orders/*`, `lib/validation/order.ts`, order server actions,
  `app/api/order-images/*` (signed URLs).
- **DB**: `orders`, `customers`, `order_images` writes; `allocate_order_number()`.
- **Security**: `orders.create`; Zod + CHECK validation; image type/size; private image bucket.
- **Tests**: create order → number generated; invalid amounts rejected; image upload/link works.
- **Completion**: order creation works against Supabase, no mock data.

## Phase 6 — Orders management

- **Objective**: list/detail/edit; send-to-lab; status visibility.
- **Files**: `app/(app)/orders/*`, order state machine in `lib/orders/state.ts`.
- **DB**: status transitions + `order_status_history`.
- **Security**: `orders.view/edit`; transition validation; finance fields hidden AND RLS-gated.
- **Tests**: send-to-lab sets `IN_PRODUCTION`; illegal transitions rejected; history recorded.
- **Completion**: full order lifecycle from shop side.

## Phase 7 — Laboratory

- **Objective**: card grid, three-dot details (permission-gated), production updates.
- **Files**: `app/(app)/laboratory/*`, `components/orders/OrderCard.tsx`.
- **DB**: `production.update` transitions to `READY`, `ready_at`.
- **Security**: card finance details require finance permission at data layer (not just UI).
- **Tests**: lab sees sent orders; READY reflects in shop; non-finance user sees no amounts even via API.
- **Completion**: lab workflow operational.

## Phase 8 — Annual calendar

- **Objective**: year/month/day view on delivery date; day drill-down.
- **Files**: `app/(app)/calendar/*`, `components/calendar/*`.
- **DB**: indexed queries by `delivery_date`.
- **Security**: `calendar.view`.
- **Tests**: orders appear on correct day; multi-order days marked; day view lists details; mobile OK.
- **Completion**: calendar accurate and responsive.

## Phase 9 — Delivery

- **Objective**: delivery queue and transitions `READY → OUT_FOR_DELIVERY → DELIVERED`.
- **Files**: `app/(app)/delivery/*`, `deliveries` server actions.
- **DB**: `deliveries` + order timestamps.
- **Security**: `delivery.view/update`.
- **Tests**: full delivery transition chain with timestamps.
- **Completion**: delivery workflow operational.

## Phase 10 — Finance / cash register

- **Objective**: ledger income/expense, derived balance, receipts, order-payment postings.
- **Files**: `app/(app)/finance/*`, `lib/finance/*`, finance server actions,
  `app/api/finance-attachments/*` (gated signed URLs).
- **DB**: `financial_transactions`, `financial_attachments`, `current_balance` view.
- **Security**: finance permissions at app + RLS; private attachments; append-only ledger.
- **Tests**: advance→income, final→income, expense→balance decrease; non-finance user fully blocked
  (page, API, rows, attachment); no full total posted at order creation.
- **Completion**: finance auditable and correct.

## Phase 11 — Ready-made cake production

- **Objective**: daily S/M/L quantity entry by date.
- **Files**: `app/(app)/ready-made/*`.
- **DB**: `ready_made_daily_production` (unique per date).
- **Security**: `production.update` to write; view per dashboard/lab perms.
- **Tests**: create/update a day's quantities; one row per date enforced.
- **Completion**: daily production recorded.

## Phase 12 — Realtime synchronization

- **Objective**: order-status realtime to shop/lab/delivery/dashboard.
- **Files**: `components/realtime/*`, subscription hooks.
- **Security**: only non-sensitive status broadcast; finance excluded.
- **Tests**: status change propagates without refresh; reconnect/refetch on disconnect.
- **Completion**: realtime status live where specified.

## Phase 13 — Auditability

- **Objective**: complete `audit_log` coverage for important actions.
- **Files**: `lib/audit/*` wired into order/finance/user server actions.
- **DB**: `audit_log` inserts on tracked actions.
- **Security**: append-only; admin-only read.
- **Tests**: each tracked action writes an audit row with correct actor.
- **Completion**: audit trail verified.

## Phase 14 — Testing

- **Objective**: consolidate unit (Vitest) + E2E (Playwright) per `PROJECT_SPEC §14` scenarios.
- **Scenarios**: custom-order lifecycle; delivery chain; finance postings; non-financial-user
  lockout; user-management + permission enforcement.
- **Completion**: suites green in CI.

## Phase 15 — Security review

- **Objective**: verify `SECURITY.md` end-to-end.
- **Checks**: no secrets in client bundle; RLS on all tables; every action guarded; storage private;
  service-role server-only; **keys rotated**.
- **Completion**: checklist passes.

## Phase 16 — Production readiness

- **Objective**: deploy config, env in host secret store, migrations in CI, error monitoring,
  final QA on desktop/tablet/mobile.
- **Completion**: app deployed, secure, responsive, docs updated.

---

## Cross-cutting standards (every phase)

- Strict TypeScript; small focused modules; reusable components; centralized validation, auth,
  status definitions, and finance calculations.
- No mock data in final implementation; no hardcoded credentials/permissions/balances/user IDs.
- Handle loading/empty/error/success states; confirmation dialogs for destructive actions.
- After each major phase: run app, run tests, inspect errors, document completed + remaining.
