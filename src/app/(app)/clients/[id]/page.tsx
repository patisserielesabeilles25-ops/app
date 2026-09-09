import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, CheckCircle2, ClipboardList } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getClient, getClientOrders } from '@/lib/clients/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ClientBadges } from '@/components/clients/ClientBadges';
import { ClientEditForm } from '@/components/clients/ClientEditForm';
import {
  ProductionStatusBadge,
  DeliveryStatusBadge,
  FulfillmentBadge,
} from '@/components/ui/StatusBadge';
import { formatDate, formatTime } from '@/lib/utils';
import { sizeDisplay } from '@/lib/size';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Client — Nahla Cake Panel' };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-800">{value}</span>
    </div>
  );
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  await requirePermission('orders.view');
  const locale = await getLocale();
  const { id } = await params;
  const { updated } = await searchParams;

  const client = await getClient(id);
  if (!client) notFound();

  const orders = await getClientOrders(id);
  const perms = await getMyPermissions();
  const canEdit = perms.has('orders.edit');
  const pending = Math.max(
    0,
    client.total_orders - client.delivered_count - client.returned_count,
  );

  return (
    <>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to clients', 'العودة إلى العملاء')}
      </Link>

      <PageHeader
        title={client.name}
        description={client.phone}
        action={
          <Link
            href={`/orders?q=${encodeURIComponent(client.phone)}`}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            {tr(locale, 'View all orders', 'عرض كل الطلبات')}
            <ExternalLink className="h-4 w-4" />
          </Link>
        }
      />

      {updated ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          {tr(locale, 'Client updated.', 'تم تحديث العميل.')}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={tr(locale, 'Orders', 'الطلبات')} description={tr(locale, `${client.total_orders} total`, `${client.total_orders} المجموع`)} />
            <CardBody className="pt-1">
              {orders.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-neutral-400">
                  <ClipboardList className="h-6 w-6" />
                  {tr(locale, 'No orders yet.', 'لا توجد طلبات بعد.')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-neutral-100 text-left text-xs uppercase tracking-wider text-neutral-500">
                      <tr>
                        <th className="px-2 py-2 font-semibold">{tr(locale, 'Order', 'الطلب')}</th>
                        <th className="px-2 py-2 font-semibold">{tr(locale, 'Delivery', 'التسليم')}</th>
                        <th className="px-2 py-2 font-semibold">{tr(locale, 'Size', 'الحجم')}</th>
                        <th className="px-2 py-2 font-semibold">{tr(locale, 'Status', 'الحالة')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-neutral-50">
                          <td className="px-2 py-2.5">
                            <Link
                              href={`/orders/${o.id}`}
                              className="font-medium text-amber-600 hover:underline"
                            >
                              {o.order_number}
                            </Link>
                          </td>
                          <td className="px-2 py-2.5 text-neutral-600">
                            {formatDate(o.delivery_date)}
                            <span className="text-neutral-400"> · {formatTime(o.delivery_time)}</span>
                          </td>
                          <td className="px-2 py-2.5 text-neutral-600">{sizeDisplay(o.size_label, o.cake_size_cm)}</td>
                          <td className="px-2 py-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              {o.returned_at ? (
                                <Badge tone="rose">{tr(locale, 'Returned', 'مُرتجع')}</Badge>
                              ) : (
                                <>
                                  <ProductionStatusBadge status={o.production_status} />
                                  {o.delivery_status ? (
                                    <DeliveryStatusBadge status={o.delivery_status} />
                                  ) : (
                                    <FulfillmentBadge value={o.fulfillment} />
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={tr(locale, 'Standing', 'الوضعية')} />
            <CardBody className="pt-1">
              <div className="mb-3">
                <ClientBadges
                  delivered={client.delivered_count}
                  returned={client.returned_count}
                  size="md"
                  locale={locale}
                />
              </div>
              <div className="divide-y divide-neutral-100">
                <Row label={tr(locale, 'Delivered', 'مُسلّم')} value={client.delivered_count} />
                <Row label={tr(locale, 'Returned', 'مُرتجع')} value={client.returned_count} />
                <Row label={tr(locale, 'In progress', 'قيد التنفيذ')} value={pending} />
                <Row
                  label={tr(locale, 'Birthday', 'تاريخ الميلاد')}
                  value={client.date_of_birth ? formatDate(client.date_of_birth) : '—'}
                />
                <Row label={tr(locale, 'Client since', 'عميل منذ')} value={formatDate(client.created_at.slice(0, 10))} />
              </div>
            </CardBody>
          </Card>

          {canEdit ? (
            <Card>
              <CardHeader title={tr(locale, 'Edit client', 'تعديل العميل')} />
              <CardBody>
                <ClientEditForm
                  client={{
                    id: client.id,
                    name: client.name,
                    phone: client.phone,
                    date_of_birth: client.date_of_birth,
                    notes: client.notes,
                  }}
                />
              </CardBody>
            </Card>
          ) : client.notes ? (
            <Card>
              <CardHeader title={tr(locale, 'Notes', 'ملاحظات')} />
              <CardBody className="pt-1 text-sm text-neutral-600">{client.notes}</CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
