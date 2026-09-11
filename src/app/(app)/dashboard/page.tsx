import Link from 'next/link';
import {
  CalendarDays, CalendarRange, Sparkles, FlaskConical, CheckCircle2,
  Wallet, TrendingUp, TrendingDown, type LucideIcon,
} from 'lucide-react';
import { requirePermission, getMyPermissions, getMyRoleKeys } from '@/lib/auth/permissions';
import { getDashboardStats, getTodayOrders } from '@/lib/dashboard/queries';
import { getFinanceSummary } from '@/lib/finance/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductionStatusBadge, DeliveryStatusBadge } from '@/components/ui/StatusBadge';
import { formatAmount, formatTime } from '@/lib/utils';
import { sizeDisplay } from '@/lib/size';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Dashboard — Nahla Cake Panel' };

function Tile({
  label, value, icon: Icon, href, tone,
}: {
  label: string; value: string | number; icon: LucideIcon; href: string; tone: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition hover:border-amber-300 hover:shadow-md">
        <div className="flex items-center gap-4 p-5">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
            <p className="text-2xl font-bold text-neutral-900">{value}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  await requirePermission('dashboard.view');
  const locale = await getLocale();
  const perms = await getMyPermissions();
  const roles = await getMyRoleKeys();
  // Finance summary is hidden from the Vendeur role (admins always exempt).
  const canFinance =
    perms.has('finance.transactions.view') && (roles.has('admin') || !roles.has('vendeur'));

  const stats = await getDashboardStats();
  const todayOrders = await getTodayOrders();
  const finance = canFinance ? await getFinanceSummary() : null;

  return (
    <>
      <PageHeader title={tr(locale, 'Dashboard', 'لوحة التحكم')} description={tr(locale, 'Today at a glance.', 'نظرة سريعة على اليوم.')} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label={tr(locale, "Today's orders", 'طلبات اليوم')} value={stats.todayCount} icon={CalendarDays} href="/calendar" tone="bg-amber-100 text-amber-700" />
        <Tile label={tr(locale, 'New', 'جديد')} value={stats.newCount} icon={Sparkles} href="/orders?status=NOUVEAU" tone="bg-amber-100 text-amber-700" />
        <Tile label={tr(locale, 'In production', 'قيد التحضير')} value={stats.inProduction} icon={FlaskConical} href="/orders?status=EN_PREPARATION" tone="bg-amber-100 text-amber-700" />
        <Tile label={tr(locale, 'Ready', 'جاهز')} value={stats.ready} icon={CheckCircle2} href="/orders?status=READY" tone="bg-emerald-100 text-emerald-700" />
        <Tile label={tr(locale, 'This week', 'هذا الأسبوع')} value={stats.weekCount} icon={CalendarRange} href="/calendar" tone="bg-neutral-100 text-neutral-700" />
      </div>

      {canFinance && finance ? (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-neutral-700">{tr(locale, 'Finance', 'المالية')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Tile label={tr(locale, 'Balance', 'الرصيد')} value={formatAmount(finance.balance)} icon={Wallet} href="/finance" tone="bg-amber-100 text-amber-700" />
            <Tile label={tr(locale, 'Total income', 'إجمالي الدخل')} value={formatAmount(finance.incomeTotal)} icon={TrendingUp} href="/finance/transactions?type=INCOME" tone="bg-emerald-100 text-emerald-700" />
            <Tile label={tr(locale, 'Total expenses', 'إجمالي المصاريف')} value={formatAmount(finance.expenseTotal)} icon={TrendingDown} href="/finance/transactions?type=EXPENSE" tone="bg-amber-100 text-amber-700" />
          </div>
        </>
      ) : null}

      <h2 className="mb-3 mt-8 text-sm font-semibold text-neutral-700">
        {tr(locale, "Today's deliveries & pickups", 'تسليمات واستلامات اليوم')}
      </h2>
      {todayOrders.length === 0 ? (
        <EmptyState icon={CalendarDays} title={tr(locale, 'Nothing scheduled for today', 'لا يوجد شيء مجدول لليوم')} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Time', 'الوقت')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Order', 'الطلب')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Customer', 'العميل')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Size', 'الحجم')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Status', 'الحالة')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {todayOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">{formatTime(o.delivery_time)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/orders/${o.id}`} className="font-medium text-amber-600 hover:underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{o.customer_name}</td>
                    <td className="px-4 py-3 text-neutral-600">{sizeDisplay(o.size_label, o.cake_size_cm)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <ProductionStatusBadge status={o.production_status} />
                        {o.delivery_status ? <DeliveryStatusBadge status={o.delivery_status} /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
