import { requirePermission } from '@/lib/auth/permissions';
import { getPermissions } from '@/lib/admin/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { RoleForm } from '@/components/admin/RoleForm';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'New Role — Nahla Cake Panel' };

export default async function NewRolePage() {
  await requirePermission('roles.create');
  const locale = await getLocale();
  const permissions = await getPermissions();
  return (
    <>
      <PageHeader title={tr(locale, 'New Role', 'دور جديد')} description={tr(locale, 'Create a role and grant permissions.', 'إنشاء دور ومنح الصلاحيات.')} />
      <Card>
        <CardBody>
          <RoleForm mode="create" permissions={permissions.map((p) => ({ id: p.id, key: p.key }))} />
        </CardBody>
      </Card>
    </>
  );
}
