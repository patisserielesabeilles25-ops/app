'use client';

import { useRef, useState } from 'react';
import { useActionState } from 'react';
import { CalendarClock } from 'lucide-react';
import { reportOrder, type ReportState } from '@/lib/orders/actions';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: ReportState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function ReportOrderDialog({
  orderId,
  defaultDate,
  defaultTime,
  defaultDeliveryRequired,
}: {
  orderId: string;
  defaultDate: string;
  defaultTime: string;
  defaultDeliveryRequired: boolean;
}) {
  const locale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reportOrder, initial);

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); ref.current?.showModal(); }}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-600 hover:bg-amber-50"
      >
        <CalendarClock className="h-4 w-4" />
        {tr(locale, 'Reschedule', 'تأجيل')}
      </button>

      <dialog
        ref={ref}
        className="m-auto w-full max-w-md rounded-2xl border border-neutral-200 p-0 backdrop:bg-neutral-900/40"
        onClose={() => setOpen(false)}
      >
        {open ? (
          <div className="p-6">
            <h2 className="text-base font-semibold text-neutral-900">{tr(locale, 'Reschedule the order', 'تأجيل الطلب')}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {tr(locale, 'Reschedule the delivery. The new date will appear on the calendar.', 'أعد جدولة التوصيل. سيظهر التاريخ الجديد في التقويم.')}
            </p>

            <form action={formAction} className="mt-5 space-y-4">
              <input type="hidden" name="orderId" value={orderId} />

              {state.error ? (
                <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="deliveryDate" className="text-sm font-medium text-neutral-700">{tr(locale, 'New date', 'التاريخ الجديد')}</label>
                  <input id="deliveryDate" name="deliveryDate" type="date" defaultValue={defaultDate} className={inputCls} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="deliveryTime" className="text-sm font-medium text-neutral-700">{tr(locale, 'Delivery time', 'وقت التوصيل')}</label>
                  <input id="deliveryTime" name="deliveryTime" type="time" defaultValue={defaultTime} className={inputCls} required />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" name="deliveryRequired" defaultChecked={defaultDeliveryRequired} className="rounded border-neutral-300" />
                {tr(locale, 'Delivery (unchecked = pickup)', 'توصيل (غير محدد = استلام)')}
              </label>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="reason" className="text-sm font-medium text-neutral-700">{tr(locale, 'Reason (optional)', 'السبب (اختياري)')}</label>
                <input id="reason" name="reason" className={inputCls} placeholder={tr(locale, 'e.g. Customer unavailable', 'مثال: العميل غير متاح')} />
              </div>

              <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>{tr(locale, 'Cancel', 'إلغاء')}</Button>
                <Button type="submit" disabled={pending}>{pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Reschedule', 'تأجيل')}</Button>
              </div>
            </form>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
