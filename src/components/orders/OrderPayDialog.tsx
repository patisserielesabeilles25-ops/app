'use client';

import { useRef, useState } from 'react';
import { useActionState } from 'react';
import { Wallet, X } from 'lucide-react';
import { recordOrderPayment, type PaymentState } from '@/lib/orders/actions';
import { Button } from '@/components/ui/Button';
import { formatAmount } from '@/lib/utils';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: PaymentState = {};

export function OrderPayDialog({
  orderId,
  orderNumber,
  remaining,
  agents = [],
}: {
  orderId: string;
  orderNumber: string;
  remaining: number;
  agents?: { id: string; name: string }[];
}) {
  const locale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(recordOrderPayment, initial);

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); ref.current?.showModal(); }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        <Wallet className="h-3.5 w-3.5" />
        {tr(locale, 'Pay', 'دفع')}
      </button>

      <dialog
        ref={ref}
        className="m-auto w-full max-w-sm rounded-2xl border border-neutral-200 p-0 backdrop:bg-neutral-900/40"
        onClose={() => setOpen(false)}
      >
        {open ? (
          <div className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-base font-semibold text-neutral-900">{tr(locale, 'Collect', 'تحصيل')} {orderNumber}</h2>
              <button type="button" aria-label={tr(locale, 'Close', 'إغلاق')} onClick={() => ref.current?.close()} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm">
              <span className="font-semibold text-neutral-700">{tr(locale, 'Remaining to pay', 'المتبقي للدفع')}</span>
              <span className="font-bold text-amber-600">{formatAmount(remaining)} DA</span>
            </div>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="kind" value="PAYMENT" />
              {state.error ? (
                <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`agent-${orderId}`} className="text-sm font-medium text-neutral-700">{tr(locale, 'Agent receiving the money', 'الموظف الذي يستلم المبلغ')}</label>
                {agents.length === 0 ? (
                  <p className="text-xs text-neutral-400">{tr(locale, 'No agent. Set up a user’s remuneration.', 'لا يوجد موظف. قم بإعداد أجر أحد المستخدمين.')}</p>
                ) : (
                  <select
                    id={`agent-${orderId}`}
                    name="receivedBy"
                    required
                    defaultValue=""
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="" disabled>{tr(locale, 'Choose the agent…', 'اختر الموظف…')}</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`amount-${orderId}`} className="text-sm font-medium text-neutral-700">{tr(locale, 'Amount to collect (DA)', 'المبلغ المراد تحصيله (DA)')}</label>
                <div className="relative">
                  <input
                    id={`amount-${orderId}`}
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    max={remaining}
                    defaultValue={remaining}
                    required
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-12 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">DA</span>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>{tr(locale, 'Cancel', 'إلغاء')}</Button>
                <Button type="submit" disabled={pending} className="bg-emerald-600 hover:bg-emerald-700">
                  {pending ? tr(locale, 'Collecting…', 'جارٍ التحصيل…') : tr(locale, 'Confirm', 'تأكيد')}
                </Button>
              </div>
            </form>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
