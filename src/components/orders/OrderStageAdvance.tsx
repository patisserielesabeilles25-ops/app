'use client';

import { useState } from 'react';
import { Play, Check } from 'lucide-react';
import { startProduction, completeStage } from '@/lib/orders/actions';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';
import type { Locale } from '@/lib/i18n/config';

const STAGE_OF: Record<string, { stage: 'PREPARATION' | 'MASKAGE' | 'FINITION' }> = {
  EN_PREPARATION: { stage: 'PREPARATION' },
  EN_MASKAGE: { stage: 'MASKAGE' },
  EN_FINITION: { stage: 'FINITION' },
};

const stageLabel = (locale: Locale, stage: 'PREPARATION' | 'MASKAGE' | 'FINITION') =>
  stage === 'PREPARATION' ? tr(locale, 'Preparation', 'التحضير')
  : stage === 'MASKAGE' ? tr(locale, 'Masking', 'التغطية')
  : tr(locale, 'Finishing', 'التشطيب');

export function OrderStageAdvance({
  orderId,
  productionStage,
  employees,
}: {
  orderId: string;
  productionStage: string | null;
  employees: { id: string; name: string }[];
}) {
  const locale = useLocale();
  const [employeeId, setEmployeeId] = useState('');
  const stageInfo = productionStage ? STAGE_OF[productionStage] : null;

  if (productionStage === 'READY') {
    return <span className="text-xs font-medium text-emerald-600">{tr(locale, 'Ready', 'جاهز')} ✓</span>;
  }

  if (productionStage === 'NOUVEAU' || !stageInfo) {
    return (
      <form action={startProduction}>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="from" value="list" />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-amber-500"
        >
          <Play className="h-3.5 w-3.5" />
          {tr(locale, 'Start', 'بدء')}
        </button>
      </form>
    );
  }

  return (
    <form action={completeStage} className="flex items-center gap-1.5">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="stage" value={stageInfo.stage} />
      <input type="hidden" name="from" value="list" />
      <select
        name="employeeId"
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        required
        className="max-w-[120px] rounded-lg border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      >
        <option value="" disabled>{tr(locale, 'Agent…', 'الموظف…')}</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!employeeId}
        title={`${tr(locale, 'Validate', 'اعتماد')} ${stageLabel(locale, stageInfo.stage)}`}
        className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-amber-500 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
        {stageLabel(locale, stageInfo.stage)}
      </button>
    </form>
  );
}
