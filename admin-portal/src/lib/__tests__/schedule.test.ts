/**
 * @jest-environment node
 */
import { stopMatchesDate, weekdayOrdinalInMonth } from '@/lib/schedule';

describe('weekdayOrdinalInMonth', () => {
  it('returns 1 for first Monday of March 2026', () => {
    const r = weekdayOrdinalInMonth('2026-03-02');
    expect(r).toEqual({ dayOfWeek: 1, ordinal: 1 });
  });

  it('returns 2 for second Monday of March 2026', () => {
    const r = weekdayOrdinalInMonth('2026-03-09');
    expect(r).toEqual({ dayOfWeek: 1, ordinal: 2 });
  });
});

describe('stopMatchesDate', () => {
  it('matches weekly stop on same weekday', () => {
    expect(
      stopMatchesDate(
        { day_of_week: 1, service_frequency: 'weekly', week_ordinal: null },
        '2026-03-09'
      )
    ).toBe(true);
  });

  it('rejects weekly stop on different weekday', () => {
    expect(
      stopMatchesDate(
        { day_of_week: 2, service_frequency: 'weekly', week_ordinal: null },
        '2026-03-09'
      )
    ).toBe(false);
  });

  it('matches monthly on 2nd Monday', () => {
    expect(
      stopMatchesDate(
        { day_of_week: 1, service_frequency: 'monthly', week_ordinal: 2 },
        '2026-03-09'
      )
    ).toBe(true);
  });

  it('rejects monthly when ordinal differs', () => {
    expect(
      stopMatchesDate(
        { day_of_week: 1, service_frequency: 'monthly', week_ordinal: 1 },
        '2026-03-09'
      )
    ).toBe(false);
  });
});
