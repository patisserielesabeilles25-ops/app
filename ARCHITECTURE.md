# Nahla Cake Panel — Architecture

Companion to `PROJECT_SPEC.md`. Describes *how* the system is built. Security specifics live in
`SECURITY.md`; data model in `DATABASE_DESIGN.md`.

---

## 1. Technology stack

| Concern            | Choice                                                        |
| ------------------ | ------------------------------------------------------------- |
| Runtime            | Node.js 20+ LTS                                               |
| Framework          | Next.js (App Router) + TypeScript (`strict`)                  |
| Styling            | Tailwind CSS                                                  |
| Backend platform   | Supabase: PostgreSQL, Auth, Storage, Realtime                 |
| DB access (client) | `@supabase/supabase-js` via `@supabase/ssr` (cookie sessions) |
| DB access (server) | Supabase server client; service-role client server-only      |
| Migrations         | Supabase CLI SQL migrations (version controlled)              |
| Validation         | Zod schemas shared by client and server                      |
| Testing            | Vitest (unit) + Playwright (E2E) — see `IMPLEMENTATION_PLAN`  |

> **Environment note:** Node.js is **not yet installed** on the current machine (Phase 0
> finding). Node 20+ LTS must be installed before Phase 1 scaffolding can begin.

---

## 2. High-level shape

```
Browser (Next.js client components)
  │  cookie session (Supabase Auth via @supabase/ssr)
  ▼
Next.js server (App Router)
  ├─ Server Components ......... read data as the signed-in user (RLS applies)
  ├─ Server Actions / Route Handlers  ... all writes + privileged reads
  │     └─ authorization guard (requirePermission) runs BEFORE any effect
  ▼
Supabase
  ├─ PostgreSQL + Row Level Security (defense in depth)
  ├─ Auth (JWT / cookie sessions)
  ├─ Storage (order-images: gated; finance-attachments: private)
  └─ Realtime (order status broadcast)
```

Two layers of authorization, always both present:
1. **Application layer** — `requirePermission()` in every server action / route handler.
2. **Database layer** — RLS policies keyed on the user's permissions (via SQL helper functions).

The browser never enforces security; UI gating is cosmetic only.

---

## 3. Server / client boundary

- **Client components**: forms, interactive cards, calendar UI, realtime subscriptions.
  They hold only the **publishable** Supabase key and the user's session cookie.
- **Server components**: initial data fetch for a page, run with the user's session (RLS applies).
- **Server actions / route handlers**: the *only* place writes happen and the *only* place the
  **service-role** key may be used — and only after `requirePermission()` passes. Service-role
  bypasses RLS, so it is used sparingly (order-number allocation, ledger posting, admin ops)
  and always behind an explicit permission check.

**Rule:** no mutation from the client directly against Supabase for anything sensitive
(finance, roles, permissions, status transitions). Those go through server actions.

---

## 4. Authentication

- Supabase Auth with email/password (magic-link optional later).
- Sessions stored in httpOnly cookies via `@supabase/ssr`; refreshed in middleware.
- `middleware.ts` refreshes the session and redirects unauthenticated users away from
  protected routes.
- A `profiles` row is created for each auth user (trigger on `auth.users` insert) holding
  display name, active flag, etc.

## 5. Authorization (RBAC)

- Tables: `roles`, `permissions`, `role_permissions`, `user_roles` (see `DATABASE_DESIGN.md`).
- Permissions are string capabilities (e.g. `finance.view`, `orders.create`).
- **Server**: `getSessionUser()` → `getUserPermissions(userId)` → `requirePermission('x')`
  throws/redirects (403) if missing. A central `lib/auth/permissions.ts` module owns this.
- **Database**: SQL functions `auth_user_id()`, `has_permission(text)` used inside RLS policies
  so the DB enforces the same rules independently.
- Permissions are cached per request, never trusted from the client.

## 6. Storage

Two buckets:

| Bucket                | Visibility | Access pattern                                             |
| --------------------- | ---------- | --------------------------------------------------------- |
| `order-images`        | private    | signed URLs issued to users with `orders.view`            |
| `finance-attachments` | private    | signed URLs issued **only** to users with finance perms   |

- Only object **metadata / path** is stored in Postgres (`order_images`, `financial_attachments`);
  binaries never go in the DB.
- Uploads validated for MIME type (jpeg/png/webp) and size (e.g. ≤ 5 MB) on client and server.
- Signed URLs are short-lived and generated server-side after a permission check.
- Storage RLS policies restrict object access to authorized roles.

## 7. Realtime

- Supabase Realtime on `orders` (status column). Shop, laboratory, delivery, and dashboard
  views subscribe to relevant changes so status updates (e.g. `IN_PRODUCTION → READY`) propagate
  without manual refresh.
- Realtime is **not** used everywhere — only where it materially improves workflow. It carries
  non-sensitive status data; finance is not broadcast.
- Subscriptions handle disconnect/reconnect and fall back to on-focus refetch.

## 8. Finance architecture

- Append-only `financial_transactions` ledger; balance derived via a SQL view / aggregate
  (`current_balance`). No standalone mutable balance field is authoritative.
- All finance writes go through server actions that: check permission → validate (Zod) →
  insert ledger row(s) in a DB transaction → link attachments. Order payments post income
  entries for actual money received (advance, then final), never the full total at creation.
- Corrections are reversing entries, not row edits/deletes.

## 9. Environment variables

| Variable                              | Exposure       | Purpose                          |
| ------------------------------------- | -------------- | -------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`            | browser + server | Supabase project URL           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`| browser + server | anon/publishable key           |
| `SUPABASE_SECRET_KEY`                 | **server only** | service-role key (privileged)   |

- Values live in `.env.local` (git-ignored). `.env.example` holds placeholders only.
- `NEXT_PUBLIC_*` is the *only* prefix shipped to the browser. `SUPABASE_SECRET_KEY` is read
  exclusively in server-only modules (guarded by `import 'server-only'`).
- Never log or render secret values.

## 10. Folder structure (target)

```
/
├─ .env.example
├─ supabase/
│  ├─ migrations/            # version-controlled SQL migrations
│  └─ seed.sql               # roles, permissions, role_permissions seed (no secrets)
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/
│  │  ├─ (app)/
│  │  │  ├─ dashboard/
│  │  │  ├─ shop/
│  │  │  ├─ orders/
│  │  │  ├─ laboratory/
│  │  │  ├─ calendar/
│  │  │  ├─ delivery/
│  │  │  ├─ finance/
│  │  │  ├─ ready-made/
│  │  │  ├─ users/  roles/  permissions/  settings/
│  │  └─ api/                # route handlers (signed URLs, privileged ops)
│  ├─ components/            # reusable UI (cards, badges, dialogs, forms)
│  ├─ lib/
│  │  ├─ supabase/           # server, client, service-role factories
│  │  ├─ auth/               # session + permission guards
│  │  ├─ orders/             # order state machine, order-number logic
│  │  ├─ finance/            # ledger + balance calculations
│  │  └─ validation/         # Zod schemas (shared)
│  ├─ types/                 # generated DB types + domain types
│  └─ middleware.ts
└─ tests/                    # vitest + playwright
```

## 11. Deployment assumptions

- Target: Vercel (Next.js) + Supabase (managed). Any Node 20+ host works.
- Server env vars set in the host dashboard; `SUPABASE_SECRET_KEY` marked server-only/secret.
- Migrations applied via Supabase CLI in CI or manually before deploy.
- No secrets in the repo or client bundle.

## 12. Key architectural decisions

- **Server actions as the write boundary** — keeps authorization and validation centralized and
  prevents client-side privilege escalation.
- **Ledger over mutable balance** — auditability and integrity for finance.
- **RLS + app checks (belt and suspenders)** — DB stays safe even if an app check is missed.
- **Zod schemas shared** — one validation definition for both sides.
- **Extensible enums/tables** (order status, ready-made sizes) — future features (inventory,
  more sizes, notifications) attach without rewrites.
