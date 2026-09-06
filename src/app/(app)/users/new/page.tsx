import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getRoles } from '@/lib/admin/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { CreateUserForm } from '@/components/admin/CreateUserForm';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'New User — Nahla Cake Panel' };

export default async function NewUserPage() {
  await requirePermission('users.create');
  const locale = await getLocale();
  const roles = await getRoles();
  const perms = await getMyPermissions();
  const canManagePay = perms.has('employees.manage') && perms.has('payroll.manage');
  return (
    <>
      <PageHeader title={tr(locale, 'New User', 'مستخدم جديد')} description={tr(locale, 'Create a staff account.', 'إنشاء حساب موظف.')} />
      <Card className="max-w-xl">
        <CardBody>
          <CreateUserForm roles={roles.map((r) => ({ id: r.id, name: r.name }))} canManagePay={canManagePay} />
        </CardBody>
      </Card>
    </>
  );
}
