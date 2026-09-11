import 'server-only';

import { cache } from 'react';
import { forbidden } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';

/** All permission keys defined by the system (mirror of seed.sql). */
export type Permission =
  | 'dashboard.view'
  | 'shop.view'
  | 'orders.view'
  | 'orders.create'
  | 'orders.edit'
  | 'orders.delete'
  | 'laboratory.view'
  | 'production.update'
  | 'calendar.view'
  | 'delivery.view'
  | 'delivery.update'
  | 'finance.view'
  | 'finance.income.create'
  | 'finance.expense.create'
  | 'finance.transactions.view'
  | 'finance.attachments.view'
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.delete'
  | 'roles.view'
  | 'roles.create'
  | 'roles.edit'
  | 'permissions.manage'
  | 'settings.manage'
  // Finance module expansion
  | 'finance.reports.view'
  | 'finance.reverse'
  | 'finance.categories.manage'
  | 'magasin.view'
  | 'magasin.sale.create'
  | 'magasin.expense.create'
  | 'employees.view'
  | 'employees.manage'
  | 'payroll.view'
  | 'payroll.manage'
  | 'payroll.pay'
  // Product catalog
  | 'products.view'
  | 'products.manage'
  // WhatsApp automation
  | 'whatsapp.view'
  | 'whatsapp.manage';

/**
 * Effective permission keys for the current user. Resolved via the
 * SECURITY DEFINER `my_permissions()` RPC (a plain user cannot read the RBAC
 * join tables directly under RLS). Cached per request.
 */
export const getMyPermissions = cache(async (): Promise<Set<Permission>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_permissions');
  if (error) {
    throw new Error(`Failed to load permissions: ${error.message}`);
  }
  return new Set((data ?? []) as Permission[]);
});

/** Non-throwing check. */
export async function hasPermission(perm: Permission): Promise<boolean> {
  const perms = await getMyPermissions();
  return perms.has(perm);
}

/**
 * Render the forbidden boundary if the current user holds any of the given role
 * keys. Admins are always exempt. Use to hide a route from a specific role even
 * when that role still holds the underlying permission (e.g. hide Finance from
 * "vendeur" without stripping finance.view).
 */
export async function forbidForRoles(roleKeys: string[]): Promise<void> {
  const roles = await getMyRoleKeys();
  if (roles.has('admin')) return;
  if (roleKeys.some((k) => roles.has(k))) forbidden();
}

/**
 * Role keys held by the current user (e.g. 'admin', 'maskage', 'preparateur').
 * Resolved via the SECURITY DEFINER `my_role_keys()` RPC. Cached per request.
 */
export const getMyRoleKeys = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_role_keys');
  if (error) {
    throw new Error(`Failed to load roles: ${error.message}`);
  }
  return new Set((data ?? []) as string[]);
});

/** First route the user can access, used for post-login / root landing. */
const LANDING_ORDER: [Permission, string][] = [
  ['dashboard.view', '/dashboard'],
  ['magasin.view', '/finance/magasin'],
  ['orders.view', '/orders'],
  ['calendar.view', '/calendar'],
  ['finance.view', '/finance'],
];

export function landingPathFor(perms: Set<Permission>): string {
  for (const [perm, path] of LANDING_ORDER) if (perms.has(perm)) return path;
  return '/dashboard';
}

/**
 * Server-side authorization guard. Ensures the user is signed in AND holds the
 * given permission; otherwise redirects to login (unauthenticated) or renders
 * the forbidden boundary (authenticated but unauthorized).
 *
 * Call this at the top of every protected page, server action, and route
 * handler — the primary authorization layer (RLS is the backstop).
 */
export async function requirePermission(perm: Permission): Promise<void> {
  await requireUser();
  const perms = await getMyPermissions();
  if (!perms.has(perm)) {
    forbidden();
  }
}
