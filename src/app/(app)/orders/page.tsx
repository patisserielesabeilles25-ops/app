import Link from 'next/link';
import { ShoppingCart, Plus, ClipboardList, CheckCircle2, Printer, Phone, MessageCircle, Pencil } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getOrders, getOrderStatusCounts } from '@/lib/orders/queries';
import { getAgents } from '@/lib/agents/queries';
import { OrderStageAdvance } from '@/components/orders/OrderStageAdvance';
import { ImageZoom } from '@/components/orders/ImageZoom';
import { OrderPayDialog } from '@/components/orders/OrderPayDialog';
import { OrderSelectionProvider, OrderSelectRadio } from '@/components/orders/OrderSelection';
import { OrdersActionBar } from '@/components/orders/OrdersActionBar';
import { ClientBadges } from '@/components/clients/ClientBadges';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  CanonicalStatusBadge,
  DeliveryStatusBadge,
  FulfillmentBadge,
} from '@/components/ui/StatusBadge';
import { CANONICAL_STATUSES } from '@/lib/statuses/constants';
import { orderCanonicalStatus } from '@/lib/statuses/derive';
import { formatDate, formatTime, formatAmount, waNumber, cn } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Commandes — Nahla Cake Panel' };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; deleted?: string }>;
}) {
  await requirePermission('orders.view');
  const locale = await getLocale();
  const sp = await searchParams;
  const q = sp.q ?? '';
  const status = sp.status ?? '';

  const perms = await getMyPermissions();
  const canCreate = perms.has('orders.create');
  const canEdit = perms.has('orders.edit');
  const canDelete = perms.has('orders.delete');
  const canProduce = perms.has('production.update') || canEdit;
  const canRecordPayment = perms.has('finance.income.create');
  const canViewFinance = perms.has('finance.view') || perms.has('finance.transactions.view');

  const [orders, counts, employeeOptions] = await Promise.all([
    getOrders({ q, status, withBalances: canViewFinance || canRecordPayment }),
    getOrderStatusCounts(),
    canProduce || canRecordPayment ? getAgents() : Promise.resolve([]),
  ]);
  const toolbarOrders = orders.map((o) => ({
    id: o.id,
    order_number: o.order_number,
    delivery_date: o.delivery_date,
    delivery_time: o.delivery_time,
    fulfillment: o.fulfillment,
    returned_at: o.returned_at,
    reported_at: o.reported_at,
  }));

  const buildUrl = (key: string) => {
    const p = new URLSearchParams();
    if (key) p.set('status', key);
    if (q) p.set('q', q);
    const s = p.toString();
    return s ? `/orders?${s}` : '/orders';
  };

  const tabs = [
    { key: '', label: tr(locale, 'All', 'الكل'), count: counts.total },
    ...CANONICAL_STATUSES.map((s) => ({ key: s.key, label: s.label, count: counts.byCanonical[s.key] ?? 0 })),
  ];

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-neutral-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{tr(locale, 'Orders', 'الطلبات')}</h1>
            <p className="text-sm text-neutral-500">{counts.total} {tr(locale, 'order(s)', 'طلب')}</p>
          </div>
        </div>
        {canCreate ? (
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-2 self-start rounded-lg bg-amber-400 px-5 py-3 text-sm font-semibold text-neutral-900 hover:bg-amber-500 sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            {tr(locale, 'New order', 'طلب جديد')}
          </Link>
        ) : null}
      </div>

      {/* Status tabs */}
      <div className="overflow-x-auto border-b border-neutral-100">
        <nav className="flex min-w-max items-center gap-1 px-3">
          {tabs.map((t) => {
            const active = (status || '') === t.key;
            return (
              <Link
                key={t.key || 'all'}
                href={buildUrl(t.key)}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition',
                  active ? 'border-amber-600 text-amber-700' : 'border-transparent text-neutral-500 hover:text-neutral-800',
                )}
              >
                {t.label}
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', active ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-500')}>
                  {t.count}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Search */}
      <div className="px-5 py-4">
        <form method="get" className="flex gap-3">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder={tr(locale, 'Reference, customer…', 'المرجع، العميل…')}
            className="w-full max-w-md rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <button type="submit" className="rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-amber-500">
            {tr(locale, 'Search', 'بحث')}
          </button>
        </form>
      </div>

      <OrderSelectionProvider>
      <OrdersActionBar orders={toolbarOrders} canEdit={canEdit} canDelete={canDelete} />

      {sp.deleted ? (
        <div className="mx-5 mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          {tr(locale, 'Order deleted.', 'تم حذف الطلب.')}
        </div>
      ) : null}

      {/* List */}
      {orders.length === 0 ? (
        <div className="px-5 pb-6">
          <EmptyState icon={ClipboardList} title={tr(locale, 'No orders', 'لا توجد طلبات')} description={tr(locale, 'Try adjusting your search or filters.', 'حاول تعديل البحث أو عوامل التصفية.')} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Reference', 'المرجع')}</th>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Customer', 'العميل')}</th>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Delivery', 'التوصيل')}</th>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Product', 'المنتج')}</th>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Image', 'الصورة')}</th>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Size', 'الحجم')}</th>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Type', 'النوع')}</th>
                <th className="px-4 py-3 font-semibold">{tr(locale, 'Status', 'الحالة')}</th>
                {canProduce ? <th className="px-4 py-3 font-semibold">{tr(locale, 'Production', 'الإنتاج')}</th> : null}
                {canEdit || canRecordPayment ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-center">
                    <OrderSelectRadio orderId={o.id} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/orders/${o.id}`} className="font-medium text-amber-600 hover:underline">
                        {o.order_number}
                      </Link>
                      <a
                        href={`/orders/${o.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={tr(locale, 'Print the order form', 'طباعة وصل الطلب')}
                        className="text-neutral-400 hover:text-amber-600"
                      >
                        <Printer className="h-4 w-4" />
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="text-neutral-800">{o.customer_name}</span>
                      <ClientBadges delivered={o.client_delivered} returned={o.client_returned} locale={locale} />
                      {o.fourage ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-600"
                          title={`${tr(locale, 'Fourrage', 'الحشوة')}: ${o.fourage}`}
                        >
                          {tr(locale, 'NEW', 'جديد')}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <span>{o.customer_phone}</span>
                      <a
                        href={`https://wa.me/${waNumber(o.customer_phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="WhatsApp"
                        className="text-emerald-500 hover:text-emerald-600"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                      <a href={`tel:${o.customer_phone}`} title={tr(locale, 'Call', 'اتصال')} className="text-amber-500 hover:text-amber-600">
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    {o.remaining && o.remaining > 0 ? (
                      <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                        {tr(locale, 'Remaining', 'المتبقي')} {formatAmount(o.remaining)} DA
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {formatDate(o.delivery_date)}
                    <span className="text-neutral-400"> · {formatTime(o.delivery_time)}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{o.product_name || <span className="text-neutral-300">—</span>}</td>
                  <td className="px-4 py-3">
                    {o.image_url ? (
                      <ImageZoom url={o.image_url} />
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{o.cake_size_cm} cm</td>
                  <td className="px-4 py-3">
                    <FulfillmentBadge value={o.fulfillment} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <CanonicalStatusBadge statusKey={orderCanonicalStatus(o)} />
                      {o.delivery_status === 'OUT_FOR_DELIVERY' ? (
                        <DeliveryStatusBadge status={o.delivery_status} />
                      ) : null}
                    </div>
                  </td>
                  {canProduce ? (
                    <td className="px-4 py-3">
                      {o.returned_at ? (
                        <span className="text-xs text-neutral-300">—</span>
                      ) : (
                        <OrderStageAdvance orderId={o.id} productionStage={o.production_stage} employees={employeeOptions} />
                      )}
                    </td>
                  ) : null}
                  {canEdit || canRecordPayment ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canRecordPayment && o.remaining && o.remaining > 0 ? (
                          <OrderPayDialog orderId={o.id} orderNumber={o.order_number} remaining={o.remaining} agents={employeeOptions} />
                        ) : null}
                        {canEdit ? (
                          <Link
                            href={`/orders/${o.id}/edit`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {tr(locale, 'Edit', 'تعديل')}
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </OrderSelectionProvider>
    </Card>
  );
}
