import { lastNDaysRange } from '../date-week';

describe('lastNDaysRange', () => {
  it('returns today and the 6 previous local days', () => {
    expect(lastNDaysRange(7, new Date(2026, 10, 2, 22, 30))).toEqual({ from: '2026-10-27', to: '2026-11-02' });
  });
});
