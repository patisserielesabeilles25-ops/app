import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Trash2 } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getEmployee, getPieceWork, getAdvances } from '@/lib/payroll/queries';
import { deleteWorkRecord } from '@/lib/payroll/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { EmployeeForm } from '@/components/payroll/EmployeeForm';
import { WorkRecordForm } from '@/components/payroll/WorkRecordForm';
import { AdvanceForm } from '@/components/payroll/AdvanceForm';
import { formatAmount, formatDate } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Employee — Nahla Cake Panel' };

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  await requirePermission('employees.manage');
  const locale = await getLocale();
  const { id } = await params;
  const { msg } = await searchParams;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  const perms = await getMyPermissions();
  const canPayrollManage = perms.has('payroll.manage');
  const canPayrollView = perms.has('payroll.view');
  const canPay = perms.has('payroll.pay');
  const isPiece = employee.payment_method === 'PIECE_BASED';

  const piece = isPiece && canPayrollManage ? await getPieceWork(id) : null;
  const adv = canPayrollView ? await getAdvances(id) : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Link href="/payroll" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to payroll', 'العودة إلى الرواتب')}
      </Link>
      <PageHeader title={employee.full_name} description={tr(locale, 'Employee details and payroll.', 'تفاصيل الموظف والرواتب.')} />

      {msg ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />{msg}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Details" />
          <CardBody><EmployeeForm employee={employee} /></CardBody>
        </Card>

        <div className="space-y-6">
          {isPiece && canPayrollManage && piece ? (
            <>
              <Card>
                <CardHeader title={tr(locale, 'Record piece work', 'تسجيل العمل بالقطعة')} />
                <CardBody><WorkRecordForm employeeId={id} today={today} /></CardBody>
              </Card>
              <Card>
                <CardHeader title={tr(locale, 'Work records', 'سجلات العمل')} description={`${tr(locale, 'Unpaid gross', 'الإجمالي غير المدفوع')}: ${formatAmount(piece.unpaidTotal)}`} />
                <CardBody>
                  {piece.records.length === 0 ? (
                    <EmptyState title={tr(locale, 'No work recorded yet', 'لم يُسجّل أي عمل بعد')} />
                  ) : (
                    <ul className="space-y-2">
                      {piece.records.map((r) => (
                        <li key={r.id} className="flex items-center justify-between rounded-lg border border-neutral-100 p-3 text-sm">
                          <div>
                            <div className="font-medium text-neutral-800">
                              {r.quantity} × {formatAmount(r.applied_rate)} = {formatAmount(r.amount)}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {[r.work_category, r.product_size].filter(Boolean).join(' · ')} · {formatDate(r.work_date)}
                              {r.paid ? ` · ${tr(locale, 'in payroll', 'ضمن الرواتب')}` : ''}
                            </div>
                          </div>
                          {!r.paid ? (
                            <form action={deleteWorkRecord}>
                              <input type="hidden" name="recordId" value={r.id} />
                              <input type="hidden" name="employeeId" value={id} />
                              <button type="submit" aria-label={tr(locale, 'Remove', 'إزالة')} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-amber-600">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </form>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </>
          ) : null}

          {adv ? (
            <Card>
              <CardHeader title={tr(locale, 'Advances', 'السلف')} description={`${tr(locale, 'Total', 'المجموع')}: ${formatAmount(adv.total)}`} />
              <CardBody className="space-y-4">
                {canPay ? <AdvanceForm employeeId={id} today={today} /> : null}
                {adv.advances.length === 0 ? (
                  <p className="text-sm text-neutral-400">{tr(locale, 'No advances recorded.', 'لا توجد سلف مسجلة.')}</p>
                ) : (
                  <ul className="space-y-2">
                    {adv.advances.map((a) => (
                      <li key={a.id} className="flex justify-between rounded-lg border border-neutral-100 p-3 text-sm">
                        <span className="text-neutral-500">{formatDate(a.advance_date)}</span>
                        <span className="font-semibold text-amber-600">{formatAmount(a.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
