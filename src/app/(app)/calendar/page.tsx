import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requirePermission } from '@/lib/auth/permissions';
import { getMonthOrders } from '@/lib/calendar/queries';
import { getSignedOrderImageUrl } from '@/lib/orders/images';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { CanonicalStatusBadge } from '@/components/ui/StatusBadge';
import { ImageZoom } from '@/components/orders/ImageZoom';
import { CoatingDot } from '@/components/orders/CoatingDot';
import { orderCanonicalStatus } from '@/lib/statuses/derive';
import { cn, formatDate, formatTime } from '@/lib/utils';
import { tr } from '@/lib/i18n/t';
import { getLocale } from '@/lib/i18n/server';

export const metadata = { title: 'Calendar — Nahla Cake Panel' };

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_AR: Record<string, string> = {
  Mon: 'الإثنين',
  Tue: 'الثلاثاء',
  Wed: 'الأربعاء',
  Thu: 'الخميس',
  Fri: 'الجمعة',
  Sat: 'السبت',
  Sun: 'الأحد',
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; date?: string }>;
}) {
  await requirePermission('calendar.view');
  const locale = await getLocale();
  const sp = await searchParams;

  const now = new Date();
  let year = Number(sp.year) || now.getFullYear();
  let month = Number(sp.month) || now.getMonth() + 1;
  if (month < 1) { month = 12; year -= 1; }
  if (month > 12) { month = 1; year += 1; }
  const selectedDate = sp.date;

  const byDay = await getMonthOrders(year, month);

  // Grid math (Monday-first)
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const prevMonth = { y: month === 1 ? year - 1 : year, m: month === 1 ? 12 : month - 1 };
  const nextMonth = { y: month === 12 ? year + 1 : year, m: month === 12 ? 1 : month + 1 };
  const base = (y: number, m: number, date?: string) =>
    `/calendar?year=${y}&month=${m}${date ? `&date=${date}` : ''}`;

  const selectedOrders = selectedDate ? byDay.get(selectedDate) ?? [] : [];
  // Sign reference-image URLs only for the selected day's orders.
  const selectedWithImages = await Promise.all(
    selectedOrders.map(async (o) => ({
      ...o,
      imageUrl: o.image ? await getSignedOrderImageUrl(o.image.bucket, o.image.object_path) : null,
    })),
  );

  return (
    <>
      <PageHeader
        title={tr(locale, 'Annual Calendar', 'التقويم السنوي')}
        description={tr(locale, 'Orders organized by delivery date.', 'الطلبات مرتبة حسب تاريخ التوصيل.')}
      />

      <Card>
        <CardHeader
          title={monthLabel}
          action={
            <div className="flex items-center gap-1">
              <Link
                href={base(prevMonth.y, prevMonth.m)}
                className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                aria-label={tr(locale, 'Previous month', 'الشهر السابق')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link
                href={base(now.getFullYear(), now.getMonth() + 1)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
              >
                {tr(locale, 'Today', 'اليوم')}
              </Link>
              <Link
                href={base(nextMonth.y, nextMonth.m)}
                className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"
                aria-label={tr(locale, 'Next month', 'الشهر التالي')}
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          }
        />
        <CardBody>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="pb-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-400"
              >
                {tr(locale, w, WEEKDAYS_AR[w])}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const key = `${year}-${pad(month)}-${pad(day)}`;
              const orders = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              const isSelected = key === selectedDate;
              // Any order with a fourrage (added/modified ingredient) turns the whole day red.
              const hasFourage = orders.some((o) => o.fourage);
              return (
                <Link
                  key={key}
                  href={base(year, month, key)}
                  scroll={false}
                  title={hasFourage ? tr(locale, 'Has an order with ingredient changes', 'يوجد طلب بتعديلات على المكوّنات') : undefined}
                  className={cn(
                    'flex min-h-16 flex-col rounded-lg border p-1.5 transition sm:min-h-20',
                    isSelected && hasFourage
                      ? 'border-red-500 bg-red-50 ring-1 ring-red-300'
                      : isSelected
                        ? 'border-amber-400 bg-amber-50'
                        : hasFourage
                          ? 'border-red-300 bg-red-50 hover:border-red-400'
                          : 'border-neutral-200 hover:border-amber-300 hover:bg-neutral-50',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                      isToday ? 'bg-amber-400 font-semibold text-neutral-900' : hasFourage ? 'font-semibold text-red-600' : 'text-neutral-600',
                    )}
                  >
                    {day}
                  </span>
                  {orders.length > 0 ? (
                    <span
                      className={cn(
                        'mt-auto inline-flex items-center gap-1 self-start rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                        hasFourage ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                      )}
                    >
                      {tr(locale, `${orders.length} order${orders.length > 1 ? 's' : ''}`, `${orders.length} طلب`)}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {selectedDate ? (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">
            {formatDate(selectedDate)} ·{' '}
            {tr(
              locale,
              `${selectedOrders.length} order${selectedOrders.length === 1 ? '' : 's'}`,
              `${selectedOrders.length} طلب`,
            )}
          </h2>
          {selectedOrders.length === 0 ? (
            <p className="text-sm text-neutral-400">{tr(locale, 'No orders scheduled for this day.', 'لا توجد طلبات مجدولة لهذا اليوم.')}</p>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{tr(locale, 'Time', 'الوقت')}</th>
                      <th className="px-4 py-3 font-semibold">{tr(locale, 'Order', 'الطلب')}</th>
                      <th className="px-4 py-3 font-semibold">{tr(locale, 'Customer', 'العميل')}</th>
                      <th className="px-4 py-3 font-semibold">{tr(locale, 'Image', 'الصورة')}</th>
                      <th className="px-4 py-3 font-semibold">{tr(locale, 'Size', 'الحجم')}</th>
                      <th className="px-4 py-3 font-semibold">{tr(locale, 'Status', 'الحالة')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {selectedWithImages.map((o) => (
                      <tr key={o.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-3 font-medium text-neutral-800">
                          {formatTime(o.delivery_time)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/orders/${o.id}`}
                              className="font-medium text-amber-600 hover:underline"
                            >
                              {o.order_number}
                            </Link>
                            {o.fourage ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-600"
                                title={`${tr(locale, 'Fourrage', 'الحشوة')}: ${o.fourage}`}
                              >
                                {tr(locale, 'NEW', 'جديد')}
                              </span>
                            ) : null}
                            <CoatingDot coating={o.coating} showLabel={false} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-neutral-700">{o.customer_name}</td>
                        <td className="px-4 py-3">
                          {o.imageUrl ? (
                            <ImageZoom url={o.imageUrl} />
                          ) : (
                            <span className="text-neutral-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{o.cake_size_cm} cm</td>
                        <td className="px-4 py-3">
                          <CanonicalStatusBadge statusKey={orderCanonicalStatus(o)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <p className="mt-6 text-center text-sm text-neutral-400">
          {tr(locale, 'Select a day to see its orders.', 'اختر يوماً لعرض طلباته.')}
        </p>
      )}
    </>
  );
}
