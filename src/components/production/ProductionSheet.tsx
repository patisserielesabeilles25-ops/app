// A blank weekly production log for one piece-rate worker, filled in by hand.
// Mirrors the paper sheets: a title (MASQUAGE / COULAGE), the seven weekdays as
// columns, and the cake sizes + plateau fractions as rows, ending with a totals
// row. The content is Arabic (worker-facing) regardless of the app locale.

const DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

// Rows in order. `sep` marks the PLATEAU divider (a category header, not a size);
// `ltr` keeps latin/numeric labels reading left-to-right inside the RTL sheet.
const ROWS: { label: string; sep?: boolean; ltr?: boolean }[] = [
  { label: '10 / 13', ltr: true },
  { label: '15 / 18', ltr: true },
  { label: '25 / 30', ltr: true },
  { label: 'اكثر من 30' },
  { label: 'PLATEAU', sep: true, ltr: true },
  { label: '3/4P', ltr: true },
  { label: '1/2P', ltr: true },
  { label: '1/4P', ltr: true },
  { label: '1/6P', ltr: true },
];

const cell = 'border border-neutral-900 text-center align-middle';

export function ProductionSheet({ title }: { title: string }) {
  return (
    <div dir="rtl" className="w-full text-neutral-900">
      {/* Worker / period header lines */}
      <div className="mb-3 space-y-2 text-sm font-semibold">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2">
          <span>اسم العامل : ...................................</span>
          <span>الشهر : ...................................</span>
        </div>
        <div>
          <span>الأسبوع : من ..................... الى .....................</span>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={`${cell} bg-neutral-100 px-2 py-2 text-base font-extrabold`} style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
              {title}
            </th>
            {DAYS.map((d) => (
              <th key={d} className={`${cell} px-1 py-2 font-bold`}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label}>
              <th
                dir={r.ltr ? 'ltr' : undefined}
                className={`${cell} px-2 py-3 font-bold ${r.sep ? 'bg-neutral-100' : ''}`}
                style={r.sep ? { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } : undefined}
              >
                {r.label}
              </th>
              {DAYS.map((d) => (
                <td key={d} className={`${cell} h-10`} />
              ))}
            </tr>
          ))}
          <tr>
            <th className={`${cell} bg-neutral-100 px-2 py-3 font-extrabold`} style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
              مجموع القطع
            </th>
            {DAYS.map((d) => (
              <td key={d} className={`${cell} h-11`} />
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
