import Link from 'next/link';
import { ArrowLeft, X } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getTransactions } from '@/lib/finance/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { TransactionsTable } from '@/components/finance/TransactionsTable';
import { tr } from '@/lib/i18n/t';
import { getLocale } from '@/lib/i18n/server';
import type { Locale } from '@/lib/i18n/config';

export const metadata = { title: 'Transactions — Nahla Cake Panel' };

function filterLabel(locale: Locale, value: string): string {
  if (value === 'INCOME') return tr(locale, 'Income', 'دخل');
  if (value === 'EXPENSE') return tr(locale, 'Expenses', 'المصروفات');
  return tr(locale, 'All', 'الكل');
}

const FILTERS = [
  { value: '' },
  { value: 'INCOME' },
  { value: 'EXPENSE' },
];

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string; from?: string; to?: string;
    department?: string; source?: string; categoryId?: string; label?: string;
  }>;
}) {
  await requirePermission('finance.transactions.view');
  const locale = await getLocale();
  const sp = await searchParams;
  const perms = await getMyPermissions();
  const canViewAtt = perms.has('finance.attachments.view');
  const canEditTx = perms.has('finance.reverse');
  const canDeleteTx = perms.has('settings.manage');

  const filterType = sp.type === 'INCOME' || sp.type === 'EXPENSE' ? sp.type : undefined;
  const hasScope = Boolean(sp.from || sp.department || sp.source || sp.categoryId);

  const rows = await getTransactions({
    type: filterType,
    from: sp.from,
    to: sp.to,
    department: sp.department,
    source: sp.source,
    categoryId: sp.categoryId,
  });

  return (
    <>
      <Link href="/finance" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to finance', 'العودة إلى المالية')}
      </Link>
      <PageHeader title={tr(locale, 'Transactions', 'المعاملات')} description={tr(locale, 'The full financial ledger.', 'دفتر الأستاذ المالي الكامل.')} />

      {hasScope ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <span>{tr(locale, 'Filtered', 'مُصفّى')}{sp.label ? `: ${sp.label}` : ''}</span>
          <Link href="/finance/transactions" className="ml-auto inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100">
            <X className="h-3 w-3" /> {tr(locale, 'Clear', 'مسح')}
          </Link>
        </div>
      ) : (
        <div className="mb-4 flex gap-2">
          {FILTERS.map((f) => {
            const active = (f.value === '' && !filterType) || f.value === filterType;
            return (
              <Link
                key={f.value}
                href={f.value ? `/finance/transactions?type=${f.value}` : '/finance/transactions'}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? 'bg-amber-400 text-neutral-900' : 'border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100'}`}
              >
                {filterLabel(locale, f.value)}
              </Link>
            );
          })}
        </div>
      )}

      <TransactionsTable rows={rows} canViewAttachments={canViewAtt} canEdit={canEditTx} canDelete={canDeleteTx} locale={locale} />
    </>
  );
}
