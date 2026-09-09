'use client';

import { useRef, useState } from 'react';
import { Wallet, History, FileText, X } from 'lucide-react';
import { recordSalaryPayment } from '@/lib/payroll/actions';
import type { PayInfo } from '@/lib/payroll/salary';
import { Button } from '@/components/ui/Button';
import { formatAmount, formatDate } from '@/lib/utils';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';
import type { Locale } from '@/lib/i18n/config';

function methodLabel(locale: Locale, method: PayInfo['method']): string {
  switch (method) {
    case 'PIECE_BASED':
      return tr(locale, 'Par commande', 'بالطلب');
    case 'DAILY':
      return tr(locale, 'Journalier', 'يومي');
    case 'WEEKLY':
      return tr(locale, 'Hebdomadaire', 'أسبوعي');
    case 'MONTHLY':
      return tr(locale, 'Mensuel', 'شهري');
  }
}

export function PayEmployeeDialog({ info }: { info: PayInfo }) {
  const locale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); ref.current?.showModal(); }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        <Wallet className="h-3.5 w-3.5" />
        {tr(locale, 'Payer', 'دفع')}
      </button>

      <dialog
        ref={ref}
        className="m-auto w-full max-w-md rounded-2xl border border-neutral-200 p-0 backdrop:bg-neutral-900/40"
        onClose={() => setOpen(false)}
      >
        {open ? (
          <div className="max-h-[85vh] overflow-y-auto p-6">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-bold text-neutral-900">{tr(locale, `Payer ${info.name}`, `دفع ${info.name}`)}</h2>
              <button type="button" aria-label={tr(locale, 'Fermer', 'إغلاق')} onClick={() => ref.current?.close()} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Summary */}
            <div className="mb-4 rounded-xl bg-neutral-50 p-4 text-sm">
              <div className="flex justify-between py-0.5">
                <span className="text-neutral-500">{tr(locale, 'Mode', 'الطريقة')}</span>
                <span className="font-semibold text-neutral-800">{methodLabel(locale, info.method)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-neutral-500">{tr(locale, `Gains (${info.periodLabel})`, `الأرباح (${info.periodLabel})`)}</span>
                <span className="font-semibold text-neutral-800">{formatAmount(info.gains)} DA</span>
              </div>
              {info.absence > 0 ? (
                <div className="flex justify-between py-0.5">
                  <span className="text-neutral-500">
                    {tr(locale, `Absences (${info.absentDays} j)`, `الغيابات (${info.absentDays} ي)`)}
                  </span>
                  <span className="font-semibold text-red-600">− {formatAmount(info.absence)} DA</span>
                </div>
              ) : null}
              <div className="flex justify-between py-0.5">
                <span className="text-neutral-500">{tr(locale, 'Avance', 'السلفة')}</span>
                <span className="font-semibold text-emerald-600">{formatAmount(info.paid)} DA</span>
              </div>
              {info.advances > 0 ? (
                <div className="flex justify-between py-0.5">
                  <span className="text-neutral-500">{tr(locale, 'Avances', 'السلف')}</span>
                  <span className="font-semibold text-amber-600">− {formatAmount(info.advances)} DA</span>
                </div>
              ) : null}
              <div className="mt-1 flex justify-between border-t border-neutral-200 pt-2">
                <span className="font-semibold text-neutral-800">{tr(locale, 'Reste à payer', 'المتبقي للدفع')}</span>
                <span className={`font-bold ${info.remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {formatAmount(info.remaining)} DA
                </span>
              </div>
            </div>

            {/* History */}
            <div className="mb-4 rounded-xl border border-neutral-200">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <span className="inline-flex items-center gap-2"><History className="h-4 w-4" />{tr(locale, 'Historique des paiements', 'سجل المدفوعات')}</span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{info.history.length}</span>
              </button>
              {showHistory ? (
                <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
                  {info.history.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-neutral-400">{tr(locale, 'Aucun paiement.', 'لا توجد مدفوعات.')}</li>
                  ) : (
                    info.history.map((p) => (
                      <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-neutral-800">{formatAmount(p.amount)} DA</p>
                          <p className="text-xs text-neutral-400">
                            {formatDate(p.date)}{p.note ? ` · ${p.note}` : ''}
                          </p>
                        </div>
                        <a
                          href={`/salary/${p.id}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                        >
                          <FileText className="h-3.5 w-3.5" />PDF
                        </a>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>

            {/* Payment form */}
            <form action={recordSalaryPayment} className="space-y-4">
              <input type="hidden" name="employeeId" value={info.employeeId} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`amount-${info.employeeId}`} className="text-sm font-medium text-neutral-700">{tr(locale, 'Montant à verser (DA) *', 'المبلغ المطلوب دفعه (DA) *')}</label>
                <div className="relative">
                  <input
                    id={`amount-${info.employeeId}`}
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    required
                    defaultValue={info.remaining > 0 ? info.remaining : ''}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-12 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">DA</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`paidOn-${info.employeeId}`} className="text-sm font-medium text-neutral-700">{tr(locale, 'Date de paiement', 'تاريخ الدفع')}</label>
                <input
                  id={`paidOn-${info.employeeId}`}
                  name="paidOn"
                  type="date"
                  defaultValue={today}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`note-${info.employeeId}`} className="text-sm font-medium text-neutral-700">{tr(locale, 'Note (optionnel)', 'ملاحظة (اختياري)')}</label>
                <input
                  id={`note-${info.employeeId}`}
                  name="note"
                  placeholder={tr(locale, 'Ex: Paiement partiel mars…', 'مثال: دفعة جزئية مارس…')}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>{tr(locale, 'Annuler', 'إلغاء')}</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">{tr(locale, 'Confirmer le paiement', 'تأكيد الدفع')}</Button>
              </div>
            </form>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
