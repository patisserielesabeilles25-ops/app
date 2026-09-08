'use client';

import { useMemo, useState } from 'react';
import { useActionState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import { saveProductionLog, type SaveLogState } from '@/lib/production/actions';
import { DAYS, SHEETS, rowsForSheet, cellKey, type SheetKey } from '@/lib/production/rows';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initialState: SaveLogState = {};
const cellBorder = 'border border-neutral-900 text-center align-middle';

export function ProductionLogEditor({
  weekStart,
  initial,
}: {
  weekStart: string;
  initial: Record<string, number>;
}) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveProductionLog, initialState);
  const [vals, setVals] = useState<Record<string, number>>(initial);

  const setCell = (key: string, raw: string) => {
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    setVals((v) => {
      const next = { ...v };
      if (n > 0) next[key] = n;
      else delete next[key];
      return next;
    });
  };

  const payload = useMemo(() => JSON.stringify(vals), [vals]);

  const columnTotal = (sheet: SheetKey, day: number) =>
    rowsForSheet(sheet).reduce((sum, r) => sum + (vals[cellKey(sheet, r.key, day)] ?? 0), 0);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="payload" value={payload} />

      {state.ok ? (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          {tr(locale, 'Your sheet was saved.', 'تم حفظ ورقتك.')}
        </div>
      ) : null}
      {state.error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {SHEETS.map((sheet) => (
          <Card key={sheet}>
            <CardHeader title={sheet} />
            <CardBody>
              <div dir="rtl" className="overflow-x-auto">
                <table className="w-full border-collapse text-sm text-neutral-900">
                  <thead>
                    <tr>
                      <th
                        className={`${cellBorder} bg-neutral-100 px-2 py-2 text-base font-extrabold`}
                        style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                      >
                        {sheet}
                      </th>
                      {DAYS.map((d) => (
                        <th key={d.index} className={`${cellBorder} px-1 py-2 font-bold`}>{d.ar}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsForSheet(sheet).map((r) => (
                      <tr key={r.key}>
                        <th
                          dir={r.ltr ? 'ltr' : undefined}
                          className={`${cellBorder} px-2 py-2 font-bold ${r.sep ? 'bg-neutral-100' : ''}`}
                          style={r.sep ? { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } : undefined}
                        >
                          {r.label}
                        </th>
                        {DAYS.map((d) => {
                          const key = cellKey(sheet, r.key, d.index);
                          return (
                            <td key={d.index} className={cellBorder}>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                inputMode="numeric"
                                value={vals[key] ?? ''}
                                onChange={(e) => setCell(key, e.target.value)}
                                className="h-10 w-full min-w-12 bg-transparent text-center outline-none focus:bg-amber-50"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr>
                      <th
                        className={`${cellBorder} bg-neutral-100 px-2 py-2 font-extrabold`}
                        style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                      >
                        مجموع القطع
                      </th>
                      {DAYS.map((d) => (
                        <td
                          key={d.index}
                          className={`${cellBorder} bg-neutral-100 px-1 py-2 font-bold`}
                          style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                        >
                          {columnTotal(sheet, d.index) || ''}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Save my sheet', 'حفظ ورقتي')}
        </Button>
      </div>
    </form>
  );
}
