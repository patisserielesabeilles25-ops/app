import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Pencil, Send, Trash2, ArrowLeft, CheckCircle2, AlertTriangle, PackageX, Undo2, Truck, Printer } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getOrderDetail, getOrderStatusHistory, getOrderStages } from '@/lib/orders/queries';
import { getEmployees } from '@/lib/payroll/queries';
import { getSignedOrderImageUrl } from '@/lib/orders/images';
import { startProduction, markOutForDelivery, markDelivered, deleteOrder, markOrderReturned, unmarkOrderReturned, unreportOrder } from '@/lib/orders/actions';
import { PaymentForm } from '@/components/orders/PaymentForm';
import { StageForm } from '@/components/orders/StageForm';
import { ReportOrderDialog } from '@/components/orders/ReportOrderDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button, LinkButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  CanonicalStatusBadge,
  DeliveryStatusBadge,
  FulfillmentBadge,
} from '@/components/ui/StatusBadge';
import { orderCanonicalStatus } from '@/lib/statuses/derive';
import { formatAmount, formatDate, formatTime, formatDateTime } from '@/lib/utils';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

const TONE_DOT: Record<string, string> = {
  neutral: 'bg-neutral-400',
  blue: 'bg-amber-500',
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  rose: 'bg-amber-500',
  violet: 'bg-violet-500',
};

export const metadata = { title: 'Order — Nahla Cake Panel' };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-800">{value}</span>
    </div>
  );
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sent?: string;
    updated?: string;
    error?: string;
    paid?: string;
    returned?: string;
    returncleared?: string;
    reported?: string;
    reportcleared?: string;
    ready?: string;
    dispatched?: string;
    delivered?: string;
    created?: string;
    stage?: string;
  }>;
}) {
  await requirePermission('orders.view');
  const locale = await getLocale();
  const { id } = await params;
  const { sent, updated, error, paid, returned, returncleared, reported, reportcleared, ready, dispatched, delivered, created, stage } = await searchParams;

  const { order, financials, image } = await getOrderDetail(id);
  if (!order) notFound();

  const [history, stages, employees] = await Promise.all([
    getOrderStatusHistory(id),
    getOrderStages(id),
    getEmployees(),
  ]);
  const employeeOptions = employees.filter((e) => e.is_active).map((e) => ({ id: e.id, name: e.full_name }));
  const stageDoneBy = new Map(stages.map((s) => [s.stage, s.employee_name]));
  const currentStage =
    order.production_stage === 'EN_PREPARATION' ? 'PREPARATION' :
    order.production_stage === 'EN_MASKAGE' ? 'MASKAGE' :
    order.production_stage === 'EN_FINITION' ? 'FINITION' : null;

  const perms = await getMyPermissions();
  const canEdit = perms.has('orders.edit');
  const canProduce = perms.has('production.update');
  const canDeliver = perms.has('delivery.update');
  const canDelete = perms.has('orders.delete');
  const canRecordPayment = perms.has('finance.income.create');

  const imageUrl = image
    ? await getSignedOrderImageUrl(image.bucket, image.object_path)
    : null;

  return (
    <>
      <Link
        href="/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to orders', 'العودة إلى الطلبات')}
      </Link>

      <PageHeader
        title={order.order_number}
        description={`${tr(locale, 'Created', 'أُنشئ في')} ${formatDate(order.created_at.slice(0, 10))}`}
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href={`/orders/${order.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              <Printer className="h-4 w-4" />
              {tr(locale, 'Print', 'طباعة')}
            </a>
            {order.production_stage === 'NOUVEAU' && (canProduce || canEdit) ? (
              <form action={startProduction}>
                <input type="hidden" name="orderId" value={order.id} />
                <Button type="submit">
                  <Send className="h-4 w-4" />
                  {tr(locale, 'Start production', 'بدء الإنتاج')}
                </Button>
              </form>
            ) : null}
            {order.delivery_status === 'READY' && canDeliver ? (
              <form action={markOutForDelivery}>
                <input type="hidden" name="orderId" value={order.id} />
                <Button type="submit">
                  <Truck className="h-4 w-4" />
                  {tr(locale, 'Out for delivery', 'قيد التوصيل')}
                </Button>
              </form>
            ) : null}
            {order.delivery_status === 'OUT_FOR_DELIVERY' && canDeliver ? (
              <form action={markDelivered}>
                <input type="hidden" name="orderId" value={order.id} />
                <Button type="submit">
                  <CheckCircle2 className="h-4 w-4" />
                  {tr(locale, 'Mark delivered', 'تحديد كمُسلَّم')}
                </Button>
              </form>
            ) : null}
            {canEdit ? (
              <LinkButton href={`/orders/${order.id}/edit`} variant="secondary">
                <Pencil className="h-4 w-4" />
                {tr(locale, 'Edit', 'تعديل')}
              </LinkButton>
            ) : null}
            {canEdit && !order.returned_at ? (
              order.reported_at ? (
                <form action={unreportOrder}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <Button type="submit" variant="secondary">
                    <Undo2 className="h-4 w-4" />
                    {tr(locale, 'Clear report', 'إلغاء التأجيل')}
                  </Button>
                </form>
              ) : (
                <ReportOrderDialog
                  orderId={order.id}
                  defaultDate={order.delivery_date}
                  defaultTime={order.delivery_time.slice(0, 5)}
                  defaultDeliveryRequired={order.fulfillment === 'DELIVERY'}
                />
              )
            ) : null}
            {canEdit && !order.returned_at ? (
              <ConfirmDialog
                triggerLabel={
                  <span className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                    <PackageX className="h-4 w-4" />
                    {tr(locale, 'Mark returned', 'تحديد كمُرتجع')}
                  </span>
                }
                title={tr(locale, 'Mark this order as returned?', 'تحديد هذا الطلب كمُرتجع؟')}
                description={tr(locale, "Use this when the customer returned or refused the order. It will count toward the client's returned badge. You can undo this later.", 'استخدم هذا عندما يُرجع العميل الطلب أو يرفضه. سيُحتسب ضمن شارة المُرتجعات الخاصة بالعميل. يمكنك التراجع عن ذلك لاحقًا.')}
                confirmLabel={tr(locale, 'Mark returned', 'تحديد كمُرتجع')}
                action={markOrderReturned}
                hiddenFields={{ orderId: order.id }}
              />
            ) : null}
            {canEdit && order.returned_at ? (
              <form action={unmarkOrderReturned}>
                <input type="hidden" name="orderId" value={order.id} />
                <Button type="submit" variant="secondary">
                  <Undo2 className="h-4 w-4" />
                  {tr(locale, 'Clear returned', 'إلغاء الإرجاع')}
                </Button>
              </form>
            ) : null}
            {canDelete ? (
              <ConfirmDialog
                triggerLabel={
                  <span className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                    {tr(locale, 'Delete', 'حذف')}
                  </span>
                }
                title={tr(locale, 'Delete this order?', 'حذف هذا الطلب؟')}
                description={tr(locale, 'This cannot be undone. Orders with recorded payments cannot be deleted.', 'لا يمكن التراجع عن هذا. لا يمكن حذف الطلبات التي لها مدفوعات مسجَّلة.')}
                confirmLabel={tr(locale, 'Delete order', 'حذف الطلب')}
                action={deleteOrder}
                hiddenFields={{ orderId: order.id }}
              />
            ) : null}
          </div>
        }
      />

      {created ? <Banner tone="success">{tr(locale, 'Order created.', 'تم إنشاء الطلب.')}</Banner> : null}
      {sent ? (
        <Banner tone="success">{tr(locale, 'Order sent to production.', 'تم إرسال الطلب إلى الإنتاج.')}</Banner>
      ) : null}
      {ready ? <Banner tone="success">{tr(locale, 'Order marked ready.', 'تم تحديد الطلب كجاهز.')}</Banner> : null}
      {stage ? <Banner tone="success">{tr(locale, `Stage ${stage} completed and assigned.`, `تم إنجاز المرحلة ${stage} وإسنادها.`)}</Banner> : null}
      {dispatched ? <Banner tone="success">{tr(locale, 'Order is out for delivery.', 'الطلب قيد التوصيل.')}</Banner> : null}
      {delivered ? <Banner tone="success">{tr(locale, 'Order delivered.', 'تم تسليم الطلب.')}</Banner> : null}
      {updated ? <Banner tone="success">{tr(locale, 'Order updated.', 'تم تحديث الطلب.')}</Banner> : null}
      {paid ? <Banner tone="success">{tr(locale, 'Payment recorded.', 'تم تسجيل الدفعة.')}</Banner> : null}
      {returned ? <Banner tone="error">{tr(locale, 'Order marked as returned.', 'تم تحديد الطلب كمُرتجع.')}</Banner> : null}
      {returncleared ? <Banner tone="success">{tr(locale, 'Returned mark cleared.', 'تم إلغاء تحديد الإرجاع.')}</Banner> : null}
      {reported ? <Banner tone="success">{tr(locale, 'Order reported (rescheduled).', 'تم تأجيل الطلب (إعادة جدولة).')}</Banner> : null}
      {reportcleared ? <Banner tone="success">{tr(locale, 'Report cleared.', 'تم إلغاء التأجيل.')}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!order.returned_at ? (
            <Card>
              <CardHeader title={tr(locale, 'Production', 'الإنتاج')} description={tr(locale, 'Stage tracking and assignment', 'تتبّع المراحل والإسناد')} />
              <CardBody className="space-y-2.5">
                {(['PREPARATION', 'MASKAGE', 'FINITION'] as const).map((st) => {
                  const label = st === 'PREPARATION' ? tr(locale, 'Preparation', 'التحضير') : st === 'MASKAGE' ? tr(locale, 'Masking', 'التغطية') : tr(locale, 'Finishing', 'التشطيب');
                  const doneBy = stageDoneBy.get(st);
                  const isDone = stageDoneBy.has(st);
                  const isCurrent = currentStage === st && (canProduce || canEdit);
                  if (isDone) {
                    return (
                      <div key={st} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                        <span className="inline-flex items-center gap-2 font-medium text-emerald-800">
                          <CheckCircle2 className="h-4 w-4" />{label}
                        </span>
                        <span className="text-emerald-700">{doneBy || '—'}</span>
                      </div>
                    );
                  }
                  if (isCurrent) {
                    return <StageForm key={st} orderId={order.id} stage={st} employees={employeeOptions} />;
                  }
                  return (
                    <div key={st} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-400">
                      <span>{label}</span>
                      <span>{order.production_stage === 'NOUVEAU' ? tr(locale, 'Pending', 'قيد الانتظار') : '—'}</span>
                    </div>
                  );
                })}
                {order.production_stage === 'NOUVEAU' ? (
                  <p className="text-xs text-neutral-400">{tr(locale, 'Start production to assign the stages.', 'ابدأ الإنتاج لإسناد المراحل.')}</p>
                ) : null}
                {order.production_stage === 'READY' ? (
                  <p className="text-xs font-medium text-emerald-600">{tr(locale, 'All stages are completed ✓', 'اكتملت جميع المراحل ✓')}</p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={tr(locale, 'Order details', 'تفاصيل الطلب')} />
            <CardBody className="pt-1">
              <div className="mb-3 flex flex-wrap gap-2">
                <CanonicalStatusBadge statusKey={orderCanonicalStatus(order)} />
                <FulfillmentBadge value={order.fulfillment} />
                {order.delivery_status === 'OUT_FOR_DELIVERY' ? (
                  <DeliveryStatusBadge status={order.delivery_status} />
                ) : null}
              </div>
              <div className="divide-y divide-neutral-100">
                <Row label={tr(locale, 'Customer', 'العميل')} value={order.customer_name} />
                <Row label={tr(locale, 'Phone', 'الهاتف')} value={order.customer_phone} />
                <Row label={tr(locale, 'Cake size', 'حجم الكعكة')} value={`${order.cake_size_cm} cm`} />
                <Row label={tr(locale, 'Delivery date', 'تاريخ التوصيل')} value={formatDate(order.delivery_date)} />
                <Row label={tr(locale, 'Delivery time', 'وقت التوصيل')} value={formatTime(order.delivery_time)} />
                <Row
                  label={tr(locale, 'Description', 'الوصف')}
                  value={order.description ? order.description : '—'}
                />
              </div>
            </CardBody>
          </Card>

          {image && imageUrl ? (
            <Card>
              <CardHeader title={tr(locale, 'Reference image', 'الصورة المرجعية')} />
              <CardBody>
                <div className="relative overflow-hidden rounded-lg border border-neutral-200">
                  <Image
                    src={imageUrl}
                    alt={tr(locale, 'Order reference', 'مرجع الطلب')}
                    width={800}
                    height={600}
                    className="h-auto w-full object-contain"
                    unoptimized
                  />
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {financials ? (
            <Card>
              <CardHeader title={tr(locale, 'Payment', 'الدفع')} />
              <CardBody className="pt-1">
                <div className="divide-y divide-neutral-100">
                  <Row label={tr(locale, 'Total', 'المجموع')} value={formatAmount(financials.total_amount)} />
                  {financials.montage_amount > 0 ? (
                    <Row label={tr(locale, 'Montage', 'التركيب')} value={formatAmount(financials.montage_amount)} />
                  ) : null}
                  <Row label={tr(locale, 'Received', 'المستلَم')} value={formatAmount(financials.advance_payment)} />
                  <Row label={tr(locale, 'Delivery fee', 'رسوم التوصيل')} value={formatAmount(financials.delivery_amount)} />
                  <Row
                    label={tr(locale, 'Remaining', 'المتبقي')}
                    value={
                      <span className="text-amber-600">
                        {formatAmount(financials.remaining_amount)}
                      </span>
                    }
                  />
                </div>
                {canRecordPayment && financials.remaining_amount > 0 ? (
                  <PaymentForm
                    orderId={order.id}
                    remaining={financials.remaining_amount}
                    kind={financials.advance_payment > 0 ? 'FINAL' : 'ADVANCE'}
                  />
                ) : null}
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody>
                <p className="text-sm text-neutral-400">
                  {tr(locale, 'Financial details are visible to finance users only.', 'التفاصيل المالية مرئية لمستخدمي المالية فقط.')}
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title={tr(locale, 'Timeline', 'المخطط الزمني')} />
            <CardBody className="pt-1">
              <div className="divide-y divide-neutral-100">
                <Row
                  label={tr(locale, 'Sent to lab', 'أُرسل إلى المختبر')}
                  value={order.sent_to_lab_at ? formatDate(order.sent_to_lab_at.slice(0, 10)) : '—'}
                />
                <Row
                  label={tr(locale, 'Ready', 'جاهز')}
                  value={order.ready_at ? formatDate(order.ready_at.slice(0, 10)) : '—'}
                />
                {order.returned_at ? (
                  <Row
                    label={tr(locale, 'Returned', 'مُرتجع')}
                    value={
                      <span className="text-amber-600">
                        {formatDate(order.returned_at.slice(0, 10))}
                        {order.return_reason ? ` · ${order.return_reason}` : ''}
                      </span>
                    }
                  />
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={tr(locale, 'Status history', 'سجل الحالات')} description={`${history.length} ${tr(locale, 'event(s)', 'حدث')}`} />
            <CardBody className="pt-2">
              {history.length === 0 ? (
                <p className="text-sm text-neutral-400">{tr(locale, 'No history.', 'لا يوجد سجل.')}</p>
              ) : (
                <ol className="relative space-y-5 border-l border-neutral-200 pl-5">
                  {history.map((e) => (
                    <li key={e.key} className="relative">
                      <span
                        className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${TONE_DOT[e.tone] ?? 'bg-neutral-400'}`}
                      />
                      <p className="text-sm font-semibold text-neutral-800">{e.label}</p>
                      {e.note ? <p className="text-sm italic text-neutral-500">{e.note}</p> : null}
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {formatDateTime(e.at)} · {e.actor}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: 'success' | 'error';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-800'
      : 'bg-red-50 text-red-700';
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`mb-6 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${cls}`}>
      <Icon className="h-5 w-5" />
      {children}
    </div>
  );
}
