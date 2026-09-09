import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requirePermission } from '@/lib/auth/permissions';
import {
  getFixedWorkers,
  getAttendanceMonth,
  monthStartOf,
  shiftMonth,
  daysInMonth,
} from '@/lib/attendance/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { AttendanceEditor } from '@/components/attendance/AttendanceEditor';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Attendance — Nahla Cake Panel' };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requirePermission('payroll.view');
  const locale = await getLocale();
  const sp = await searchParams;

  const monthStart = monthStartOf(sp.month);
  const prev = shiftMonth(monthStart, -1);
  const next = shiftMonth(monthStart, 1);
  const thisMonth = monthStartOf();

  const [workers, initial] = await Promise.all([getFixedWorkers(), getAttendanceMonth(monthStart)]);

  const monthLabel = new Date(`${monthStart}T00:00:00`).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  });
  const href = (m: string) => `/attendance?month=${m}`;

  return (
    <>
      <PageHeader
        title={tr(locale, 'Attendance', 'الحضور')}
        description={tr(
          locale,
          'Mark absences for fixed-rate staff. Absent days are deducted from their salary; per-order workers are paid from their Production Sheet.',
          'سجّل غيابات العمال بأجر ثابت. تُخصم أيام الغياب من الراتب؛ عمال القطعة يُدفع لهم من ورقة الإنتاج.',
        )}
      />

      {/* Month navigation */}
      <div className="mb-6 flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <Link
          href={href(prev)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          <ChevronLeft className="h-4 w-4" />
          {tr(locale, 'Previous', 'السابق')}
        </Link>
        <div className="text-center">
          <p className="text-sm font-semibold text-neutral-800">{monthLabel}</p>
          {monthStart !== thisMonth ? (
            <Link href={href(thisMonth)} className="text-xs font-medium text-amber-600 hover:underline">
              {tr(locale, 'This month', 'هذا الشهر')}
            </Link>
          ) : (
            <span className="text-xs text-neutral-400">{tr(locale, 'This month', 'هذا الشهر')}</span>
          )}
        </div>
        <Link
          href={href(next)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
        >
          {tr(locale, 'Next', 'التالي')}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <AttendanceEditor
        key={monthStart}
        monthStart={monthStart}
        daysInMonth={daysInMonth(monthStart)}
        workers={workers}
        initial={initial}
      />
    </>
  );
}
