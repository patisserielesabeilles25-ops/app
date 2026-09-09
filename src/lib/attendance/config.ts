// Attendance status model. PRESENT is the default (no stored row); only
// exceptions (absence / half-day / paid leave) are recorded.
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF' | 'LEAVE';

/** Click order for cycling a cell. */
export const ATT_CYCLE: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'HALF', 'LEAVE'];

export type FixedMethod = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/** Working days per pay period → the value of one day = rate / working-days. */
export const WORKING_DAYS: Record<FixedMethod, number> = { DAILY: 1, WEEKLY: 6, MONTHLY: 26 };

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
