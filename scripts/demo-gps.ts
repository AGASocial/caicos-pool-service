/**
 * Pure helpers for demo map data (no network): deterministic "geocoding" of the
 * fictional demo properties and a tiny GPS simulator that drives technicians along
 * today's route order. Used by scripts/demo-seed.ts (--geocode / --simulate-gps).
 */

export type LatLng = { lat: number; lng: number };

/** Rough residential bounding boxes (land, west of I-95 except FTL) for the demo cities. */
export const CITY_BOXES: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  'davie': { minLat: 26.045, maxLat: 26.095, minLng: -80.335, maxLng: -80.225 },
  'cooper city': { minLat: 26.035, maxLat: 26.065, minLng: -80.305, maxLng: -80.255 },
  'weston': { minLat: 26.075, maxLat: 26.125, minLng: -80.415, maxLng: -80.365 },
  'plantation': { minLat: 26.105, maxLat: 26.140, minLng: -80.285, maxLng: -80.215 },
  'southwest ranches': { minLat: 26.045, maxLat: 26.075, minLng: -80.395, maxLng: -80.340 },
  'fort lauderdale': { minLat: 26.095, maxLat: 26.130, minLng: -80.165, maxLng: -80.135 },
};
const DEFAULT_BOX = CITY_BOXES['davie'];

function fnv(str: string): number { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/**
 * Deterministic, realistic coordinates for a fictional address: inside the city box,
 * clustered by ZIP (each ZIP gets a sub-area) so a route sorted by ZIP is compact.
 * Same input → same output (idempotent re-runs).
 */
export function demoCoords(p: { address: string; city: string | null; zip: string | null }, seed = 20261102): LatLng {
  const box = CITY_BOXES[(p.city ?? '').trim().toLowerCase()] ?? DEFAULT_BOX;
  const zr = rng(seed ^ fnv(`zip|${p.city}|${p.zip}`));
  // ZIP sub-area: 45% of the box, placed deterministically inside it
  const w = (box.maxLng - box.minLng) * 0.45, h = (box.maxLat - box.minLat) * 0.45;
  const zx = box.minLng + zr() * (box.maxLng - box.minLng - w), zy = box.minLat + zr() * (box.maxLat - box.minLat - h);
  const r = rng(seed ^ fnv(`addr|${p.address.trim().toLowerCase()}|${(p.city ?? '').trim().toLowerCase()}`));
  return { lat: round6(zy + r() * h), lng: round6(zx + r() * w) };
}

export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function bearing(a: LatLng, b: LatLng): number {
  const toR = Math.PI / 180, y = Math.sin((b.lng - a.lng) * toR) * Math.cos(b.lat * toR);
  const x = Math.cos(a.lat * toR) * Math.sin(b.lat * toR) - Math.sin(a.lat * toR) * Math.cos(b.lat * toR) * Math.cos((b.lng - a.lng) * toR);
  return (Math.atan2(y, x) / toR + 360) % 360;
}

/** Broward streets are a grid: drive north/south first, then east/west (L-shaped leg). */
export function legPath(from: LatLng, to: LatLng): LatLng[] {
  return [from, { lat: to.lat, lng: from.lng }, to];
}

/** Point at `meters` along a polyline (clamped to the end). */
export function pointAlong(path: LatLng[], meters: number): { point: LatLng; done: boolean; heading: number } {
  let left = Math.max(0, meters);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], d = distanceM(a, b);
    if (d === 0) continue;
    if (left <= d) {
      const f = left / d;
      return { point: { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f }, done: false, heading: bearing(a, b) };
    }
    left -= d;
  }
  const last = path[path.length - 1], prev = path.length > 1 ? path[path.length - 2] : last;
  return { point: last, done: true, heading: bearing(prev, last) };
}

// ------------------------------------------------------------ simulator (pure state machine)
export type SimJob = { id: string; status: string; at: LatLng; routeOrder: number };
export type SimTech = {
  technicianId: string;
  jobs: SimJob[]; // route order
  pos: LatLng;
  idx: number; // index of the job being driven to / worked on; jobs.length = finished
  phase: 'driving' | 'onsite' | 'done';
  legFrom: LatLng;
  traveled: number; // meters along current leg
  dwellLeft: number; // ticks left on site
  heading: number;
};
export type SimEvent = { type: 'en_route' | 'arrived' | 'completed'; technicianId: string; jobId: string };
export type SimOptions = { speedMps: number; intervalS: number; dwellTicks: number };

const FINISHED = new Set(['completed', 'skipped', 'cancelled']);

/** Initial state from today's jobs: resume at the first unfinished stop. */
export function initTech(technicianId: string, jobs: SimJob[], seed = 20261102): SimTech {
  const sorted = [...jobs].sort((a, b) => a.routeOrder - b.routeOrder);
  const idx = sorted.findIndex((j) => !FINISHED.has(j.status));
  if (idx === -1) {
    const last = sorted[sorted.length - 1]?.at ?? { lat: 26.0765, lng: -80.2521 };
    return { technicianId, jobs: sorted, pos: last, idx: sorted.length, phase: 'done', legFrom: last, traveled: 0, dwellLeft: 0, heading: 0 };
  }
  const target = sorted[idx];
  if (target.status === 'in_progress') {
    return { technicianId, jobs: sorted, pos: target.at, idx, phase: 'onsite', legFrom: target.at, traveled: 0, dwellLeft: 2, heading: 0 };
  }
  // start at the previous stop, or ~1.5 km south-west of the first one (coming from the shop)
  const r = rng(seed ^ fnv(`start|${technicianId}`));
  const from = idx > 0 ? sorted[idx - 1].at : { lat: target.at.lat - 0.008 - r() * 0.006, lng: target.at.lng - 0.008 - r() * 0.006 };
  return { technicianId, jobs: sorted, pos: from, idx, phase: 'driving', legFrom: from, traveled: 0, dwellLeft: 0, heading: bearing(from, target.at) };
}

/** Advance one tick. Returns the new state and the job status events to persist. */
export function stepTech(s: SimTech, o: SimOptions): { state: SimTech; events: SimEvent[] } {
  const events: SimEvent[] = [];
  if (s.phase === 'done') return { state: s, events };
  const job = s.jobs[s.idx];
  if (s.phase === 'driving') {
    if (job.status === 'pending') { events.push({ type: 'en_route', technicianId: s.technicianId, jobId: job.id }); job.status = 'en_route'; }
    const traveled = s.traveled + o.speedMps * o.intervalS;
    const { point, done, heading } = pointAlong(legPath(s.legFrom, job.at), traveled);
    if (!done) return { state: { ...s, pos: point, traveled, heading }, events };
    job.status = 'in_progress';
    events.push({ type: 'arrived', technicianId: s.technicianId, jobId: job.id });
    return { state: { ...s, pos: job.at, traveled: 0, phase: 'onsite', dwellLeft: o.dwellTicks, heading }, events };
  }
  // on site
  if (s.dwellLeft > 1) return { state: { ...s, dwellLeft: s.dwellLeft - 1 }, events };
  job.status = 'completed';
  events.push({ type: 'completed', technicianId: s.technicianId, jobId: job.id });
  let idx = s.idx + 1;
  while (idx < s.jobs.length && FINISHED.has(s.jobs[idx].status)) idx++;
  if (idx >= s.jobs.length) return { state: { ...s, idx, phase: 'done', dwellLeft: 0 }, events };
  const next = s.jobs[idx];
  if (next.status === 'pending') { next.status = 'en_route'; events.push({ type: 'en_route', technicianId: s.technicianId, jobId: next.id }); }
  return { state: { ...s, idx, phase: 'driving', legFrom: job.at, traveled: 0, dwellLeft: 0, heading: bearing(job.at, next.at) }, events };
}
