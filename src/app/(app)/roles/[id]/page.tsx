import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Trash2, CheckCircle2 } from 'lucide-react';
import { requirePermission } from '@/lib/auth/permissions';
import { getRoleDetail, getPermissions } from '@/lib/admin/queries';
import { deleteRole } from '@/lib/admin/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RoleForm } from '@/components/admin/RoleForm';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Edit Role — Nahla Cake Panel' };

export default async function RoleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  await requirePermission('roles.edit');
  const locale = await getLocale();
  const { id } = await params;
  const { msg } = await searchParams;

  const detail = await getRoleDetail(id);
  if (!detail) notFound();
  const permissions = await getPermissions();

  return (
    <>
      <Link href="/roles" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" />{tr(locale, 'Back to roles', 'العودة إلى الأدوار')}
      </Link>

      <PageHeader
        title={tr(locale, `Edit ${detail.role.name}`, `تعديل ${detail.role.name}`)}
        description={detail.role.description ?? undefined}
        action={
          !detail.role.is_system ? (
            <ConfirmDialog
              triggerLabel={<span className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" />{tr(locale, 'Delete', 'حذف')}</span>}
              title={tr(locale, 'Delete this role?', 'هل تريد حذف هذا الدور؟')}
              description={tr(locale, 'Users assigned only this role will lose its permissions.', 'سيفقد المستخدمون المعيَّن لهم هذا الدور فقط صلاحياته.')}
              confirmLabel={tr(locale, 'Delete role', 'حذف الدور')}
              action={deleteRole}
              hiddenFields={{ roleId: detail.role.id }}
            />
          ) : undefined
        }
      />

      {msg ? <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5" />{msg}</div> : null}

      <Card>
        <CardBody>
          <RoleForm
            mode="edit"
            roleId={detail.role.id}
            isSystem={detail.role.is_system}
            permissions={permissions.map((p) => ({ id: p.id, key: p.key }))}
            defaults={{
              key: detail.role.key,
              name: detail.role.name,
              description: detail.role.description ?? '',
              permissionIds: detail.permissionIds,
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
