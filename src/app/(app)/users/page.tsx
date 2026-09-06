import Link from 'next/link';
import { Plus, Users as UsersIcon, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { requireUser } from '@/lib/auth/session';
import { getUsers } from '@/lib/admin/queries';
import { getSalaryOverviews } from '@/lib/payroll/salary';
import { deleteUser } from '@/lib/admin/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PayEmployeeDialog } from '@/components/admin/PayEmployeeDialog';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Users — Nahla Cake Panel' };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  await requirePermission('users.view');
  const locale = await getLocale();
  const { msg, error } = await searchParams;
  const perms = await getMyPermissions();
  const canCreate = perms.has('users.create');
  const canEdit = perms.has('users.edit');
  const canDelete = perms.has('users.delete');
  const canPay = perms.has('payroll.pay');
  const me = await requireUser();
  const users = await getUsers();
  const payInfo = canPay ? await getSalaryOverviews() : new Map();

  return (
    <>
      <PageHeader
        title={tr(locale, 'Users', 'المستخدمون')}
        description={tr(locale, 'Manage staff accounts and role assignments.', 'إدارة حسابات الموظفين وتعيين الأدوار.')}
        action={canCreate ? <LinkButton href="/users/new"><Plus className="h-4 w-4" />{tr(locale, 'New user', 'مستخدم جديد')}</LinkButton> : undefined}
      />

      {msg ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />{msg}
        </div>
      ) : null}
      {error ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-5 w-5" />{error}
        </div>
      ) : null}

      {users.length === 0 ? (
        <EmptyState icon={UsersIcon} title={tr(locale, 'No users', 'لا يوجد مستخدمون')} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Name', 'الاسم')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Email', 'البريد الإلكتروني')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Roles', 'الأدوار')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Status', 'الحالة')}</th>
                  {canEdit || canDelete || canPay ? <th className="px-4 py-3" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">{u.full_name || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-neutral-400">{tr(locale, 'No role', 'بدون دور')}</span>
                        ) : (
                          u.roles.map((r) => <Badge key={r.id} tone="blue">{r.name}</Badge>)
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.is_active ? 'green' : 'neutral'}>{u.is_active ? tr(locale, 'Active', 'نشط') : tr(locale, 'Inactive', 'غير نشط')}</Badge>
                    </td>
                    {canEdit || canDelete || canPay ? (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          {canPay && payInfo.has(u.id) ? (
                            <PayEmployeeDialog info={payInfo.get(u.id)!} />
                          ) : null}
                          {canEdit ? (
                            <Link href={`/users/${u.id}`} className="text-sm text-amber-600 hover:underline">{tr(locale, 'Manage', 'إدارة')}</Link>
                          ) : null}
                          {canDelete && u.id !== me.id ? (
                            <ConfirmDialog
                              triggerLabel={
                                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline">
                                  <Trash2 className="h-4 w-4" />
                                  {tr(locale, 'Delete', 'حذف')}
                                </span>
                              }
                              title={tr(locale, 'Delete this user?', 'هل تريد حذف هذا المستخدم؟')}
                              description={tr(
                                locale,
                                `${u.full_name || u.email} will be permanently removed and can no longer sign in. This cannot be undone.`,
                                `${u.full_name || u.email} سيُحذف نهائيًا ولن يتمكن من تسجيل الدخول بعد الآن. لا يمكن التراجع عن هذا الإجراء.`,
                              )}
                              confirmLabel={tr(locale, 'Delete user', 'حذف المستخدم')}
                              action={deleteUser}
                              hiddenFields={{ userId: u.id }}
                            />
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
