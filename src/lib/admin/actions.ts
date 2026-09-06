'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/auth/session';
import { requirePermission, hasPermission } from '@/lib/auth/permissions';
import { writeAudit } from '@/lib/audit/log';
import { CreateUserSchema, UpdateUserSchema, RoleSchema } from '@/lib/validation/admin';
import { RATE_KIND, isPaymentMethod } from '@/lib/payroll/methods';

export type AdminFormState = { error?: string; fieldErrors?: Record<string, string> };

function fieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const fe: Record<string, string> = {};
  for (const i of issues) {
    const k = typeof i.path[0] === 'string' ? i.path[0] : '';
    if (k && !fe[k]) fe[k] = i.message;
  }
  return fe;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export async function createUser(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requirePermission('users.create');
  const actor = await requireUser();

  const parsed = CreateUserSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    roleId: formData.get('roleId') ?? '',
  });
  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error.issues) };
  }
  const { fullName, email, password, roleId } = parsed.data;

  const service = createServiceClient();
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !created.user) {
    return { error: /already/i.test(error?.message ?? '') ? 'A user with this email already exists.' : 'Could not create the user.' };
  }

  await service.from('profiles').update({ full_name: fullName }).eq('id', created.user.id);
  if (roleId) {
    await service.from('user_roles').insert({ user_id: created.user.id, role_id: roleId });
  }
  await writeAudit({ actorId: actor.id, action: 'user.create', entityType: 'user', entityId: created.user.id, metadata: { email } });

  // Optional remuneration (creates a linked payroll employee + active rate).
  const remMethod = String(formData.get('remMethod') ?? '');
  const remAmount = Number(formData.get('remAmount'));
  if (
    isPaymentMethod(remMethod) &&
    remAmount >= 0 &&
    (await hasPermission('employees.manage')) &&
    (await hasPermission('payroll.manage'))
  ) {
    const { data: emp } = await service
      .from('employees')
      .insert({
        full_name: fullName,
        profile_id: created.user.id,
        payment_method: remMethod,
        department: 'LABORATORY',
        created_by: actor.id,
      })
      .select('id')
      .single();
    if (emp) {
      await service.from('payroll_rates').insert({
        employee_id: emp.id,
        rate: remAmount,
        rate_kind: RATE_KIND[remMethod],
        effective_from: new Date().toISOString().slice(0, 10),
        is_active: true,
        created_by: actor.id,
      });
    }
  }

  revalidatePath('/users');
  redirect('/users?msg=User+created.');
}

export async function updateUser(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requirePermission('users.edit');
  const actor = await requireUser();

  const parsed = UpdateUserSchema.safeParse({
    userId: formData.get('userId'),
    fullName: formData.get('fullName'),
    isActive: formData.get('isActive') === 'on',
    roleIds: formData.getAll('roleIds').map(String),
  });
  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error.issues) };
  }
  const { userId, fullName, isActive, roleIds } = parsed.data;

  const service = createServiceClient();
  await service.from('profiles').update({ full_name: fullName, is_active: isActive }).eq('id', userId);
  await service.from('user_roles').delete().eq('user_id', userId);
  if (roleIds.length > 0) {
    await service.from('user_roles').insert(roleIds.map((role_id) => ({ user_id: userId, role_id })));
  }
  await writeAudit({ actorId: actor.id, action: 'user.update', entityType: 'user', entityId: userId, metadata: { active: isActive, roles: roleIds.length } });

  revalidatePath('/users');
  revalidatePath(`/users/${userId}`);
  redirect(`/users/${userId}?msg=User+updated.`);
}

export async function deleteUser(formData: FormData): Promise<void> {
  await requirePermission('users.delete');
  const actor = await requireUser();
  const userId = String(formData.get('userId') ?? '');

  if (userId === actor.id) {
    redirect(`/users/${userId}?error=${encodeURIComponent('You cannot delete your own account.')}`);
  }

  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(userId);
  if (error) {
    redirect(`/users/${userId}?error=${encodeURIComponent('Could not delete the user.')}`);
  }
  await writeAudit({ actorId: actor.id, action: 'user.delete', entityType: 'user', entityId: userId });

  revalidatePath('/users');
  redirect('/users?msg=User+deleted.');
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export async function createRole(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requirePermission('roles.create');
  const actor = await requireUser();

  const parsed = RoleSchema.safeParse({
    key: formData.get('key'),
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    permissionIds: formData.getAll('permissionIds').map(String),
  });
  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error.issues) };
  }
  const { key, name, description, permissionIds } = parsed.data;

  const service = createServiceClient();
  const { data: role, error } = await service
    .from('roles')
    .insert({ key, name, description })
    .select('id')
    .single();
  if (error || !role) {
    return { error: /duplicate|unique/i.test(error?.message ?? '') ? 'A role with this key already exists.' : 'Could not create the role.' };
  }
  if (permissionIds.length > 0) {
    await service.from('role_permissions').insert(permissionIds.map((permission_id) => ({ role_id: role.id, permission_id })));
  }
  await writeAudit({ actorId: actor.id, action: 'role.create', entityType: 'role', entityId: role.id, metadata: { key } });

  revalidatePath('/roles');
  redirect('/roles?msg=Role+created.');
}

export async function updateRole(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requirePermission('roles.edit');
  const actor = await requireUser();
  const roleId = String(formData.get('roleId') ?? '');

  const parsed = RoleSchema.safeParse({
    key: formData.get('key'),
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    permissionIds: formData.getAll('permissionIds').map(String),
  });
  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error.issues) };
  }
  const { name, description, permissionIds } = parsed.data;

  const service = createServiceClient();
  await service.from('roles').update({ name, description }).eq('id', roleId);
  await service.from('role_permissions').delete().eq('role_id', roleId);
  if (permissionIds.length > 0) {
    await service.from('role_permissions').insert(permissionIds.map((permission_id) => ({ role_id: roleId, permission_id })));
  }
  await writeAudit({ actorId: actor.id, action: 'role.update', entityType: 'role', entityId: roleId, metadata: { permissions: permissionIds.length } });

  revalidatePath('/roles');
  redirect(`/roles/${roleId}?msg=Role+updated.`);
}

export async function deleteRole(formData: FormData): Promise<void> {
  await requirePermission('roles.edit');
  const actor = await requireUser();
  const roleId = String(formData.get('roleId') ?? '');

  const service = createServiceClient();
  const { data: role } = await service.from('roles').select('is_system, key').eq('id', roleId).maybeSingle();
  if (role?.is_system) {
    redirect(`/roles?error=${encodeURIComponent('System roles cannot be deleted.')}`);
  }
  await service.from('roles').delete().eq('id', roleId);
  await writeAudit({ actorId: actor.id, action: 'role.delete', entityType: 'role', entityId: roleId, metadata: { key: role?.key } });

  revalidatePath('/roles');
  redirect('/roles?msg=Role+deleted.');
}
