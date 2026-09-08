import Link from 'next/link';
import { forbidden } from 'next/navigation';
import { ChevronLeft, ChevronRight, Printer, Eye } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { getMyRoleKeys } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { getAgents } from '@/lib/agents/queries';
import { getProductionLogFor, weekStartOf, addDays } from '@/lib/production/queries';
import { SHEETS, type SheetKey } from '@/lib/production/rows';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProductionLogEditor } from '@/components/production/ProductionLogEditor';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Production Sheets — Nahla Cake Panel' };

export default async function ProductionSheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; user?: string }>;
}) {
  const locale = await getLocale();
  const user = await requireUser();
  const roles = await getMyRoleKeys();

  const isMaster = roles.has('admin');
  const canMasquage = isMaster || roles.has('maskage');
  const canPreparation = isMaster || roles.has('preparateur');

  // Which sheets this user may see. Masters see both; workers see their own kind.
  const sheets: SheetKey[] = isMaster
    ? SHEETS
    : SHEETS.filter((s) => (s === 'MASQUAGE' ? canMasquage : canPreparation));

  // No sheet role → no access.
  if (sheets.length === 0) forbidden();

  const sp = await searchParams;
  const weekStart = weekStartOf(sp.week);
  const weekEnd = addDays(weekStart, 6);
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const thisWeek = weekStartOf();

  // A master can view any worker's sheet (read-only); everyone else sees theirs.
  const workers = isMaster ? await getAgents() : [];
  const viewingId = isMaster && sp.user ? sp.user : user.id;
  const readOnly = viewingId !== user.id;

  const supabase = await createClient();
  const [entries, { data: profile }] = await Promise.all([
    getProductionLogFor(viewingId, weekStart),
    supabase.from('profiles').select('full_name').eq('id', viewingId).maybeSingle(),
  ]);
  const viewingName = profile?.full_name?.trim() || (viewingId === user.id ? user.email : '') || '';

  const href = (params: { week?: string; user?: string }) => {
    const w = params.week ?? weekStart;
    const u = params.user ?? (isMaster && sp.user ? sp.user : undefined);
    const qs = new URLSearchParams({ week: w });
    if (u && u !== user.id) qs.set('user', u);
    return `/production-sheets?${qs.toString()}`;
  };

  return (
    <>
      <PageHeader
        title={
          readOnly
            ? tr(locale, `${viewingName}'s sheet`, `ورقة ${viewingName}`)
            : tr(locale, 'My production sheet', 'ورقة إنتاجي')
        }
        description={
          readOnly
            ? tr(locale, 'Read-only view (Master).', 'عرض للقراءة فقط (المشرف).')
            : tr(
                locale,
                `${viewingName} — enter how many pieces you finished each day, then save.`,
                `${viewingName} — أدخل عدد القطع التي أنجزتها كل يوم، ثم احفظ.`,
              )
        }
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

      {/* Master: pick whose sheet to view. */}
      {isMaster && workers.length > 0 ? (
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <input type="hidden" name="week" value={weekStart} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="user" className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-700">
              <Eye className="h-4 w-4" />
              {tr(locale, 'View a worker’s sheet', 'عرض ورقة عامل')}
            </label>
            <select
              id="user"
              name="user"
              defaultValue={viewingId === user.id ? '' : viewingId}
              className="rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              <option value="">{tr(locale, 'My own sheet', 'ورقتي أنا')}</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
            {tr(locale, 'View', 'عرض')}
          </button>
        </form>
      ) : null}

      {/* Week navigation */}
      <div className="mb-6 flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <Link
          href={href({ week: prevWeek })}
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
            <Link href={href({ week: thisWeek })} className="text-xs font-medium text-amber-600 hover:underline">
              {tr(locale, 'Go to this week', 'الذهاب إلى هذا الأسبوع')}
            </Link>
          ) : (
            <span className="text-xs text-neutral-400">{tr(locale, 'This week', 'هذا الأسبوع')}</span>
          )}
        </div>
        <Link
          href={href({ week: nextWeek })}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          {tr(locale, 'Next week', 'الأسبوع التالي')}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Editable grid — keyed by week + viewed user so inputs reset on change. */}
      <ProductionLogEditor
        key={`${weekStart}:${viewingId}`}
        weekStart={weekStart}
        initial={entries}
        sheets={sheets}
        readOnly={readOnly}
      />
    </>
  );
}
