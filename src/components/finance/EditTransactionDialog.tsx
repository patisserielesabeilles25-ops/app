'use client';

import { useRef, useEffect } from 'react';
import { useActionState } from 'react';
import { Pencil, X } from 'lucide-react';
import { updateTransaction, type TxEditState } from '@/lib/finance/actions';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/t';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const initial: TxEditState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function EditTransactionDialog({
  id,
  amount,
  description,
  date,
}: {
  id: string;
  amount: number;
  description: string | null;
  date: string; // yyyy-mm-dd
}) {
  const locale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(updateTransaction, initial);

  useEffect(() => {
    if (state.success) ref.current?.close();
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        title={tr(locale, 'Edit', 'تعديل')}
        className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
      >
        <Pencil className="h-3.5 w-3.5" />
        {tr(locale, 'Edit', 'تعديل')}
      </button>

      <dialog
        ref={ref}
        className="m-auto w-full max-w-sm rounded-2xl border border-neutral-200 p-0 backdrop:bg-neutral-900/40"
      >
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <h2 className="text-base font-semibold text-neutral-900">{tr(locale, 'Edit transaction', 'تعديل المعاملة')}</h2>
            <button type="button" aria-label={tr(locale, 'Close', 'إغلاق')} onClick={() => ref.current?.close()} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            {state.error ? (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`amt-${id}`} className="text-sm font-medium text-neutral-700">{tr(locale, 'Amount (DA)', 'المبلغ (DA)')}</label>
              <input id={`amt-${id}`} name="amount" type="number" min="0" step="0.01" defaultValue={amount} className={inputCls} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`date-${id}`} className="text-sm font-medium text-neutral-700">{tr(locale, 'Date', 'التاريخ')}</label>
              <input id={`date-${id}`} name="occurredAt" type="date" defaultValue={date} className={inputCls} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`desc-${id}`} className="text-sm font-medium text-neutral-700">{tr(locale, 'Description', 'الوصف')}</label>
              <input id={`desc-${id}`} name="description" defaultValue={description ?? ''} className={inputCls} />
            </div>
            <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>{tr(locale, 'Cancel', 'إلغاء')}</Button>
              <Button type="submit" disabled={pending}>{pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Save', 'حفظ')}</Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
