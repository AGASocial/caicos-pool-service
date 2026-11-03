import { describe, it, expect } from '@jest/globals';
import {
  resolveMapProvider, technicianStatus, upsertLocation, removeLocation, applyJobUpdate, isStale, boundsOf, one,
  OPENFREEMAP_LIBERTY, STALE_AFTER_MS, type TechnicianLocation, type MapJob,
} from '../technician-map';

const loc = (id: string, lat: number, extra: Partial<TechnicianLocation> = {}) =>
  ({ technician_id: id, company_id: 'c', lat, lng: -80.25, heading: null, speed_mps: null, accuracy_m: null,
    current_job_id: null, is_simulated: true, recorded_at: '2026-11-02T12:00:00Z', updated_at: '2026-11-02T12:00:00Z', ...extra }) as TechnicianLocation;

describe('technician-map helpers', () => {
  it('uses MapLibre/OpenFreeMap without a token and Mapbox with a pk. token', () => {
    expect(resolveMapProvider(undefined)).toEqual({ kind: 'maplibre', style: OPENFREEMAP_LIBERTY });
    expect(resolveMapProvider('')).toMatchObject({ kind: 'maplibre' });
    expect(resolveMapProvider('sk.secret')).toMatchObject({ kind: 'maplibre' });
    expect(resolveMapProvider('pk.abc')).toMatchObject({ kind: 'mapbox', token: 'pk.abc' });
  });

  it('derives technician status with in_progress > en_route > pending > completed', () => {
    expect(technicianStatus([])).toBe('idle');
    expect(technicianStatus([{ status: 'completed' }, { status: 'pending' }])).toBe('pending');
    expect(technicianStatus([{ status: 'pending' }, { status: 'en_route' }])).toBe('en_route');
    expect(technicianStatus([{ status: 'en_route' }, { status: 'in_progress' }])).toBe('in_progress');
    expect(technicianStatus([{ status: 'completed' }, { status: 'skipped' }])).toBe('completed');
  });

  it('upserts and removes locations by technician', () => {
    let list = upsertLocation([], loc('a', 26));
    list = upsertLocation(list, loc('b', 26.1));
    list = upsertLocation(list, loc('a', 26.05));
    expect(list).toHaveLength(2);
    expect(list.find((l) => l.technician_id === 'a')!.lat).toBe(26.05);
    expect(removeLocation(list, 'a').map((l) => l.technician_id)).toEqual(['b']);
  });

  it('patches a job in place without dropping embeds', () => {
    const jobs = [{ id: 'j1', status: 'pending', technician_id: 't', route_order: 1 } as unknown as MapJob];
    const out = applyJobUpdate(jobs, { id: 'j1', status: 'in_progress' });
    expect(out[0]).toMatchObject({ id: 'j1', status: 'in_progress', technician_id: 't' });
    expect(applyJobUpdate(jobs, { id: 'nope', status: 'completed' })[0].status).toBe('pending');
  });

  it('flags stale positions and computes bounds', () => {
    const now = Date.parse('2026-11-02T12:00:00Z');
    expect(isStale('2026-11-02T12:00:00Z', now)).toBe(false);
    expect(isStale(new Date(now - STALE_AFTER_MS - 1).toISOString(), now)).toBe(true);
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ lat: 26, lng: -80.3 }, { lat: 26.1, lng: -80.2 }])).toEqual([[-80.3, 26], [-80.2, 26.1]]);
    expect(one([1, 2])).toBe(1);
    expect(one(null)).toBeNull();
  });
});
