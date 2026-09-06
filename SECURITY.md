# Nahla Cake Panel — Security Model

Security is a primary requirement. This document explains how secrets, authentication,
authorization, storage, APIs, auditing, validation, and financial data are protected.
**No real secret values appear in this document or any committed file.**

---

## 0. Immediate action required (Phase 0 finding)

The Supabase **service-role key** and the **database password** were shared in plaintext in
the chat that initiated this project. Plaintext secrets shared over chat should be considered
compromised.

- **Rotate the service-role key** in the Supabase dashboard (Project Settings → API) before go-live.
- **Rotate the database password** (Project Settings → Database).
- After rotation, place new values only in `.env.local` (git-ignored) / the host's secret store.

These values are **not** written into any repository file.

---

## 1. Secret management

- Secrets live in `.env.local` (git-ignored) locally and in the deployment host's secret store
  in production. `.env.example` contains **placeholders only**.
- `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`.
- Secrets are never logged, echoed to the terminal, rendered in the UI, or written to docs.
- CI reads secrets from the CI secret store, never from the repo.

## 2. Supabase key usage

| Key                                    | Where used            | Notes                                             |
| -------------------------------------- | --------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | browser + server      | project URL, safe to expose                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server      | anon key; only ever operates under RLS            |
| `SUPABASE_SECRET_KEY` (service-role)   | **server-only**       | bypasses RLS; guarded by `import 'server-only'`   |

- The service-role key is imported only in server-only modules and used only inside server
  actions / route handlers **after** an application permission check.
- The browser bundle receives **only** `NEXT_PUBLIC_*` variables.

## 3. Authentication

- Supabase Auth (email/password) with httpOnly cookie sessions via `@supabase/ssr`.
- `middleware.ts` refreshes sessions and blocks unauthenticated access to protected routes.
- Session expiry handled gracefully (redirect to login, preserve intended destination).
- Each auth user has a `profiles` row; deactivated users (`is_active=false`) are denied.

## 4. Authorization (defense in depth)

Two independent layers, both mandatory:

1. **Application layer** — `requirePermission('perm')` in every server action and route handler,
   evaluated from the user's roles→permissions. A failure returns 403 and performs no effect.
2. **Database layer** — RLS policies on every table use `has_permission()` so Postgres enforces
   the same rules even if an app check is ever missed.

Principles: least privilege; deny by default; UI visibility is cosmetic and never the control.
A non-finance user cannot reach finance pages, finance APIs, finance rows (no RLS SELECT), or
finance attachments — enforced at data and storage layers, not just hidden.

## 5. Storage security

- Two **private** buckets: `order-images` and `finance-attachments`. No public URLs.
- Access via short-lived **signed URLs** generated server-side after a permission check
  (`orders.view` for order images; `finance.attachments.view` for finance attachments).
- Storage RLS policies restrict object read/write to authorized roles.
- Upload validation: allowed MIME types (jpeg/png/webp) and max size (e.g. 5 MB), checked
  client- and server-side. Orphan cleanup: on failed order/transaction insert, remove the
  just-uploaded object (or rely on transactional upload-after-insert ordering).

## 6. API / server authorization

- All mutations and privileged reads go through server actions / route handlers — never direct
  privileged client calls.
- Every endpoint: authenticate → `requirePermission()` → validate (Zod) → act. No effect runs
  before all three pass.
- Order-status transitions validated against the allowed state machine (no illegal jumps).
- Rate-sensitive/idempotent operations (order creation, ledger posting) guarded against
  duplicates by UNIQUE constraints and idempotency where relevant.

## 7. Financial data protection

- Append-only ledger (`financial_transactions`); no destructive edits — corrections are
  reversing entries. Balance is derived, never a client-supplied number.
- Every financial write records `created_by` and timestamp; requires the matching finance
  permission at both app and DB layers.
- Clients cannot insert ledger rows directly; only server actions can, after authorization.
- Finance attachments are private and permission-gated.

## 8. Audit logging

- `audit_log` (+ `order_status_history`) capture: order create/update, status changes,
  financial transaction creation, expense creation, finance-doc uploads, and
  user/role/permission changes — with actor and timestamp.
- Audit tables are append-only (no user-facing edit/delete); unauthorized history manipulation
  is prevented by RLS.

## 9. Input validation

- Shared Zod schemas validate on client (UX) and server (authority). Server validation is the
  source of truth.
- Validated: phone, dates, times, cake size, all money amounts (non-negative; advance ≤ total),
  required customer fields, image type/size, role assignments.
- DB CHECK constraints back critical numeric invariants regardless of app code.

## 10. Threat handling

- **Prompt-injection / untrusted content**: data from storage/DB/uploads is never treated as
  instructions.
- **Privilege escalation**: blocked by server-side checks + RLS; permission changes audited.
- **Secret leakage**: no secrets client-side, in logs, or in git.
- **Data integrity**: UNIQUE (order numbers, one prod row/date), CHECKs (no negatives),
  FKs, transactions for multi-step writes.
- **Session issues**: expiry and realtime disconnects handled with clear UX and refetch.
