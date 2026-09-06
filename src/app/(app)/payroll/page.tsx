import Link from 'next/link';
import { Plus, Users as UsersIcon, CheckCircle2, Coins, CalendarRange } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getEmployees } from '@/lib/payroll/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';
import type { Locale } from '@/lib/i18n/config';

export const metadata = { title: 'Payroll — Nahla Cake Panel' };

function methodLabel(locale: Locale, key: string): string {
  const labels: Record<string, string> = {
    PIECE_BASED: tr(locale, 'Piece-based', 'بالقطعة'),
    DAILY: tr(locale, 'Daily', 'يومي'),
    WEEKLY: tr(locale, 'Weekly', 'أسبوعي'),
    MONTHLY: tr(locale, 'Monthly', 'شهري'),
  };
  return labels[key] ?? key;
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  await requirePermission('payroll.view');
  const locale = await getLocale();
  const { msg } = await searchParams;
  const perms = await getMyPermissions();
  const canManage = perms.has('employees.manage');
  const employees = await getEmployees();

  return (
    <>
      <PageHeader
        title={tr(locale, 'Payroll', 'الرواتب')}
        description={tr(locale, 'Employees, rates, and pay.', 'الموظفون والمعدلات والدفع.')}
        action={
          <div className="flex gap-2">
            <LinkButton href="/payroll/periods" variant="secondary"><CalendarRange className="h-4 w-4" />{tr(locale, 'Periods', 'الفترات')}</LinkButton>
            <LinkButton href="/payroll/rates" variant="secondary"><Coins className="h-4 w-4" />{tr(locale, 'Rates', 'المعدلات')}</LinkButton>
            {canManage ? <LinkButton href="/payroll/new"><Plus className="h-4 w-4" />{tr(locale, 'New employee', 'موظف جديد')}</LinkButton> : null}
          </div>
        }
      />

      {msg ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />{msg}
        </div>
      ) : null}

      {employees.length === 0 ? (
        <EmptyState icon={UsersIcon} title={tr(locale, 'No employees yet', 'لا يوجد موظفون بعد')} description={tr(locale, 'Add your first employee to start payroll.', 'أضف موظفك الأول لبدء الرواتب.')} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Name', 'الاسم')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Job', 'الوظيفة')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Department', 'القسم')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Payment', 'طريقة الدفع')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Status', 'الحالة')}</th>
                  {canManage ? <th className="px-4 py-3" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {employees.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">{e.full_name}</td>
                    <td className="px-4 py-3 text-neutral-600">{e.job || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{e.department}</td>
                    <td className="px-4 py-3"><Badge tone="blue">{methodLabel(locale, e.payment_method)}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={e.is_active ? 'green' : 'neutral'}>{e.is_active ? tr(locale, 'Active', 'نشط') : tr(locale, 'Inactive', 'غير نشط')}</Badge></td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <Link href={`/payroll/${e.id}`} className="text-sm text-amber-600 hover:underline">{tr(locale, 'Manage', 'إدارة')}</Link>
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
