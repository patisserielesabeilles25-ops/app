import Link from 'next/link';
import { Plus, Minus, Wallet, ArrowRight } from 'lucide-react';
import { requirePermission, getMyPermissions, forbidForRoles } from '@/lib/auth/permissions';
import { getFinanceOverview, type Summary } from '@/lib/finance/reports';
import { getTransactions } from '@/lib/finance/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';
import { TransactionsTable } from '@/components/finance/TransactionsTable';
import { formatAmount } from '@/lib/utils';
import { tr } from '@/lib/i18n/t';
import { getLocale } from '@/lib/i18n/server';
import type { Locale } from '@/lib/i18n/config';

export const metadata = { title: 'Finance — Nahla Cake Panel' };

function PeriodCard({ label, s, locale }: { label: string; s: Summary; locale: Locale }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
        <p className="mt-2 text-lg font-bold text-neutral-900">{formatAmount(s.net)}</p>
        <p className="mt-0.5 text-xs text-neutral-400">{tr(locale, 'net', 'صافي')}</p>
        <div className="mt-3 flex justify-between border-t border-neutral-100 pt-2 text-xs">
          <span className="text-emerald-600">+{formatAmount(s.income)}</span>
          <span className="text-amber-600">−{formatAmount(s.expense)}</span>
        </div>
      </CardBody>
    </Card>
  );
}

function Breakdown({
  title,
  rows,
  locale,
}: {
  title: string;
  rows: { label: string; value: number }[];
  locale: Locale;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {rows.length === 0 ? (
          <p className="text-sm text-neutral-400">{tr(locale, 'Nothing this month.', 'لا شيء هذا الشهر.')}</p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.label}>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-700">{r.label}</span>
                  <span className="font-medium text-neutral-800">{formatAmount(r.value)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-amber-300" style={{ width: `${(r.value / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export default async function FinanceOverviewPage() {
  await requirePermission('finance.view');
  await forbidForRoles(['vendeur']);
  const locale = await getLocale();
  const perms = await getMyPermissions();
  const canReport = perms.has('finance.transactions.view') || perms.has('finance.reports.view');
  const canViewTx = perms.has('finance.transactions.view');
  const canViewAtt = perms.has('finance.attachments.view');
  const canEditTx = perms.has('finance.reverse');
  const canDeleteTx = perms.has('settings.manage');

  return (
    <>
      <PageHeader
        title={tr(locale, 'Finance Overview', 'نظرة عامة على المالية')}
        description={tr(locale, 'Central treasury, activity, and breakdowns.', 'الخزينة المركزية والنشاط والتفاصيل.')}
        action={
          <div className="flex flex-wrap gap-2">
            {perms.has('finance.income.create') ? (
              <LinkButton href="/finance/income/new"><Plus className="h-4 w-4" />{tr(locale, 'Income', 'دخل')}</LinkButton>
            ) : null}
            {perms.has('finance.expense.create') ? (
              <LinkButton href="/finance/expense/new" variant="secondary"><Minus className="h-4 w-4" />{tr(locale, 'Expense', 'مصروف')}</LinkButton>
            ) : null}
          </div>
        }
      />

      {!canReport ? (
        <Card><CardBody><p className="text-sm text-neutral-400">{tr(locale, "You don't have permission to view financial reports.", 'ليس لديك إذن لعرض التقارير المالية.')}</p></CardBody></Card>
      ) : (
        <FinanceBody canViewTx={canViewTx} canViewAtt={canViewAtt} canEdit={canEditTx} canDelete={canDeleteTx} />
      )}
    </>
  );
}

async function FinanceBody({ canViewTx, canViewAtt, canEdit, canDelete }: { canViewTx: boolean; canViewAtt: boolean; canEdit: boolean; canDelete: boolean }) {
  const locale = await getLocale();
  const o = await getFinanceOverview();
  const incomeCats = o.monthCategories.filter((c) => c.income > 0).map((c) => ({ label: c.category_name, value: c.income }));
  const expenseCats = o.monthCategories.filter((c) => c.expense > 0).map((c) => ({ label: c.category_name, value: c.expense }));
  const depts = o.monthDepartments.map((d) => ({ label: d.department, value: Math.abs(d.net) }));

  const recent = canViewTx ? (await getTransactions()).slice(0, 8) : [];

  return (
    <div className="space-y-8">
      {/* Balance hero */}
      <Card>
        <CardBody className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Wallet className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{tr(locale, 'Current treasury balance', 'رصيد الخزينة الحالي')}</p>
            <p className="text-3xl font-bold text-neutral-900">{formatAmount(o.balance)}</p>
          </div>
        </CardBody>
      </Card>

      {/* Period cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <PeriodCard label={tr(locale, 'Today', 'اليوم')} s={o.today} locale={locale} />
        <PeriodCard label={tr(locale, 'This week', 'هذا الأسبوع')} s={o.week} locale={locale} />
        <PeriodCard label={tr(locale, 'This month', 'هذا الشهر')} s={o.month} locale={locale} />
        <PeriodCard label={tr(locale, 'This year', 'هذه السنة')} s={o.year} locale={locale} />
      </div>

      {/* Breakdowns (this month) */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">{tr(locale, 'This month', 'هذا الشهر')}</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Breakdown title={tr(locale, 'Income by category', 'الدخل حسب الفئة')} rows={incomeCats} locale={locale} />
          <Breakdown title={tr(locale, 'Expenses by category', 'المصروفات حسب الفئة')} rows={expenseCats} locale={locale} />
          <Breakdown title={tr(locale, 'By department (net)', 'حسب القسم (صافي)')} rows={depts} locale={locale} />
        </div>
      </div>

      {/* Recent transactions */}
      {canViewTx ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">{tr(locale, 'Recent transactions', 'المعاملات الأخيرة')}</h2>
            <Link href="/finance/transactions" className="inline-flex items-center gap-1 text-sm text-amber-600 hover:underline">
              {tr(locale, 'View all', 'عرض الكل')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <TransactionsTable rows={recent} canViewAttachments={canViewAtt} canEdit={canEdit} canDelete={canDelete} locale={locale} />
        </div>
      ) : null}
    </div>
  );
}
