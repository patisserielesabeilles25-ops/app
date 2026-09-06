import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Trash2, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getUserDetail, getRoles } from '@/lib/admin/queries';
import { getUserRemuneration } from '@/lib/payroll/queries';
import { deleteUser } from '@/lib/admin/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EditUserForm } from '@/components/admin/EditUserForm';
import { RemunerationForm } from '@/components/admin/RemunerationForm';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Manage User — Nahla Cake Panel' };

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  await requirePermission('users.edit');
  const locale = await getLocale();
  const { id } = await params;
  const { msg, error } = await searchParams;

  const user = await getUserDetail(id);
  if (!user) notFound();
  const roles = await getRoles();
  const perms = await getMyPermissions();
  const canDelete = perms.has('users.delete');
  const canManagePay = perms.has('employees.manage') && perms.has('payroll.manage');
  const remuneration = canManagePay ? await getUserRemuneration(id) : null;

  return (
    <>
      <Link href="/users" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" />{tr(locale, 'Back to users', 'العودة إلى المستخدمين')}
      </Link>

      <PageHeader
        title={user.full_name || user.email}
        description={user.email}
        action={
          canDelete ? (
            <ConfirmDialog
              triggerLabel={<span className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" />{tr(locale, 'Delete', 'حذف')}</span>}
              title={tr(locale, 'Delete this user?', 'هل تريد حذف هذا المستخدم؟')}
              description={tr(locale, 'This permanently removes the account and its access.', 'يؤدي هذا إلى حذف الحساب وصلاحياته نهائيًا.')}
              confirmLabel={tr(locale, 'Delete user', 'حذف المستخدم')}
              action={deleteUser}
              hiddenFields={{ userId: user.id }}
            />
          ) : undefined
        }
      />

      {msg ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5" />{msg}</div>
      ) : null}
      {error ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700"><AlertTriangle className="h-5 w-5" />{error}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={tr(locale, 'Account & roles', 'الحساب والأدوار')} />
          <CardBody>
            <EditUserForm
              userId={user.id}
              fullName={user.full_name ?? ''}
              isActive={user.is_active}
              allRoles={roles.map((r) => ({ id: r.id, name: r.name }))}
              assignedRoleIds={user.roles.map((r) => r.id)}
            />
          </CardBody>
        </Card>

        {canManagePay ? (
          <Card>
            <CardHeader
              title={tr(locale, 'Rémunération', 'الأجر')}
              description={tr(locale, 'Feeds the payroll module — periods and payments are tracked there.', 'يغذّي وحدة كشوف الأجور — تُتابع الفترات والمدفوعات هناك.')}
              action={
                remuneration ? (
                  <Link
                    href={`/payroll/${remuneration.employeeId}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-amber-600"
                  >
                    {tr(locale, 'Suivi des paiements', 'متابعة المدفوعات')}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : undefined
              }
            />
            <CardBody>
              <RemunerationForm
                userId={user.id}
                current={
                  remuneration
                    ? { paymentMethod: remuneration.paymentMethod, amount: remuneration.amount }
                    : null
                }
              />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
