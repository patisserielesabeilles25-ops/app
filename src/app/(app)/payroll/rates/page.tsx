import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Trash2 } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getRates, getEmployees } from '@/lib/payroll/queries';
import { deleteRate } from '@/lib/payroll/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RateForm } from '@/components/payroll/RateForm';
import { formatAmount, formatDate } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Payroll Rates — Nahla Cake Panel' };

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  await requirePermission('payroll.view');
  const locale = await getLocale();
  const { msg } = await searchParams;
  const perms = await getMyPermissions();
  const canManage = perms.has('payroll.manage');

  const [rates, employees] = await Promise.all([getRates(), getEmployees()]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Link href="/payroll" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to payroll', 'العودة إلى الرواتب')}
      </Link>
      <PageHeader title={tr(locale, 'Payroll Rates', 'معدلات الرواتب')} description={tr(locale, 'Configure piece / daily / weekly / monthly rates.', 'إعداد معدلات القطعة / اليومية / الأسبوعية / الشهرية.')} />

      {msg ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />{msg}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {canManage ? (
          <Card>
            <CardHeader title={tr(locale, 'Add rate', 'إضافة معدل')} description={tr(locale, 'Leave employee empty to apply by job.', 'اترك الموظف فارغاً للتطبيق حسب الوظيفة.')} />
            <CardBody>
              <RateForm employees={employees.map((e) => ({ id: e.id, full_name: e.full_name }))} today={today} />
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title={tr(locale, 'Rates', 'المعدلات')} description={`${rates.length} ${tr(locale, 'configured', 'مُعدّ')}`} />
          <CardBody>
            {rates.length === 0 ? (
              <EmptyState title={tr(locale, 'No rates configured', 'لا توجد معدلات مُعدّة')} />
            ) : (
              <ul className="space-y-2">
                {rates.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-lg border border-neutral-100 p-3 text-sm">
                    <div>
                      <div className="font-medium text-neutral-800">
                        {formatAmount(r.rate)} <span className="text-xs font-normal text-neutral-400">/ {r.rate_kind}</span>
                      </div>
                      <div className="text-xs text-neutral-500">
                        {[r.employee_name ?? tr(locale, 'Any', 'الكل'), r.job, r.work_category, r.product_size].filter(Boolean).join(' · ')}
                        {` · ${tr(locale, 'from', 'من')} `}{formatDate(r.effective_from)}
                      </div>
                    </div>
                    {canManage ? (
                      <form action={deleteRate}>
                        <input type="hidden" name="rateId" value={r.id} />
                        <button type="submit" aria-label={tr(locale, 'Remove rate', 'إزالة المعدل')} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-amber-600">
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
      </div>
    </>
  );
}
