'use client';

import { useRef, useState } from 'react';
import { PackageX, AlertTriangle } from 'lucide-react';
import { markOrderReturned } from '@/lib/orders/actions';
import { RETURN_REASONS } from '@/lib/orders/returnReasons';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100';

/**
 * "Mark returned" trigger + dialog. Requires the user to pick a cancellation
 * reason from the dropdown before confirming; the reason is stored and feeds the
 * Analytics breakdown. Gated by role at the call site (admin + vendeur only).
 */
export function ReturnOrderDialog({ orderId }: { orderId: string }) {
  const locale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); ref.current?.showModal(); }}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
      >
        <PackageX className="h-4 w-4" />
        {tr(locale, 'Mark returned', 'تحديد كمُرتجع')}
      </button>

      <dialog
        ref={ref}
        className="m-auto w-full max-w-md rounded-2xl border border-neutral-200 p-0 backdrop:bg-neutral-900/40"
        onClose={() => { setOpen(false); setReason(''); }}
      >
        {open ? (
          <div className="p-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-neutral-900">{tr(locale, 'Cancel this order?', 'إلغاء هذا الطلب؟')}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {tr(
                    locale,
                    'Choose the cancellation reason. It is saved in the history and used for statistics.',
                    'اختر سبب الإلغاء. يُحفظ في السجل ويُستخدم في الإحصائيات.',
                  )}
                </p>
              </div>
            </div>

            <form action={markOrderReturned} className="mt-5 space-y-4">
              <input type="hidden" name="orderId" value={orderId} />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="reason" className="text-sm font-medium text-neutral-700">
                  {tr(locale, 'Cancellation reason', 'سبب الإلغاء')} <span className="text-rose-500">*</span>
                </label>
                <select
                  id="reason"
                  name="reason"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={inputCls}
                >
                  <option value="" disabled>{tr(locale, 'Select a reason…', 'اختر سببًا…')}</option>
                  {RETURN_REASONS.map((r) => (
                    <option key={r.key} value={r.key}>{tr(locale, r.en, r.ar)}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>
                  {tr(locale, 'Close', 'إغلاق')}
                </Button>
                <button
                  type="submit"
                  disabled={!reason}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  <PackageX className="h-4 w-4" />
                  {tr(locale, 'Confirm cancellation', 'تأكيد الإلغاء')}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
