'use client';

import { useState } from 'react';
import { Package, CalendarDays, CalendarRange, Banknote } from 'lucide-react';
import type { PaymentMethod } from '@/lib/payroll/methods';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';
import type { Locale } from '@/lib/i18n/config';

function buildMethods(locale: Locale): {
  key: PaymentMethod;
  label: string;
  icon: typeof Package;
  amountLabel: string;
}[] {
  return [
    { key: 'PIECE_BASED', label: tr(locale, 'Par commande', 'بالطلب'), icon: Package, amountLabel: tr(locale, 'Montant par commande (DA)', 'المبلغ لكل طلب (DA)') },
    { key: 'DAILY', label: tr(locale, 'Journalier', 'يومي'), icon: CalendarDays, amountLabel: tr(locale, 'Salaire journalier (DA)', 'الأجر اليومي (DA)') },
    { key: 'WEEKLY', label: tr(locale, 'Hebdomadaire', 'أسبوعي'), icon: CalendarRange, amountLabel: tr(locale, 'Salaire hebdomadaire (DA)', 'الأجر الأسبوعي (DA)') },
    { key: 'MONTHLY', label: tr(locale, 'Mensuel', 'شهري'), icon: Banknote, amountLabel: tr(locale, 'Salaire mensuel (DA)', 'الراتب الشهري (DA)') },
  ];
}

/**
 * The "Mode de rémunération" picker: method buttons + an amount field. Renders
 * hidden inputs under the given field names so it can be embedded in any form.
 */
export function RemunerationFields({
  methodName = 'method',
  amountName = 'amount',
  defaultMethod = 'MONTHLY',
  defaultAmount = 0,
  amountRequired = true,
}: {
  methodName?: string;
  amountName?: string;
  defaultMethod?: PaymentMethod;
  defaultAmount?: number;
  amountRequired?: boolean;
}) {
  const locale = useLocale();
  const METHODS = buildMethods(locale);
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);
  const active = METHODS.find((m) => m.key === method)!;

  return (
    <div className="space-y-4">
      <input type="hidden" name={methodName} value={method} />
      <div>
        <p className="mb-2 text-sm font-semibold text-neutral-700">{tr(locale, 'Mode de rémunération', 'طريقة الأجر')}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const selected = m.key === method;
            return (
              <button
                type="button"
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border p-3 text-center text-sm font-medium transition',
                  selected
                    ? 'border-violet-400 bg-violet-50 text-violet-700 ring-2 ring-violet-100'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300',
                )}
              >
                <Icon className="h-5 w-5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={amountName} className="text-sm font-medium text-neutral-700">{active.amountLabel}</label>
        <div className="relative">
          <input
            id={amountName}
            name={amountName}
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultAmount}
            key={method}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-12 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            required={amountRequired}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-400">DA</span>
        </div>
      </div>
    </div>
  );
}
