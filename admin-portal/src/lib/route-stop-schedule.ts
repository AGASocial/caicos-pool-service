import { formatLocalYmd } from '@/lib/date-week';
import { parseLocalDateParts, stopMatchesDate, type RouteStopScheduleRow } from '@/lib/schedule';

export type RouteStopScheduleSegment = {
  id?: string;
  route_stop_id?: string;
  effective_from: string;
  effective_until: string | null;
  day_of_week: number;
  service_frequency: 'weekly' | 'monthly';
  week_ordinal: number | null;
};

export function toScheduleRow(seg: RouteStopScheduleSegment): RouteStopScheduleRow {
  return {
    day_of_week: seg.day_of_week,
    service_frequency: seg.service_frequency,
    week_ordinal: seg.week_ordinal,
  };
}

/** Segments active on calendar date `dateStr` (YYYY-MM-DD); if several, pick latest effective_from. */
export function pickSegmentForDate(
  segments: RouteStopScheduleSegment[],
  dateStr: string
): RouteStopScheduleSegment | null {
  const applicable = segments.filter(
    (s) =>
      s.effective_from <= dateStr &&
      (s.effective_until === null || dateStr <= s.effective_until)
  );
  if (applicable.length === 0) return null;
  return applicable.reduce((a, b) => (a.effective_from > b.effective_from ? a : b));
}

/** First date >= fromDateStr where the segment effective on that day matches the pattern (within maxDays). */
export function nextMatchingDateFrom(
  segments: RouteStopScheduleSegment[],
  fromDateStr: string,
  maxDays = 120
): string | null {
  const parts = parseLocalDateParts(fromDateStr);
  if (!parts) return null;
  const d = new Date(parts.y, parts.m - 1, parts.d);
  if (
    d.getFullYear() !== parts.y ||
    d.getMonth() !== parts.m - 1 ||
    d.getDate() !== parts.d
  ) {
    return null;
  }
  for (let i = 0; i < maxDays; i++) {
    const ymd = formatLocalYmd(d);
    const seg = pickSegmentForDate(segments, ymd);
    if (seg && stopMatchesDate(toScheduleRow(seg), ymd)) {
      return ymd;
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

export function dayBeforeYmd(dateStr: string): string | null {
  const parts = parseLocalDateParts(dateStr);
  if (!parts) return null;
  const d = new Date(parts.y, parts.m - 1, parts.d);
  d.setDate(d.getDate() - 1);
  return formatLocalYmd(d);
}

export function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}
