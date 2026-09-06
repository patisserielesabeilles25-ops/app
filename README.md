# Nahla Cake Panel

Internal management system for **Nahla Cake** — order intake, laboratory production,
delivery, an annual calendar, a secure cash register, ready-made production tracking, and
full user/role/permission administration.

Built with **Next.js (App Router) + TypeScript + Tailwind CSS + Supabase** (PostgreSQL,
Auth, Storage, Realtime).

> Core docs: [PROJECT_SPEC.md](PROJECT_SPEC.md) · [ARCHITECTURE.md](ARCHITECTURE.md) ·
> [DATABASE_DESIGN.md](DATABASE_DESIGN.md) · [SECURITY.md](SECURITY.md) ·
> [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
>
> Finance module docs: [FINANCE_ARCHITECTURE.md](FINANCE_ARCHITECTURE.md) ·
> [FINANCE_DATABASE_DESIGN.md](FINANCE_DATABASE_DESIGN.md) · [FINANCE_SECURITY.md](FINANCE_SECURITY.md) ·
> [FINANCE_IMPLEMENTATION_PLAN.md](FINANCE_IMPLEMENTATION_PLAN.md) · [FINANCE_TEST_CHECKLIST.md](FINANCE_TEST_CHECKLIST.md)

---

## Features

- **Auth & RBAC** — Supabase Auth, roles → permissions, enforced in server actions **and** RLS.
- **Shop / Orders** — create custom orders (atomic order numbers, reference image), search,
  edit, send to laboratory, delete (blocked when payments exist).
- **Laboratory** — production cards with permission-gated details; mark ready.
- **Annual Calendar** — orders by delivery date, per-day drill-down.
- **Delivery** — Ready → Out for delivery → Delivered.
- **Finance** — one central append-only ledger (the treasury), derived balance, income/expense
  entry classified by category/department/source, order-payment integration (advance/final +
  delivery fee), **MAGASIN** operational sales/expenses (shop staff post without treasury access),
  full **payroll** (piece/daily/weekly/monthly, rates, work records, advances, payments with a
  status machine), reports (daily/weekly/monthly/annual/custom) with drill-down, reversals, and
  **private** receipts via permission-gated signed URLs. Finance is blocked for non-finance users
  at every layer (UI, server, RLS, storage).
- **Ready-Made** — daily S/M/L production by date.
- **Realtime** — order status propagates without manual refresh.
- **Audit log** — who did what, when (viewable in Settings).
- **Administration** — users, roles, permissions management.

---

## Prerequisites

- **Node.js 20+ LTS** (developed on 24.x)
- A **Supabase** project (PostgreSQL, Auth, Storage, Realtime)

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | anon / publishable key (RLS-scoped) |
| `SUPABASE_SECRET_KEY` | **server only** | service-role key — never exposed to the browser |

`.env.local` is git-ignored. Never commit secrets. **Rotate any key that has been shared.**

## Local development

```bash
npm install
npm run dev
```

App runs at http://localhost:3000.

## Database setup

Apply the schema to your Supabase database (one-time on a fresh project):

- **Option A — SQL Editor:** paste the contents of `supabase/apply_all.sql` into
  Supabase → SQL Editor → Run. It creates all tables, functions, RLS policies, the two
  storage buckets, and seeds the permission catalog + `main`/`operations` roles.
- **Option B — Supabase CLI:** apply the files in `supabase/migrations/` (0001–0013) in
  order, then run `supabase/seed.sql`.

### Storage buckets

`apply_all.sql` inserts the private buckets `order-images` and `finance-attachments`. If you
prefer, create them manually in the dashboard as **private** buckets (no public access).

### First admin user

Create the first user in Supabase → Authentication → Users (or via the Admin API), then map
them to the `main` role:

```sql
insert into public.user_roles (user_id, role_id)
select '<AUTH_USER_ID>', id from public.roles where key = 'main';
```

After that, additional users can be created in-app under **Users** (main users only).

## Scripts

```bash
npm run dev     # start dev server
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
npm test        # vitest unit tests
```

## Deployment (Vercel + Supabase)

1. Push the repo to Git and import it into **Vercel**.
2. Set the three environment variables in the Vercel project settings. Mark
   `SUPABASE_SECRET_KEY` as a server-side/secret variable (do **not** expose it).
3. Ensure the database schema is applied (see **Database setup**).
4. Deploy. The app is server-rendered; authenticated routes are dynamic.

## Security notes

- Authorization is enforced in server actions/route handlers **and** by Row Level Security —
  the browser never enforces access.
- The service-role key is used only in `import 'server-only'` modules, after a permission check.
- Financial amounts live in a separate `order_financials` table so RLS can hide them from
  non-finance users; receipts are private and served via short-lived signed URLs.
- See [SECURITY.md](SECURITY.md) for the full model.
