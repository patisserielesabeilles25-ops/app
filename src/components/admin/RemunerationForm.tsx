'use client';

import { setUserRemuneration } from '@/lib/payroll/actions';
import type { PaymentMethod } from '@/lib/payroll/methods';
import { Button } from '@/components/ui/Button';
import { RemunerationFields } from '@/components/admin/RemunerationFields';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

export function RemunerationForm({
  userId,
  current,
}: {
  userId: string;
  current: { paymentMethod: PaymentMethod; amount: number } | null;
}) {
  const locale = useLocale();
  return (
    <form action={setUserRemuneration} className="space-y-5">
      <input type="hidden" name="userId" value={userId} />
      <RemunerationFields
        methodName="method"
        amountName="amount"
        defaultMethod={current?.paymentMethod ?? 'MONTHLY'}
        defaultAmount={current?.amount ?? 0}
      />
      <div className="flex justify-end border-t border-neutral-100 pt-4">
        <Button type="submit">{tr(locale, 'Save remuneration', 'حفظ الأجر')}</Button>
      </div>
    </form>
  );
}
