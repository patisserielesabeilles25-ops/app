'use client';

import { useMemo, useState } from 'react';
import { useActionState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import { saveAttendance, type SaveAttendanceState } from '@/lib/attendance/actions';
import { ATT_CYCLE, ABSENCE_WEIGHT, attCellKey, type AttendanceStatus } from '@/lib/attendance/config';
import type { FixedWorker } from '@/lib/attendance/queries';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initialState: SaveAttendanceState = {};

// Compact status styles for the grid cells.
const CELL: Record<AttendanceStatus, { label: string; cls: string }> = {
  PRESENT: { label: '', cls: 'bg-white text-neutral-300 hover:bg-neutral-50' },
  ABSENT: { label: 'A', cls: 'bg-red-100 text-red-700 font-bold' },
  HALF: { label: '½', cls: 'bg-amber-100 text-amber-700 font-bold' },
  LEAVE: { label: 'C', cls: 'bg-sky-100 text-sky-700 font-bold' },
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function AttendanceEditor({
  monthStart,
  daysInMonth,
  workers,
  initial,
}: {
  monthStart: string;
  daysInMonth: number;
  workers: FixedWorker[];
  initial: Record<string, AttendanceStatus>;
}) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveAttendance, initialState);
  const [vals, setVals] = useState<Record<string, AttendanceStatus>>(initial);

  const [year, month] = monthStart.split('-').map(Number);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const ymdFor = (day: number) => `${year}-${pad(month)}-${pad(day)}`;
  const isFriday = (day: number) => new Date(year, month - 1, day).getDay() === 5; // weekend

  const cycle = (key: string) => {
    setVals((v) => {
      const cur = v[key] ?? 'PRESENT';
      const next = ATT_CYCLE[(ATT_CYCLE.indexOf(cur) + 1) % ATT_CYCLE.length];
      const copy = { ...v };
      if (next === 'PRESENT') delete copy[key];
      else copy[key] = next;
      return copy;
    });
  };

  const payload = useMemo(() => JSON.stringify(vals), [vals]);

  const absencesFor = (employeeId: string) =>
    days.reduce((sum, d) => sum + ABSENCE_WEIGHT[vals[attCellKey(employeeId, ymdFor(d))] ?? 'PRESENT'], 0);

  if (workers.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-500">
        {tr(
          locale,
          'No fixed-rate workers. Set a user’s remuneration (Journalier / Hebdomadaire / Mensuel) first. Per-order workers don’t need attendance.',
          'لا يوجد عمال بأجر ثابت. عيّن أجر مستخدم (يومي / أسبوعي / شهري) أولًا. عمال القطعة لا يحتاجون إلى الحضور.',
        )}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="monthStart" value={monthStart} />
      <input type="hidden" name="payload" value={payload} />

      {state.ok ? (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          {tr(locale, 'Attendance saved.', 'تم حفظ الحضور.')}
        </div>
      ) : null}
      {state.error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      ) : null}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
        <span>{tr(locale, 'Tap a cell to cycle:', 'اضغط على الخلية للتبديل:')}</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-4 w-4 rounded border border-neutral-300 bg-white" /> {tr(locale, 'Present', 'حاضر')}</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-4 w-4 rounded bg-red-100 text-center text-[10px] font-bold text-red-700">A</span> {tr(locale, 'Absent', 'غائب')}</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-4 w-4 rounded bg-amber-100 text-center text-[10px] font-bold text-amber-700">½</span> {tr(locale, 'Half-day', 'نصف يوم')}</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-4 w-4 rounded bg-sky-100 text-center text-[10px] font-bold text-sky-700">C</span> {tr(locale, 'Paid leave', 'عطلة مدفوعة')}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50">
              <th className="sticky left-0 z-10 border-b border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-left font-semibold text-neutral-600">
                {tr(locale, 'Worker', 'العامل')}
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  className={`border-b border-neutral-200 px-0 py-2 text-center text-xs font-semibold ${isFriday(d) ? 'bg-neutral-100 text-neutral-400' : 'text-neutral-500'}`}
                  style={{ minWidth: 28 }}
                >
                  {d}
                </th>
              ))}
              <th className="border-b border-l border-neutral-200 px-3 py-2 text-center font-semibold text-neutral-600">
                {tr(locale, 'Absences', 'الغيابات')}
              </th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.employeeId} className="border-b border-neutral-100 last:border-0">
                <th className="sticky left-0 z-10 whitespace-nowrap border-r border-neutral-200 bg-white px-3 py-2 text-left font-medium text-neutral-800">
                  {w.name}
                </th>
                {days.map((d) => {
                  const key = attCellKey(w.employeeId, ymdFor(d));
                  const status = vals[key] ?? 'PRESENT';
                  const cell = CELL[status];
                  return (
                    <td key={d} className={isFriday(d) ? 'bg-neutral-50' : ''} style={{ minWidth: 28 }}>
                      <button
                        type="button"
                        onClick={() => cycle(key)}
                        title={ymdFor(d)}
                        className={`h-8 w-full border border-neutral-100 text-center text-xs ${cell.cls}`}
                      >
                        {cell.label}
                      </button>
                    </td>
                  );
                })}
                <td className="border-l border-neutral-200 px-3 py-2 text-center font-semibold text-neutral-700">
                  {absencesFor(w.employeeId) || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Save attendance', 'حفظ الحضور')}
        </Button>
      </div>
    </form>
  );
}
