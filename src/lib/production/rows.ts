// Shared row/column definitions for the weekly production sheets, so the
// editable grid and any other consumer stay in sync with the paper layout.

export type SheetKey = 'MASQUAGE' | 'PREPARATION';

export const SHEETS: SheetKey[] = ['MASQUAGE', 'PREPARATION'];

// Work week runs Saturday → Friday (index 0..6).
export const DAYS: { index: number; ar: string }[] = [
  { index: 0, ar: 'السبت' },
  { index: 1, ar: 'الأحد' },
  { index: 2, ar: 'الإثنين' },
  { index: 3, ar: 'الثلاثاء' },
  { index: 4, ar: 'الأربعاء' },
  { index: 5, ar: 'الخميس' },
  { index: 6, ar: 'الجمعة' },
];

export type RowDef = {
  key: string;
  label: string;
  ltr?: boolean;          // latin/numeric label — keep left-to-right in the RTL sheet
  sep?: boolean;          // PLATEAU divider — not an input row
  masquageOnly?: boolean; // only on the MASQUAGE sheet
};

export const ROWS: RowDef[] = [
  { key: '10_13', label: '10 / 13', ltr: true },
  { key: 'mini', label: 'Mini Cake', ltr: true },
  { key: 'ital_1_4', label: 'Italian 1/4', ltr: true, masquageOnly: true },
  { key: '15_18', label: '15 / 18', ltr: true },
  { key: '25_30', label: '25 / 30', ltr: true },
  { key: '30_plus', label: 'اكثر من 30' },
  { key: 'plateau', label: 'PLATEAU', sep: true, ltr: true },
  { key: '3_4p', label: 'PLATEAU M', ltr: true },
  { key: '1_2p', label: '1/2P', ltr: true },
  { key: '1_4p', label: '1/4P', ltr: true },
  { key: '1_6p', label: '1/6P', ltr: true },
];

/** Rows shown on a sheet (drops MASQUAGE-only rows for other sheets). */
export function rowsForSheet(sheet: SheetKey): RowDef[] {
  return ROWS.filter((r) => !r.masquageOnly || sheet === 'MASQUAGE');
}

/** Cell key used in the editor state and the save payload. */
export function cellKey(sheet: SheetKey, rowKey: string, day: number): string {
  return `${sheet}|${rowKey}|${day}`;
}
