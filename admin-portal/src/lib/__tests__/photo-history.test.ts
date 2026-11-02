import { mapHistory, parsePaging } from '../photo-history';

describe('photo-history', () => {
  it('maps visits, hides deleted, flags archived, collects hot paths', () => {
    const { visits, pathsToSign, photoRefs } = mapHistory([
      {
        id: 'j1', scheduled_date: '2026-10-10', status: 'completed', technician: { full_name: 'Tech A' },
        reports: [{
          id: 'r1', departure_time: '2026-10-10T15:00:00Z', is_deleted: false,
          photos: [
            { id: 'p1', storage_path: 'c/a.jpg', created_at: '2026-10-10T14:00:00Z', storage_tier: 'hot' },
            { id: 'p2', storage_path: 'c/b.jpg', created_at: '2026-10-10T14:05:00Z', storage_tier: 'archive' },
            { id: 'p3', storage_path: 'c/c.jpg', created_at: '2026-10-10T14:06:00Z', is_deleted: true },
          ],
        }],
      },
      { id: 'j2', scheduled_date: '2026-10-03', status: 'skipped', technician: null, reports: [] },
    ]);
    expect(visits).toHaveLength(2);
    expect(visits[0].photos.map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(visits[0].photos[0].archived).toBe(true);
    expect(pathsToSign).toEqual(['c/a.jpg']);
    expect(photoRefs[0].id).toBe('p1');
    expect(visits[1].photos).toEqual([]);
  });

  it('clamps paging', () => {
    expect(parsePaging(new URLSearchParams('page=0&page_size=500'))).toEqual({ page: 1, pageSize: 50 });
    expect(parsePaging(new URLSearchParams(''))).toEqual({ page: 1, pageSize: 10 });
  });
});
