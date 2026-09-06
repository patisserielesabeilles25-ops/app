import { requirePermission } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { EmployeeForm } from '@/components/payroll/EmployeeForm';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'New Employee — Nahla Cake Panel' };

export default async function NewEmployeePage() {
  await requirePermission('employees.manage');
  const locale = await getLocale();
  return (
    <>
      <PageHeader title={tr(locale, 'New Employee', 'موظف جديد')} description={tr(locale, 'Add a staff member for payroll.', 'أضف موظفاً إلى الرواتب.')} />
      <Card className="max-w-2xl">
        <CardBody><EmployeeForm /></CardBody>
      </Card>
    </>
  );
}
