import Link from 'next/link';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { requirePermission } from '@/lib/auth/permissions';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getMyProductionLog, weekStartOf, addDays } from '@/lib/production/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProductionLogEditor } from '@/components/production/ProductionLogEditor';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Production Sheets — Nahla Cake Panel' };

export default async function ProductionSheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  await requirePermission('orders.view');
  const locale = await getLocale();
  const user = await requireUser();
  const sp = await searchParams;

  const weekStart = weekStartOf(sp.week);
  const weekEnd = addDays(weekStart, 6);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const thisWeek = weekStartOf();

  const [entries, supabase] = await Promise.all([getMyProductionLog(weekStart), createClient()]);
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();
  const name = profile?.full_name?.trim() || user.email || '';

  const href = (w: string) => `/production-sheets?week=${w}`;

  return (
    <>
      <PageHeader
        title={tr(locale, 'My production sheet', 'ورقة إنتاجي')}
        description={tr(
          locale,
          `${name} — enter how many pieces you finished each day, then save.`,
          `${name} — أدخل عدد القطع التي أنجزتها كل يوم، ثم احفظ.`,
        )}
        action={
          <a
            href="/production-sheets/print"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            <Printer className="h-4 w-4" />
            {tr(locale, 'Print blank sheets', 'طباعة أوراق فارغة')}
          </a>
        }
      />

      {/* Week navigation */}
      <div className="mb-6 flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <Link
          href={href(prevWeek)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          <ChevronLeft className="h-4 w-4" />
          {tr(locale, 'Previous week', 'الأسبوع السابق')}
        </Link>
        <div className="text-center">
          <p className="text-sm font-semibold text-neutral-800">
            {formatDate(weekStart)} — {formatDate(weekEnd)}
          </p>
          {weekStart !== thisWeek ? (
            <Link href={href(thisWeek)} className="text-xs font-medium text-amber-600 hover:underline">
              {tr(locale, 'Go to this week', 'الذهاب إلى هذا الأسبوع')}
            </Link>
          ) : (
            <span className="text-xs text-neutral-400">{tr(locale, 'This week', 'هذا الأسبوع')}</span>
          )}
        </div>
        <Link
          href={href(nextWeek)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          {tr(locale, 'Next week', 'الأسبوع التالي')}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Editable grid — keyed by week so inputs reset when the week changes. */}
      <ProductionLogEditor key={weekStart} weekStart={weekStart} initial={entries} />
    </>
  );
}
