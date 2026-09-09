import { notFound } from 'next/navigation';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getOrderDetail } from '@/lib/orders/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { EditOrderForm } from '@/components/orders/EditOrderForm';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Edit Order — Nahla Cake Panel' };

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('orders.edit');
  const locale = await getLocale();
  const { id } = await params;
  const { order, financials } = await getOrderDetail(id);
  if (!order) notFound();

  const perms = await getMyPermissions();
  const canFinance = perms.has('finance.view');

  return (
    <>
      <PageHeader
        title={`${tr(locale, 'Edit', 'تعديل')} ${order.order_number}`}
        description={tr(locale, 'Update order details.', 'تحديث تفاصيل الطلب.')}
      />
      <Card className="max-w-3xl">
        <CardBody>
          <EditOrderForm
            canFinance={canFinance}
            defaults={{
              id: order.id,
              customerName: order.customer_name,
              customerPhone: order.customer_phone,
              cakeSizeCm: order.cake_size_cm,
              description: order.description ?? '',
              fourage: order.fourage ?? '',
              coating: order.coating ?? '',
              deliveryDate: order.delivery_date,
              deliveryTime: order.delivery_time.slice(0, 5),
              deliveryRequired: order.delivery_required,
              totalAmount: financials?.total_amount,
              montageAmount: financials?.montage_amount,
              advancePayment: financials?.advance_payment,
              deliveryAmount: financials?.delivery_amount,
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}
