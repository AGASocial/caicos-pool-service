/**
 * Route stop schedule vs a calendar date.
 * day_of_week: 0 = Sunday … 6 = Saturday (JavaScript Date.getDay()).
 */

export type RouteStopScheduleRow = {
  day_of_week: number;
  service_frequency: 'weekly' | 'monthly';
  week_ordinal: number | null;
};

/** Parse YYYY-MM-DD as local calendar date (no UTC shift). */
export function parseLocalDateParts(dateStr: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** Which occurrence (1–5) of this weekday in the month is this calendar day? */
export function weekdayOrdinalInMonth(dateStr: string): { dayOfWeek: number; ordinal: number } | null {
  const parts = parseLocalDateParts(dateStr);
  if (!parts) return null;
  const { y, m, d } = parts;
  const target = new Date(y, m - 1, d);
  if (
    target.getFullYear() !== y ||
    target.getMonth() !== m - 1 ||
    target.getDate() !== d
  ) {
    return null;
  }
  const dow = target.getDay();
  let ordinal = 0;
  for (let day = 1; day <= d; day++) {
    const t = new Date(y, m - 1, day);
    if (t.getDay() === dow) ordinal += 1;
  }
  return { dayOfWeek: dow, ordinal };
}

export function stopMatchesDate(stop: RouteStopScheduleRow, dateStr: string): boolean {
  const parts = parseLocalDateParts(dateStr);
  if (!parts) return false;
  const { y, m, d } = parts;
  const local = new Date(y, m - 1, d);
  if (
    local.getFullYear() !== y ||
    local.getMonth() !== m - 1 ||
    local.getDate() !== d
  ) {
    return false;
  }
  const dow = local.getDay();
  if (dow !== stop.day_of_week) return false;

  if (stop.service_frequency === 'weekly') return true;

  const info = weekdayOrdinalInMonth(dateStr);
  if (!info) return false;
  return info.ordinal === stop.week_ordinal;
}
