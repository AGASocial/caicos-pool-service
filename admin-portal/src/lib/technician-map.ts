/**
 * Pure helpers for the live technician map (no React / map library imports so
 * they are unit-testable and safe to import from server code).
 */

export type MapJobStatus = 'pending' | 'en_route' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';
export type TechMapStatus = 'en_route' | 'in_progress' | 'completed' | 'pending' | 'idle';

export type TechnicianLocation = {
  technician_id: string;
  company_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed_mps: number | null;
  current_job_id: string | null;
  is_simulated: boolean;
  updated_at: string;
  technician_name?: string | null;
};

export type MapJob = {
  id: string;
  status: MapJobStatus;
  technician_id: string | null;
  route_order: number | null;
  property: { id: string; customer_name: string; address: string; lat: number | null; lng: number | null } | null;
};

export type MapProvider = { kind: 'mapbox'; token: string; style: string } | { kind: 'maplibre'; style: string };

export const OPENFREEMAP_LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';
export const MAPBOX_STREETS = 'mapbox://styles/mapbox/streets-v12';
/** Davie, FL — default center when there is nothing to fit. */
export const DEFAULT_CENTER = { lat: 26.0765, lng: -80.2521 };
/** Locations older than this are drawn faded. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

/** Mapbox when a public token (pk.*) is configured, otherwise MapLibre + OpenFreeMap (free, no key). */
export function resolveMapProvider(token: string | undefined | null): MapProvider {
  const t = (token ?? '').trim();
  if (t.startsWith('pk.')) return { kind: 'mapbox', token: t, style: MAPBOX_STREETS };
  return { kind: 'maplibre', style: OPENFREEMAP_LIBERTY };
}

export const STATUS_COLORS: Record<TechMapStatus | MapJobStatus, string> = {
  en_route: '#2563eb', // blue
  in_progress: '#f59e0b', // amber
  completed: '#16a34a', // green
  pending: '#6b7280', // gray
  idle: '#9ca3af',
  skipped: '#dc2626', // red
  cancelled: '#9ca3af',
};

/** Technician status from their jobs today: on site > on the way > pending > all done > idle. */
export function technicianStatus(jobs: Pick<MapJob, 'status'>[]): TechMapStatus {
  if (!jobs.length) return 'idle';
  if (jobs.some((j) => j.status === 'in_progress')) return 'in_progress';
  if (jobs.some((j) => j.status === 'en_route')) return 'en_route';
  if (jobs.some((j) => j.status === 'pending')) return 'pending';
  return 'completed';
}

/** Insert or replace a location row (realtime INSERT/UPDATE), keeping a known name. */
export function upsertLocation(list: TechnicianLocation[], row: TechnicianLocation): TechnicianLocation[] {
  const i = list.findIndex((l) => l.technician_id === row.technician_id);
  if (i === -1) return [...list, row];
  const next = list.slice();
  next[i] = { ...list[i], ...row, technician_name: row.technician_name ?? list[i].technician_name };
  return next;
}

export function removeLocation(list: TechnicianLocation[], technicianId: string): TechnicianLocation[] {
  return list.filter((l) => l.technician_id !== technicianId);
}

/** Merge a realtime job UPDATE (no joins in payload) into the loaded jobs. */
export function applyJobUpdate(jobs: MapJob[], patch: Partial<MapJob> & { id: string }): MapJob[] {
  return jobs.map((j) => (j.id === patch.id ? { ...j, status: (patch.status ?? j.status) as MapJobStatus,
    technician_id: patch.technician_id !== undefined ? patch.technician_id : j.technician_id } : j));
}

export function isStale(updatedAt: string, now = Date.now()): boolean {
  const t = new Date(updatedAt).getTime();
  return Number.isFinite(t) && now - t > STALE_AFTER_MS;
}

/** Bounds [[minLng,minLat],[maxLng,maxLat]] covering all points, or null when empty. */
export function boundsOf(points: { lat: number; lng: number }[]): [[number, number], [number, number]] | null {
  const ok = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!ok.length) return null;
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
  for (const p of ok) { minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng); }
  return [[minLng, minLat], [maxLng, maxLat]];
}

/** Company operating zone. Job `scheduled_date` values are calendar days in this zone. */
export const BUSINESS_TIME_ZONE = 'America/Chicago';

/** Calendar date (YYYY-MM-DD) in {@link BUSINESS_TIME_ZONE}. */
export function businessToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Supabase embeds can come back as an object or a 1-element array. */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
