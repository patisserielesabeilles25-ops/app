// Attendance status model. PRESENT is the default (no stored row); only
// exceptions (absence / half-day / paid leave) are recorded.
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF' | 'LEAVE';

/** Click order for cycling a cell. */
export const ATT_CYCLE: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'HALF', 'LEAVE'];

export type FixedMethod = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/** Days per pay period → the value of one day = rate / days. Calendar-based:
 *  week = 7 days (weekly ÷ 7), month = 30 (monthly ÷ 30). */
export const WORKING_DAYS: Record<FixedMethod, number> = { DAILY: 1, WEEKLY: 7, MONTHLY: 30 };

/** Days of pay lost per status. Paid leave (LEAVE) costs nothing. */
export const ABSENCE_WEIGHT: Record<AttendanceStatus, number> = {
  PRESENT: 0,
  ABSENT: 1,
  HALF: 0.5,
  LEAVE: 0,
};

export function attCellKey(employeeId: string, ymd: string): string {
  return `${employeeId}|${ymd}`;
}
