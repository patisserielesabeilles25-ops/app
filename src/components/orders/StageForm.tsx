'use client';

import { useState } from 'react';
import { completeStage } from '@/lib/orders/actions';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';
import type { Locale } from '@/lib/i18n/config';

const stageLabel = (locale: Locale, stage: string) =>
  stage === 'PREPARATION' ? tr(locale, 'Preparation', 'التحضير')
  : stage === 'MASKAGE' ? tr(locale, 'Masking', 'التغطية')
  : tr(locale, 'Finishing', 'التشطيب');

export function StageForm({
  orderId,
  stage,
  employees,
}: {
  orderId: string;
  stage: 'PREPARATION' | 'MASKAGE' | 'FINITION';
  employees: { id: string; name: string }[];
}) {
  const locale = useLocale();
  const [employeeId, setEmployeeId] = useState('');

  return (
    <form action={completeStage} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="stage" value={stage} />
      <p className="mb-2 text-sm font-semibold text-amber-800">{tr(locale, 'Current stage:', 'المرحلة الحالية:')} {stageLabel(locale, stage)}</p>
      {employees.length === 0 ? (
        <p className="text-xs text-neutral-500">{tr(locale, 'No employees. Set up a user’s remuneration first.', 'لا يوجد موظفون. قم بإعداد أجر أحد المستخدمين أولًا.')}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            name="employeeId"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          >
            <option value="" disabled>{tr(locale, 'Who did this stage?', 'من قام بهذه المرحلة؟')}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <Button type="submit" disabled={!employeeId}>{tr(locale, 'Mark completed', 'تحديد كمكتمل')}</Button>
        </div>
      )}
    </form>
  );
}
