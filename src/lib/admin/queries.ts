import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  roles: { id: string; key: string; name: string }[];
};

/** Full user list: emails from auth, profile + roles joined. Service client — caller must check users.view. */
export async function getUsers(): Promise<AdminUser[]> {
  const service = createServiceClient();
  const { data: authList } = await service.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((authList?.users ?? []).map((u) => [u.id, u.email ?? '']));

  const { data: profiles } = await service
    .from('profiles')
    .select('id, full_name, is_active');

  const { data: userRoles } = await service
    .from('user_roles')
    .select('user_id, role:roles(id, key, name)');

  const rolesByUser = new Map<string, { id: string; key: string; name: string }[]>();
  for (const ur of userRoles ?? []) {
    const role = ur.role as unknown as { id: string; key: string; name: string } | null;
    if (!role) continue;
    const list = rolesByUser.get(ur.user_id) ?? [];
    list.push(role);
    rolesByUser.set(ur.user_id, list);
  }

  return (profiles ?? []).map((p) => ({
    id: p.id,
    email: emailById.get(p.id) ?? '',
    full_name: p.full_name,
    is_active: p.is_active,
    roles: rolesByUser.get(p.id) ?? [],
  }));
}

export async function getUserDetail(id: string): Promise<AdminUser | null> {
  const users = await getUsers();
  return users.find((u) => u.id === id) ?? null;
}

export type RoleSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissionCount: number;
};

export async function getRoles(): Promise<RoleSummary[]> {
  const supabase = await createClient();
  const { data: roles } = await supabase
    .from('roles')
    .select('id, key, name, description, is_system')
    .order('key');
  const { data: rp } = await supabase.from('role_permissions').select('role_id');
  const counts = new Map<string, number>();
  for (const r of rp ?? []) counts.set(r.role_id, (counts.get(r.role_id) ?? 0) + 1);

  return (roles ?? []).map((r) => ({
    ...r,
    permissionCount: counts.get(r.id) ?? 0,
  }));
}

export type Permission = { id: string; key: string; description: string | null };

export async function getPermissions(): Promise<Permission[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('permissions')
    .select('id, key, description')
    .order('key');
  return (data ?? []) as Permission[];
}

export async function getRoleDetail(
  id: string,
): Promise<{ role: RoleSummary; permissionIds: string[] } | null> {
  const supabase = await createClient();
  const { data: role } = await supabase
    .from('roles')
    .select('id, key, name, description, is_system')
    .eq('id', id)
    .maybeSingle();
  if (!role) return null;
  const { data: rp } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', id);
  return {
    role: { ...role, permissionCount: (rp ?? []).length },
    permissionIds: (rp ?? []).map((r) => r.permission_id),
  };
}
