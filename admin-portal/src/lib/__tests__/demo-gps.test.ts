import { describe, it, expect } from '@jest/globals';
import { demoCoords, CITY_BOXES, distanceM, pointAlong, legPath, initTech, stepTech, type SimJob } from '../../../../scripts/demo-gps';

describe('demo-gps geocode', () => {
  it('is deterministic and inside the city box', () => {
    const p = { address: '1234 SW 64th Ave', city: 'Davie', zip: '33314' };
    const a = demoCoords(p), b = demoCoords({ ...p });
    expect(a).toEqual(b);
    const box = CITY_BOXES['davie'];
    expect(a.lat).toBeGreaterThanOrEqual(box.minLat); expect(a.lat).toBeLessThanOrEqual(box.maxLat);
    expect(a.lng).toBeGreaterThanOrEqual(box.minLng); expect(a.lng).toBeLessThanOrEqual(box.maxLng);
    expect(demoCoords({ ...p, address: '99 Other St' })).not.toEqual(a);
  });
  it('keeps every demo city on land in Broward', () => {
    for (const city of ['Weston', 'Plantation', 'Cooper City', 'Southwest Ranches', 'Fort Lauderdale', 'Unknown']) {
      const c = demoCoords({ address: `1 ${city} Rd`, city, zip: '33000' });
      expect(c.lat).toBeGreaterThan(26.0); expect(c.lat).toBeLessThan(26.15);
      expect(c.lng).toBeGreaterThan(-80.42); expect(c.lng).toBeLessThan(-80.13);
    }
  });
});

describe('demo-gps motion', () => {
  it('measures and walks a path', () => {
    const a = { lat: 26.0, lng: -80.25 }, b = { lat: 26.01, lng: -80.24 };
    expect(distanceM(a, { lat: 26.01, lng: -80.25 })).toBeCloseTo(1112, -1);
    const path = legPath(a, b);
    expect(path[1]).toEqual({ lat: 26.01, lng: -80.25 });
    expect(pointAlong(path, 0).point).toEqual(a);
    expect(pointAlong(path, 556).point.lat).toBeCloseTo(26.005, 4);
    expect(pointAlong(path, 1e6)).toMatchObject({ point: b, done: true });
  });

  it('drives the route in order: en_route → arrived → completed → next en_route', () => {
    const jobs: SimJob[] = [
      { id: 'j2', status: 'pending', at: { lat: 26.02, lng: -80.25 }, routeOrder: 2 },
      { id: 'j1', status: 'pending', at: { lat: 26.01, lng: -80.25 }, routeOrder: 1 },
    ];
    let s = initTech('t1', jobs);
    expect(s.phase).toBe('driving'); expect(s.jobs[s.idx].id).toBe('j1');
    const o = { speedMps: 500, intervalS: 3, dwellTicks: 2 };
    const log: string[] = [];
    for (let i = 0; i < 40 && s.phase !== 'done'; i++) { const r = stepTech(s, o); s = r.state; log.push(...r.events.map((e) => `${e.type}:${e.jobId}`)); }
    expect(log).toEqual(['en_route:j1', 'arrived:j1', 'completed:j1', 'en_route:j2', 'arrived:j2', 'completed:j2']);
    expect(s.pos).toEqual({ lat: 26.02, lng: -80.25 });
  });

  it('resumes at the first unfinished stop and is done when all are finished', () => {
    const at = { lat: 26.05, lng: -80.3 };
    const s = initTech('t', [{ id: 'a', status: 'completed', at, routeOrder: 1 }, { id: 'b', status: 'in_progress', at, routeOrder: 2 }]);
    expect(s).toMatchObject({ phase: 'onsite', idx: 1 });
    expect(initTech('t', [{ id: 'a', status: 'skipped', at, routeOrder: 1 }]).phase).toBe('done');
  });
});
