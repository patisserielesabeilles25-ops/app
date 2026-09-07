'use client';

import { useActionState } from 'react';
import { recordOrderPayment, type PaymentState } from '@/lib/orders/actions';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: PaymentState = {};

export function PaymentForm({
  orderId,
  remaining,
  kind,
  agents = [],
}: {
  orderId: string;
  remaining: number;
  kind: 'ADVANCE' | 'FINAL';
  agents?: { id: string; name: string }[];
}) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(recordOrderPayment, initial);

  const selectCls =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="kind" value={kind} />
      {state.error ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{state.error}</p>
      ) : null}
      <p className="text-sm font-medium text-neutral-700">{tr(locale, 'Record a payment', 'تسجيل دفعة')}</p>
      {agents.length === 0 ? (
        <p className="text-xs text-neutral-400">{tr(locale, 'No agents. Set up a user’s remuneration first.', 'لا يوجد أعوان. قم بإعداد أجر مستخدم أولًا.')}</p>
      ) : (
        <select name="receivedBy" defaultValue="" required className={selectCls} aria-label={tr(locale, 'Agent receiving the money', 'الموظف الذي يستلم المبلغ')}>
          <option value="" disabled>{tr(locale, 'Agent receiving the money…', 'الموظف الذي يستلم المبلغ…')}</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}
      <input
        name="amount"
        type="number"
        step="0.01"
        min="0"
        max={remaining}
        defaultValue={remaining}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? tr(locale, 'Recording…', 'جارٍ التسجيل…') : tr(locale, 'Record payment', 'تسجيل الدفعة')}
      </Button>
    </form>
  );
}
