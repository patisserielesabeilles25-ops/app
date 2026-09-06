import Link from 'next/link';
import { Search, Users, ExternalLink, Cake } from 'lucide-react';
import { requirePermission } from '@/lib/auth/permissions';
import { getClients } from '@/lib/clients/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClientBadges } from '@/components/clients/ClientBadges';
import { formatDate } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Clients — Nahla Cake Panel' };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermission('orders.view');
  const locale = await getLocale();
  const { q = '' } = await searchParams;
  const clients = await getClients({ q });

  return (
    <>
      <PageHeader
        title={tr(locale, 'Clients', 'العملاء')}
        description={tr(locale, 'Every customer, their contact details, birthdays, and order history.', 'كل عميل، بيانات الاتصال، تواريخ الميلاد، وسجل الطلبات.')}
      />

      <form method="get" className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder={tr(locale, 'Search by name or phone…', 'ابحث بالاسم أو الهاتف…')}
            className="w-full rounded-lg border border-neutral-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-amber-500"
        >
          {tr(locale, 'Search', 'بحث')}
        </button>
      </form>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tr(locale, 'No clients found', 'لا يوجد عملاء')}
          description={tr(locale, 'Clients are created automatically when you register an order. Try a different search.', 'يُنشأ العملاء تلقائيًا عند تسجيل طلب. جرّب بحثًا مختلفًا.')}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Client', 'العميل')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Phone', 'الهاتف')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Birthday', 'تاريخ الميلاد')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Orders', 'الطلبات')}</th>
                  <th className="px-4 py-3 font-semibold">{tr(locale, 'Last order', 'آخر طلب')}</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/clients/${c.id}`}
                          className="font-medium text-amber-600 hover:underline"
                        >
                          {c.name}
                        </Link>
                        <ClientBadges delivered={c.delivered_count} returned={c.returned_count} locale={locale} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{c.phone}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {c.date_of_birth ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Cake className="h-3.5 w-3.5 text-neutral-400" />
                          {formatDate(c.date_of_birth)}
                        </span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{c.total_orders}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {c.last_order_date ? formatDate(c.last_order_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/orders?q=${encodeURIComponent(c.phone)}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-amber-600"
                      >
                        {tr(locale, 'Orders', 'الطلبات')}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
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
