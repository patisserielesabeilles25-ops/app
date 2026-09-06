import Link from 'next/link';
import { ArrowLeft, CheckCircle2, CalendarRange } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getPeriods } from '@/lib/payroll/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PeriodForm } from '@/components/payroll/PeriodForm';
import { formatDate } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Payroll Periods — Nahla Cake Panel' };

export default async function PeriodsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  await requirePermission('payroll.view');
  const locale = await getLocale();
  const { msg } = await searchParams;
  const perms = await getMyPermissions();
  const canManage = perms.has('payroll.manage');
  const periods = await getPeriods();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Link href="/payroll" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to payroll', 'العودة إلى الرواتب')}
      </Link>
      <PageHeader title={tr(locale, 'Payroll Periods', 'فترات الرواتب')} description={tr(locale, 'Create periods and run calculations.', 'أنشئ الفترات ونفّذ الحسابات.')} />

      {msg ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />{msg}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {canManage ? (
          <Card>
            <CardHeader title={tr(locale, 'New period', 'فترة جديدة')} />
            <CardBody><PeriodForm today={today} /></CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title={tr(locale, 'Periods', 'الفترات')} description={`${periods.length}`} />
          <CardBody>
            {periods.length === 0 ? (
              <EmptyState icon={CalendarRange} title={tr(locale, 'No periods yet', 'لا توجد فترات بعد')} />
            ) : (
              <ul className="space-y-2">
                {periods.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/payroll/periods/${p.id}`}
                      className="flex items-center justify-between rounded-lg border border-neutral-100 p-3 text-sm hover:border-amber-300 hover:bg-neutral-50"
                    >
                      <span className="font-medium text-neutral-800">
                        {p.label || `${p.period_type} ${tr(locale, 'period', 'فترة')}`}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {formatDate(p.start_date)} → {formatDate(p.end_date)}
                      </span>
                    </Link>
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
