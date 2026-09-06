# Nahla Cake Panel — Project Specification (V1)

> Internal management system for **Nahla Cake**. This document captures the agreed V1
> scope. It is the source of truth for *what* is built; `ARCHITECTURE.md`, `DATABASE_DESIGN.md`,
> `SECURITY.md`, and `IMPLEMENTATION_PLAN.md` describe *how*.

---

## 1. Purpose

A centralized, secure, responsive internal web application that lets Nahla Cake:

- Register custom customer orders quickly at the shop.
- Send orders to the laboratory and track production.
- Organize orders on an annual calendar by delivery date.
- Track delivery / pickup.
- Manage a secure, auditable cash register (finance).
- Record daily ready-made cake production.
- Manage users, roles, and permissions.

**Out of scope for V1** (see §11): inventory, recipes, ingredient deduction, suppliers,
notifications (WhatsApp/SMS), online customer ordering, advanced accounting/reporting,
multi-branch, customer portal. Architecture must not block these later.

---

## 2. Users & access model (initial)

- **5 users initially**, but the system must **never hardcode a 5-user limit**.
- **4 "main" users**: full operational **and** financial access, plus user/role/permission management.
- Additional users may be **operational-only** (no finance access whatsoever — enforced server-side).

Access is governed by **RBAC**: users → roles → permissions. Finance access is a permission,
not a UI toggle. See `SECURITY.md` and `DATABASE_DESIGN.md`.

---

## 3. System areas

1. Dashboard
2. Shop / Point of Sale
3. Orders
4. Laboratory / Production
5. Annual Calendar
6. Delivery
7. Finance / Cash Register
8. Ready-Made Cake Production
9. Users
10. Roles
11. Permissions
12. Settings

Navigation visibility respects permissions, but **UI filtering is supplemental** — every route,
server action, API endpoint, and row is authorized on the backend.

---

## 4. Custom orders

### 4.1 Order form fields

**Customer**
- Customer name (required)
- Customer phone (required, validated)

**Delivery / pickup**
- Delivery date (required)
- Delivery time (required)
- Delivery required: yes/no
- Delivery amount (required only when delivery = yes; ≥ 0)

**Cake**
- Cake size in centimeters (required, > 0)
- Order description / details
- Reference image (optional; stored in Supabase Storage)

**Financial**
- Total amount (required, ≥ 0)
- Advance payment (≥ 0)
- Remaining amount = `total_amount - advance_payment` (derived, never hand-entered)

### 4.2 Financial validation rules

- `total_amount >= 0`, `advance_payment >= 0`, `delivery_amount >= 0`.
- `advance_payment <= total_amount` (V1 rule; enforced by DB CHECK + server validation).
- `remaining_amount` is computed, not stored as an independent editable field.
- No amount may become negative through any operation.

### 4.3 Order numbers

- Every order gets a **unique** order number, generated **centrally and atomically**
  (DB sequence per year, e.g. `NC-2026-000123`). Uniqueness enforced by a UNIQUE constraint.
- Never generated client-side.

### 4.4 Order lifecycle

Custom-order production status:

```
NEW → IN_PRODUCTION → READY
```

Delivery status (only relevant when delivery is required or order otherwise leaves the shop):

```
READY → OUT_FOR_DELIVERY → DELIVERED
```

Pickup orders end at `READY` (collected at shop) and are marked collected.

State transitions are validated server-side (no illegal jumps) and **timestamped**
(`sent_to_lab_at`, `in_production_at`, `ready_at`, `out_for_delivery_at`, `delivered_at`).

---

## 5. Shop interface

Optimized for fast entry and tracking. Can:
- Create order, view orders, view order details.
- Track order status; see ready orders; see orders requiring delivery.
- Access the annual calendar.
- Send an order to the laboratory → status changes and the order becomes visible to lab users.

---

## 6. Laboratory interface

- Orders shown as **compact rectangular cards**.
- Card front shows: customer name, customer phone, cake size (cm), delivery date, delivery time.
- Each card has a **three-dot menu** opening further details **according to permissions**:
  full description, reference image, and — **only with finance permission** — total/advance/
  remaining/delivery amounts.
- Lab staff update production status; finishing an order sets `READY`.
- **Financial info is authorization-gated at the data layer**, not merely hidden in the UI.

---

## 7. Annual calendar

- Organizes orders automatically by year → month → day, on each order's **delivery date**.
- Days with orders are visually marked; multi-order days indicate count.
- Clicking a day lists that day's orders: order number, customer, delivery time, size, status.
- Efficient on desktop and mobile.

---

## 8. Delivery

- Orders are **collected at shop** or **delivered**.
- Delivery flow: `READY → OUT_FOR_DELIVERY → DELIVERED`, with timestamps on transitions.

---

## 9. Finance / cash register

Access requires finance permission (server-enforced; APIs and attachments also gated).

- **Income**: order payments (advance and final), other approved income.
- **Expenses**: purchases (item name, amount, date, receipt/invoice image), other expenses
  (amount, type, date, optional image).
- Income increases balance; expenses decrease it.

### 9.1 Ledger model (critical)

- **No single mutable "cash balance" as source of truth.** Use an append-only
  `financial_transactions` ledger.
- Each transaction records: id, type (income/expense), category, amount, occurred-at datetime,
  reference entity/order (nullable), description, attachment reference (nullable), created_by,
  created_at.
- Current balance is **derived** from the ledger (view / aggregate), with integrity checks.
- Avoid destructive edits; prefer reversing/adjusting entries (audit-friendly).

### 9.2 Order payment accounting (critical)

- Do **not** post the full order total to the register at order creation.
- Record income based on **money actually received**: an income entry for the advance when taken,
  and a further income entry when the remaining balance is paid.
- Workflow must be explicit and auditable; each posting is one ledger transaction linked to the order.

---

## 10. Ready-made cakes

- Sizes: **Small, Medium, Large** (structure kept extensible for more sizes / inventory later).
- Daily production entry per date: quantity of Small / Medium / Large produced.
- Stored per date (one record per date; unique on date).

Example: `2026-09-03 → S:10, M:7, L:4`.

---

## 11. Dashboard

Operational widgets: today's orders, new orders, in-production, ready, delivery orders,
delivered, upcoming/delayed, ready-made totals.

**Financial widgets appear only to users with finance permission** — no finance figures
(even aggregates) leak to unauthorized users, including via API.

---

## 12. Non-functional requirements

- **Responsive**: desktop, laptop, tablet, smartphone (main users monitor from phones).
- **Real-time** where useful — at minimum order-status changes propagate to relevant views.
- **Security**: Supabase Auth, RLS, server-side authorization, private finance storage,
  least privilege, no secrets in the browser. See `SECURITY.md`.
- **Auditability**: track who created/updated orders, changed status, created financial
  transactions/expenses, uploaded finance docs, changed permissions.
- **Data integrity**: no duplicate order numbers or transactions, no accidental negatives,
  no orphaned files, valid foreign keys, atomic multi-step writes.
- **Error handling & validation**: meaningful errors; validate client- **and** server-side.

---

## 13. Business rules (V1 invariants)

1. Every custom order has a delivery date, delivery time, cake size (cm), and customer info.
2. Orders may contain a reference image.
3. An order can be sent from shop → laboratory.
4. Lab can update production status; `READY` orders show as ready in the shop.
5. Delivery orders move `READY → OUT_FOR_DELIVERY → DELIVERED`.
6. Financial movements reflect actual money movement (advance vs final vs expense).
7. Users without finance permission cannot reach finance pages, APIs, data, or attachments.
8. 4 main users have full access initially; more users can be added.
9. Ready-made cakes have S/M/L sizes; daily quantities recorded by date.

---

## 14. Definition of done (per feature)

A feature is done when: it works end-to-end against Supabase (no mock data), inputs are
validated on both sides, authorization is enforced server-side, relevant RLS policies exist,
errors/loading/empty states are handled, and the mapped tests in `IMPLEMENTATION_PLAN.md` pass.
