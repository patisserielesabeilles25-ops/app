import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getPeriod, getPeriodRecords } from '@/lib/payroll/queries';
import { calculatePayroll, recordPayrollPayment } from '@/lib/payroll/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatAmount, formatDate } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Payroll Period — Nahla Cake Panel' };

const STATUS_TONE: Record<string, 'neutral' | 'blue' | 'amber' | 'green' | 'rose'> = {
  DRAFT: 'neutral', CALCULATED: 'blue', PARTIALLY_PAID: 'amber', PAID: 'green', CANCELLED: 'rose',
};

export default async function PeriodDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  await requirePermission('payroll.view');
  const locale = await getLocale();
  const { id } = await params;
  const { msg, error } = await searchParams;
  const period = await getPeriod(id);
  if (!period) notFound();

  const perms = await getMyPermissions();
  const canManage = perms.has('payroll.manage');
  const canPay = perms.has('payroll.pay');
  const rows = await getPeriodRecords(id);

  return (
    <>
      <Link href="/payroll/periods" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to periods', 'العودة إلى الفترات')}
      </Link>
      <PageHeader
        title={period.label || `${period.period_type} ${tr(locale, 'period', 'فترة')}`}
        description={`${formatDate(period.start_date)} → ${formatDate(period.end_date)}`}
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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Employee', 'الموظف')}</th>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Method', 'الطريقة')}</th>
                <th className="px-4 py-3 text-right font-semibold">{tr(locale, 'Gross', 'الإجمالي')}</th>
                <th className="px-4 py-3 text-right font-semibold">{tr(locale, 'Remaining', 'المتبقي')}</th>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Status', 'الحالة')}</th>
                {canManage || canPay ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(({ employee, record }) => (
                <tr key={employee.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-800">{employee.full_name}</td>
                  <td className="px-4 py-3 text-neutral-600">{employee.payment_method}</td>
                  <td className="px-4 py-3 text-right text-neutral-800">
                    {record ? formatAmount(record.gross_amount) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-600">
                    {record ? formatAmount(record.remaining) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {record ? <Badge tone={STATUS_TONE[record.status] ?? 'neutral'}>{record.status}</Badge> : <span className="text-xs text-neutral-400">—</span>}
                  </td>
                  {canManage || canPay ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canManage && (!record || record.status === 'DRAFT' || record.status === 'CALCULATED') ? (
                          <form action={calculatePayroll} className="flex items-center gap-2">
                            <input type="hidden" name="employeeId" value={employee.id} />
                            <input type="hidden" name="periodId" value={id} />
                            {employee.payment_method === 'DAILY' ? (
                              <input
                                name="workedDays"
                                type="number"
                                min="0"
                                placeholder={tr(locale, 'days', 'أيام')}
                                className="w-16 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-amber-400"
                              />
                            ) : null}
                            <Button type="submit" size="sm" variant="secondary">{tr(locale, 'Calculate', 'احتساب')}</Button>
                          </form>
                        ) : null}
                        {canPay && record && (record.status === 'CALCULATED' || record.status === 'PARTIALLY_PAID') && record.remaining > 0 ? (
                          <form action={recordPayrollPayment} className="flex items-center gap-2">
                            <input type="hidden" name="recordId" value={record.id} />
                            <input type="hidden" name="periodId" value={id} />
                            <input
                              name="amount"
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue={record.remaining}
                              className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-amber-400"
                            />
                            <Button type="submit" size="sm">{tr(locale, 'Pay', 'دفع')}</Button>
                          </form>
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
    </>
  );
}
