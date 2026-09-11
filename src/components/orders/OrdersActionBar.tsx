'use client';

import Link from 'next/link';
import { Printer, Pencil, CalendarClock, PackageX, Undo2, MousePointerClick } from 'lucide-react';
import { useOrderSelection } from '@/components/orders/OrderSelection';
import { ReportOrderDialog } from '@/components/orders/ReportOrderDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  markOrderReturned,
  unmarkOrderReturned,
  unreportOrder,
} from '@/lib/orders/actions';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

export type ToolbarOrder = {
  id: string;
  order_number: string;
  delivery_date: string;
  delivery_time: string;
  fulfillment: 'PICKUP' | 'DELIVERY';
  returned_at: string | null;
  reported_at: string | null;
};

const BTN =
  'inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold transition';
const NEUTRAL = 'text-neutral-700 hover:bg-neutral-100';
const AMBER = 'text-amber-600 hover:bg-amber-50';
const RED = 'text-red-600 hover:bg-red-50';
const DISABLED = 'cursor-not-allowed opacity-40';

export function OrdersActionBar({
  orders,
  canEdit,
}: {
  orders: ToolbarOrder[];
  canEdit: boolean;
}) {
  const locale = useLocale();
  const { selectedId } = useOrderSelection();
  const order = orders.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-3 border-b border-neutral-100 bg-neutral-50/70 px-5 py-3 sm:flex-row sm:items-center">
      <span className="flex items-center gap-2 text-sm text-neutral-500 sm:me-auto">
        {order ? (
          <>
            {tr(locale, 'Selected', 'المحدد')}:{' '}
            <span className="font-semibold text-neutral-800">{order.order_number}</span>
          </>
        ) : (
          <>
            <MousePointerClick className="h-4 w-4 text-neutral-400" />
            {tr(locale, 'Select an order below to act on it', 'اختر طلبًا أدناه للتحكم به')}
          </>
        )}
      </span>

      {order ? (
        <div className="flex flex-wrap items-center gap-2" key={order.id}>
          {/* Print */}
          <a
            href={`/orders/${order.id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${BTN} ${NEUTRAL}`}
          >
            <Printer className="h-4 w-4" />
            {tr(locale, 'Print', 'طباعة')}
          </a>

          {/* Edit */}
          {canEdit ? (
            <Link href={`/orders/${order.id}/edit`} className={`${BTN} ${NEUTRAL}`}>
              <Pencil className="h-4 w-4" />
              {tr(locale, 'Edit', 'تعديل')}
            </Link>
          ) : null}

          {/* Reschedule / Clear report */}
          {canEdit && !order.returned_at ? (
            order.reported_at ? (
              <form action={unreportOrder}>
                <input type="hidden" name="orderId" value={order.id} />
                <button type="submit" className={`${BTN} ${AMBER}`}>
                  <Undo2 className="h-4 w-4" />
                  {tr(locale, 'Clear report', 'إلغاء التأجيل')}
                </button>
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

          {/* Mark returned / Clear returned */}
          {canEdit ? (
            order.returned_at ? (
              <form action={unmarkOrderReturned}>
                <input type="hidden" name="orderId" value={order.id} />
                <button type="submit" className={`${BTN} ${NEUTRAL}`}>
                  <Undo2 className="h-4 w-4" />
                  {tr(locale, 'Clear returned', 'إلغاء الإرجاع')}
                </button>
              </form>
            ) : (
              <ConfirmDialog
                triggerLabel={
                  <span className={`${BTN} ${RED}`}>
                    <PackageX className="h-4 w-4" />
                    {tr(locale, 'Mark returned', 'تحديد كمُرتجع')}
                  </span>
                }
                title={tr(locale, 'Mark this order as returned?', 'تحديد هذا الطلب كمُرتجع؟')}
                description={tr(
                  locale,
                  "Use this when the customer returned or refused the order. It will count toward the client's returned badge. You can undo this later.",
                  'استخدم هذا عندما يُرجع العميل الطلب أو يرفضه. سيُحتسب ضمن شارة المُرتجعات الخاصة بالعميل. يمكنك التراجع عن ذلك لاحقًا.',
                )}
                confirmLabel={tr(locale, 'Mark returned', 'تحديد كمُرتجع')}
                action={markOrderReturned}
                hiddenFields={{ orderId: order.id }}
              />
            )
          ) : null}
        </div>
      ) : (
        /* No selection — show the buttons in a disabled preview state. */
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <span className={`${BTN} ${NEUTRAL} ${DISABLED}`}>
            <Printer className="h-4 w-4" />
            {tr(locale, 'Print', 'طباعة')}
          </span>
          {canEdit ? (
            <>
              <span className={`${BTN} ${NEUTRAL} ${DISABLED}`}>
                <Pencil className="h-4 w-4" />
                {tr(locale, 'Edit', 'تعديل')}
              </span>
              <span className={`${BTN} ${AMBER} ${DISABLED}`}>
                <CalendarClock className="h-4 w-4" />
                {tr(locale, 'Reschedule', 'تأجيل')}
              </span>
              <span className={`${BTN} ${RED} ${DISABLED}`}>
                <PackageX className="h-4 w-4" />
                {tr(locale, 'Mark returned', 'تحديد كمُرتجع')}
              </span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
