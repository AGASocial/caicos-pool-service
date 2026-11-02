#!/usr/bin/env tsx
/**
 * Demo company seed — "Demo Caicos (demo)".
 *
 * Idempotently creates a realistic, fully FICTIONAL demo tenant (Davie, FL area):
 * admin + technicians, ~900 pools on weekly Mon–Fri routes (stops + schedules),
 * and N past weeks of completed jobs with reports, photos, skipped/can't-service
 * visits and open follow-ups.
 *
 * SAFETY
 *  - Every write/delete is scoped to DEMO_COMPANY_ID (hardcoded below). The QA
 *    company is refused explicitly. Users are only touched if their profile is
 *    absent or already belongs to the demo company.
 *  - Refuses to run when CI is set. Never wire this into CI.
 *  - Generated passwords are written ONLY to the accounts file (chmod 600) and
 *    never printed.
 *  - No schema changes; uses existing tables only. Soft-delete tables are never
 *    hard-deleted (re-runs revive / skip existing rows instead).
 *
 * USAGE (see docs/DEMO.md)
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/demo-seed.ts --photos-dir ./demo-photos [options]
 *
 *   --dry-run              Build the plan and print counts only (no env, no network)
 *   --from-csv <file>      Use customers/routes from a CSV instead of generating them
 *   --techs <n>            Generated technicians (default 30)
 *   --pools <n>            Generated pools (default 900)
 *   --weeks <n>            Past weeks of jobs (default 4, max 8)
 *   --photos-dir <dir>     Folder of EXIF-stripped .jpg pool/equipment photos
 *   --no-photos            Skip photo upload / photo rows
 *   --accounts-out <file>  Where to save demo logins (default /workspace/secrets/demo_accounts.json)
 *   --seed <n>             RNG seed for deterministic data (default 20261102)
 *
 * DAILY / MAINTENANCE MODES (no users, photos upload or plan generation; demo company only)
 *   --today                Create/refresh TODAY's jobs (America/New_York) so the live status board
 *                          shows a mix of en_route / in_progress / completed / pending. Idempotent:
 *                          re-runs never duplicate and only move a job forward. Sat/Sun reuse the
 *                          Friday/Monday routes. Also closes yesterday's leftover en_route/in_progress.
 *   --refresh-texts        Rewrite existing demo notes / follow-ups / can't-service labels / route
 *                          day names from the English seed text to Spanish (exact-match, demo only).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

export const DEMO_COMPANY_ID = 'de300000-ca1c-4c05-8000-0000000000d0';
const QA_COMPANY_ID = '45173a02-9f30-4a07-89bb-16923bd043b5';
const DEMO_COMPANY_NAME = 'Demo Caicos (demo)';
const DEMO_ADMIN_EMAIL = 'demo-admin@cadenzaops.com';
const TZ = 'America/New_York';
const BUCKET = 'report-photos';
/** Legacy (English) day names used by earlier runs; kept to match/rename existing routes. */
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

if ((DEMO_COMPANY_ID as string) === QA_COMPANY_ID) throw new Error('DEMO_COMPANY_ID must not be the QA company');

// ---------------------------------------------------------------- args
interface Opts {
  dryRun: boolean; csv?: string; techs: number; pools: number; weeks: number;
  photosDir?: string; noPhotos: boolean; accountsOut: string; seed: number;
  today: boolean; refreshTexts: boolean;
}
function parseArgs(argv: string[]): Opts {
  const o: Opts = { dryRun: false, techs: 30, pools: 900, weeks: 4, noPhotos: false,
    accountsOut: '/workspace/secrets/demo_accounts.json', seed: 20261102,
    today: false, refreshTexts: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => { const x = argv[++i]; if (!x) throw new Error(`${a} needs a value`); return x; };
    switch (a) {
      case '--dry-run': o.dryRun = true; break;
      case '--from-csv': o.csv = v(); break;
      case '--techs': o.techs = Math.max(1, Math.min(200, parseInt(v(), 10))); break;
      case '--pools': o.pools = Math.max(1, Math.min(5000, parseInt(v(), 10))); break;
      case '--weeks': o.weeks = Math.max(1, Math.min(8, parseInt(v(), 10))); break;
      case '--photos-dir': o.photosDir = v(); break;
      case '--no-photos': o.noPhotos = true; break;
      case '--accounts-out': o.accountsOut = v(); break;
      case '--seed': o.seed = parseInt(v(), 10); break;
      case '--today': o.today = true; break;
      case '--refresh-texts': o.refreshTexts = true; break;
      case '-h': case '--help': console.log('See header of scripts/demo-seed.ts and docs/DEMO.md'); process.exit(0);
      default: throw new Error(`Unknown argument: ${a}`);
    }
  }
  return o;
}

// ---------------------------------------------------------------- rng
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(str: string): number { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/** Per-key deterministic RNG so re-runs produce identical choices regardless of order. */
const keyed = (seed: number, key: string) => mulberry32(seed ^ hash(key));
const pick = <T,>(r: () => number, arr: readonly T[]) => arr[Math.floor(r() * arr.length)];

// ---------------------------------------------------------------- fictional data
const FIRST = ['Ana', 'Carlos', 'Maria', 'Luis', 'Sofia', 'Daniel', 'Laura', 'Miguel', 'Isabel', 'Jorge', 'Elena', 'Ricardo', 'Valeria', 'Andres', 'Camila', 'Michael', 'Jennifer', 'David', 'Sarah', 'James', 'Emily', 'Robert', 'Jessica', 'William', 'Ashley', 'Kevin', 'Nicole', 'Brian', 'Rachel', 'Steven', 'Megan', 'Paul', 'Natalia', 'Diego', 'Gabriela', 'Fernando', 'Patricia', 'Thomas', 'Linda', 'Mark'];
const LAST = ['Martinez', 'Rodriguez', 'Gonzalez', 'Hernandez', 'Lopez', 'Perez', 'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera', 'Gomez', 'Diaz', 'Morales', 'Ortiz', 'Castro', 'Vargas', 'Romero', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young', 'King', 'Wright'];
const AREAS: { city: string; zips: string[]; streets: string[]; weight: number }[] = [
  { city: 'Davie', weight: 40, zips: ['33314', '33324', '33325', '33328', '33330', '33331'],
    streets: ['S University Dr', 'SW 36th St', 'Orange Dr', 'Griffin Rd', 'Stirling Rd', 'SW 64th Ave', 'Flamingo Rd', 'Nob Hill Rd', 'SW 39th St', 'Davie Rd', 'SW 130th Ave', 'Shotgun Rd', 'SW 26th St', 'Pine Island Rd'] },
  { city: 'Cooper City', weight: 15, zips: ['33024', '33026', '33328', '33330'],
    streets: ['Embassy Lakes Dr', 'SW 90th Ave', 'Sheridan St', 'SW 51st St', 'Palm Ave', 'SW 118th Ave', 'Stirling Rd'] },
  { city: 'Weston', weight: 15, zips: ['33326', '33327', '33331', '33332'],
    streets: ['Indian Trace', 'Bonaventure Blvd', 'Saddle Club Rd', 'Royal Palm Blvd', 'Weston Rd', 'Country Isles Rd', 'Racquet Club Rd'] },
  { city: 'Plantation', weight: 15, zips: ['33317', '33322', '33324', '33325'],
    streets: ['NW 70th Ave', 'Peters Rd', 'W Broward Blvd', 'NW 5th St', 'Plantation Rd', 'NW 84th Ave', 'Cleary Blvd'] },
  { city: 'Southwest Ranches', weight: 5, zips: ['33330', '33331', '33332'],
    streets: ['SW 160th Ave', 'Griffin Rd', 'SW 54th Pl', 'Volunteer Rd', 'SW 196th Ln'] },
  { city: 'Fort Lauderdale', weight: 10, zips: ['33301', '33312', '33315', '33316'],
    streets: ['SW 4th Ave', 'SE 9th St', 'SW 17th St', 'Riverland Rd', 'SW 11th Ct', 'SE 15th St'] },
];
// Seed text is Spanish (demo audience). *_EN arrays are what earlier runs wrote; same order → used by --refresh-texts.
const EQUIP_EN = ['Pentair SuperFlo pump, cartridge filter', 'Hayward MaxFlo pump, sand filter', 'Jandy variable-speed pump, DE filter', 'Pentair IntelliFlo VSF, salt cell', 'Hayward Super Pump, cartridge filter, gas heater', 'Polaris cleaner, Pentair Clean & Clear filter'];
const EQUIP = ['Bomba Pentair SuperFlo, filtro de cartucho', 'Bomba Hayward MaxFlo, filtro de arena', 'Bomba Jandy de velocidad variable, filtro DE', 'Pentair IntelliFlo VSF, celda de sal', 'Bomba Hayward Super Pump, filtro de cartucho, calentador a gas', 'Limpiafondos Polaris, filtro Pentair Clean & Clear'];
const NOTES_EN = ['Dog in yard — close gate', 'Call before arrival', 'Screen enclosure door sticks', 'Side gate on the left', 'Customer prefers mornings', 'Salt system — check cell monthly'];
const NOTES = ['Perro en el patio — cerrar la reja', 'Llamar antes de llegar', 'La puerta del screen se traba', 'Entrada lateral a la izquierda', 'El cliente prefiere mañanas', 'Sistema de sal — revisar la celda cada mes', '', '', '', ''];
const TECH_NOTES_EN = ['Brushed walls and steps, emptied baskets.', 'Vacuumed, balanced chemicals.', 'Cleaned filter, water clear.', 'Skimmed debris after storm.', 'Added chlorine tabs, checked pump pressure.'];
const TECH_NOTES = ['Cepillé paredes y escalones, vacié canastas.', 'Aspiré y balanceé químicos.', 'Limpié el filtro, agua cristalina.', 'Retiré hojas y basura después de la tormenta.', 'Agregué pastillas de cloro, revisé la presión de la bomba.'];
const FOLLOW_UPS_EN = ['Pump motor noisy — recommend inspection.', 'Filter pressure high — cartridge replacement suggested.', 'Timer not keeping time — needs reset/replacement.', 'Persistent algae — shock treatment recommended next visit.', 'Weak return flow — check for clog.'];
const FOLLOW_UPS: { cat: string; note: string }[] = [
  { cat: 'motor', note: 'Motor de la bomba ruidoso — se recomienda inspección.' },
  { cat: 'filter', note: 'Presión alta en el filtro — se sugiere cambiar el cartucho.' },
  { cat: 'timer', note: 'El timer no mantiene la hora — requiere ajuste o reemplazo.' },
  { cat: 'chemistry', note: 'Alga persistente — tratamiento de choque en la próxima visita.' },
  { cat: 'circulation', note: 'Retorno débil — revisar posible obstrucción.' },
];
const SKIP_NOTE_EN = 'Could not service today.';
const SKIP_NOTE = 'No se pudo dar servicio hoy.';
const ACTION_NOTE_EN = 'Reviewed — scheduling a technician visit.';
const ACTION_NOTE = 'Revisado — programando visita del técnico.';
const ACTION_RESOLVED_EN = 'Issue fixed on follow-up visit.';
const ACTION_RESOLVED = 'Problema resuelto en la visita de seguimiento.';
const CANT_REASONS_EN = ['Gate locked', 'Dog in yard', 'Customer asked to skip', 'Weather'];
const CANT_REASONS = [
  { slug: 'gate_locked', label: 'Reja con candado' },
  { slug: 'dog_in_yard', label: 'Perro en el patio' },
  { slug: 'customer_request', label: 'El cliente pidió saltar la visita' },
  { slug: 'weather', label: 'Clima' },
];

/** [table, column, english, spanish] pairs for --refresh-texts (exact matches only). */
export function textRefreshPairs(): [string, string, string, string][] {
  const out: [string, string, string, string][] = [];
  EQUIP_EN.forEach((en, i) => out.push(['cadenza_properties', 'equipment_notes', en, EQUIP[i]]));
  NOTES_EN.forEach((en, i) => out.push(['cadenza_properties', 'notes', en, NOTES[i]]));
  TECH_NOTES_EN.forEach((en, i) => out.push(['cadenza_service_reports', 'notes', en, TECH_NOTES[i]]));
  out.push(['cadenza_service_reports', 'notes', SKIP_NOTE_EN, SKIP_NOTE]);
  FOLLOW_UPS_EN.forEach((en, i) => out.push(['cadenza_service_reports', 'follow_up_notes', en, FOLLOW_UPS[i].note]));
  out.push(['cadenza_job_follow_up_actions', 'body', ACTION_NOTE_EN, ACTION_NOTE]);
  out.push(['cadenza_job_follow_up_actions', 'body', ACTION_RESOLVED_EN, ACTION_RESOLVED]);
  CANT_REASONS_EN.forEach((en, i) => out.push(['cadenza_cant_service_reasons', 'label', en, CANT_REASONS[i].label]));
  return out;
}
/** "Tech Name – Fri" → "Tech Name – Vie" (also "(Fri)" suffix of CSV routes); null when unchanged. */
export function spanishRouteName(name: string): string | null {
  const m = name.match(/^(.*)( – | \()(Sun|Mon|Tue|Wed|Thu|Fri|Sat)(\)?)$/);
  if (!m) return null;
  return `${m[1]}${m[2]}${DAYS[DAYS_EN.indexOf(m[3])]}${m[4] ?? ''}`;
}

// ---------------------------------------------------------------- plan types
interface PlanTech { key: string; email: string; fullName: string }
interface PlanProperty {
  key: string; customer_name: string; customer_email: string | null; customer_phone: string | null;
  address: string; city: string; state: string; zip: string; gate_code: string | null;
  pool_type: string; pool_surface: string | null; equipment_notes: string | null; notes: string | null;
  is_active: boolean; techKey: string; routeName: string | null; days: number[];
}
interface Plan { techs: PlanTech[]; properties: PlanProperty[] }

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const propKey = (address: string, city: string) => `${address.trim().toLowerCase()}|${city.trim().toLowerCase()}`;

function generatePlan(o: Opts): Plan {
  const r = mulberry32(o.seed);
  const techs: PlanTech[] = [];
  const usedNames = new Set<string>();
  for (let i = 1; i <= o.techs; i++) {
    let name = '';
    do { name = `${pick(r, FIRST)} ${pick(r, LAST)}`; } while (usedNames.has(name));
    usedNames.add(name);
    const n = String(i).padStart(2, '0');
    techs.push({ key: `tech-${n}`, email: `demo-tech-${n}@example.com`, fullName: name });
  }
  const totalW = AREAS.reduce((s, a) => s + a.weight, 0);
  const seen = new Set<string>();
  const properties: PlanProperty[] = [];
  for (let i = 0; properties.length < o.pools && i < o.pools * 20; i++) {
    let w = r() * totalW; const area = AREAS.find((a) => (w -= a.weight) < 0) ?? AREAS[0];
    const address = `${100 + Math.floor(r() * 19800)} ${pick(r, area.streets)}`;
    const k = propKey(address, area.city);
    if (seen.has(k)) continue; seen.add(k);
    const first = pick(r, FIRST), last = pick(r, LAST);
    const idx = properties.length;
    const commercial = r() < 0.06;
    properties.push({
      key: k, customer_name: commercial ? `${last} Villas HOA` : `${last}, ${first}`,
      customer_email: `${slug(first)}.${slug(last)}${idx}@example.com`,
      customer_phone: `(954) 555-${String(100 + (idx % 900)).padStart(4, '0')}`,
      address, city: area.city, state: 'FL', zip: pick(r, area.zips),
      gate_code: r() < 0.55 ? String(1000 + Math.floor(r() * 9000)) : null,
      pool_type: commercial ? 'commercial' : r() < 0.08 ? 'spa' : 'residential',
      pool_surface: pick(r, ['plaster', 'plaster', 'pebble', 'tile', 'fiberglass', 'vinyl']),
      equipment_notes: pick(r, EQUIP), notes: pick(r, NOTES) || null, is_active: true,
      // round-robin across techs and Mon–Fri so every route has a similar load
      techKey: techs[idx % techs.length].key, routeName: null,
      days: [1 + (Math.floor(idx / techs.length) % 5)],
    });
  }
  return { techs, properties };
}

// ---------------------------------------------------------------- CSV
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row);
  const [header, ...body] = rows; if (!header) return [];
  const h = header.map((x) => x.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? '').trim()])));
}
const DAY_MAP: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const POOL_TYPES = ['residential', 'commercial', 'spa', 'other'];
const SURFACES = ['plaster', 'pebble', 'tile', 'vinyl', 'fiberglass', 'other'];

function planFromCsv(file: string): Plan {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const required = ['customer_name', 'address', 'city', 'zip', 'tech_name', 'visit_day'];
  const techs = new Map<string, PlanTech>();
  const properties: PlanProperty[] = []; const seen = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 2;
    for (const k of required) if (!r[k]) throw new Error(`CSV line ${line}: missing ${k}`);
    const days = [...new Set(r.visit_day.split('|').map((d) => {
      const n = DAY_MAP[d.trim().slice(0, 3).toLowerCase()];
      if (!n) throw new Error(`CSV line ${line}: visit_day "${d}" must be Mon..Sat`); return n; }))];
    const pt = (r.pool_type || 'residential').toLowerCase();
    if (!POOL_TYPES.includes(pt)) throw new Error(`CSV line ${line}: pool_type must be one of ${POOL_TYPES.join('/')}`);
    const surf = (r.pool_surface || '').toLowerCase();
    if (surf && !SURFACES.includes(surf)) throw new Error(`CSV line ${line}: pool_surface must be one of ${SURFACES.join('/')}`);
    const tk = slug(r.tech_name);
    if (!techs.has(tk)) techs.set(tk, { key: tk, email: `demo-tech-${tk}@example.com`, fullName: r.tech_name });
    const k = propKey(r.address, r.city);
    if (seen.has(k)) throw new Error(`CSV line ${line}: duplicate address ${r.address}, ${r.city}`);
    seen.add(k);
    properties.push({
      key: k, customer_name: r.customer_name, customer_email: r.customer_email || null, customer_phone: r.customer_phone || null,
      address: r.address, city: r.city, state: r.state || 'FL', zip: r.zip, gate_code: r.gate_code || null,
      pool_type: pt, pool_surface: surf || null, equipment_notes: r.equipment_notes || null, notes: r.notes || null,
      is_active: !/^(false|0|no)$/i.test(r.is_active || 'true'), techKey: tk, routeName: r.route_name || null, days,
    });
  });
  if (!properties.length) throw new Error('CSV has no data rows');
  return { techs: [...techs.values()], properties };
}

// ---------------------------------------------------------------- routes & visits (pure)
interface PlanRoute { key: string; name: string; techKey: string; day: number; stops: PlanProperty[] }
function buildRoutes(plan: Plan): PlanRoute[] {
  const byKey = new Map<string, PlanRoute>();
  const techName = new Map(plan.techs.map((t) => [t.key, t.fullName]));
  for (const p of plan.properties) for (const d of p.days) {
    const base = p.routeName ?? `${techName.get(p.techKey)} – ${DAYS[d]}`;
    const name = p.routeName && p.days.length > 1 ? `${base} (${DAYS[d]})` : base;
    const key = `${p.techKey}|${d}|${name}`;
    if (!byKey.has(key)) byKey.set(key, { key, name, techKey: p.techKey, day: d, stops: [] });
    byKey.get(key)!.stops.push(p);
  }
  for (const r of byKey.values()) r.stops.sort((a, b) => a.zip.localeCompare(b.zip) || a.address.localeCompare(b.address));
  return [...byKey.values()];
}
function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function todayInTz(): string { return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); }
/** Past dates (excluding today) within `weeks` weeks, with their weekday. */
function pastDates(weeks: number): { date: string; dow: number }[] {
  const out: { date: string; dow: number }[] = [];
  const t = new Date(`${todayInTz()}T12:00:00Z`);
  for (let i = weeks * 7; i >= 1; i--) { const d = new Date(t.getTime() - i * 86400000); out.push({ date: ymd(d), dow: d.getUTCDay() }); }
  return out;
}
function tzOffset(date: string): string {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' }).formatToParts(new Date(`${date}T12:00:00Z`));
  const v = p.find((x) => x.type === 'timeZoneName')?.value ?? 'GMT-05:00';
  return v === 'GMT' ? '+00:00' : v.replace('GMT', '');
}
interface PlanVisit { route: PlanRoute; prop: PlanProperty; order: number; date: string;
  outcome: 'completed' | 'skipped' | 'followup'; arrival: string; departure: string; r: () => number }
function buildVisits(routes: PlanRoute[], weeks: number, seed: number): PlanVisit[] {
  const dates = pastDates(weeks); const out: PlanVisit[] = [];
  for (const route of routes) for (const { date, dow } of dates) {
    if (dow !== route.day) continue;
    let minutes = 8 * 60 + Math.floor(keyed(seed, route.key + date)() * 30);
    route.stops.forEach((prop, i) => {
      if (!prop.is_active) return;
      const r = keyed(seed, `${prop.key}|${date}`);
      const x = r();
      const outcome = x < 0.04 ? 'skipped' : x < 0.10 ? 'followup' : 'completed';
      minutes += 10 + Math.floor(r() * 15); // drive
      const off = tzOffset(date);
      const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
      const arrival = `${date}T${hhmm(minutes)}${off}`;
      minutes += outcome === 'skipped' ? 3 : 20 + Math.floor(r() * 20);
      out.push({ route, prop, order: i + 1, date, outcome, arrival, departure: `${date}T${hhmm(minutes)}${off}`, r });
    });
  }
  return out;
}

// ---------------------------------------------------------------- supabase helpers
type SB = SupabaseClient;
async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p; if (error) throw new Error(`${what}: ${error.message}`); return data;
}
async function fetchAll<T>(make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, what: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make(from, from + 999); if (error) throw new Error(`${what}: ${error.message}`);
    out.push(...(data ?? [])); if (!data || data.length < 1000) return out;
  }
}
async function insertBatches<T extends object>(sb: SB, table: string, rows: T[], select = 'id'): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const data = await must(sb.from(table).insert(rows.slice(i, i + 500)).select(select), `insert ${table}`);
    out.push(...((data ?? []) as unknown as Record<string, unknown>[]));
  }
  return out;
}
const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const strongPassword = () => randomBytes(18).toString('base64url') + 'Aa1!';

// ---------------------------------------------------------------- seed
async function ensureUsers(sb: SB, accounts: { email: string; fullName: string; role: string }[], accountsOut: string) {
  const all: { id: string; email?: string }[] = [];
  for (let page = 1; page < 200; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    all.push(...data.users); if (data.users.length < 1000) break;
  }
  const byEmail = new Map(all.map((u) => [(u.email ?? '').toLowerCase(), u.id]));
  let saved: { company_id?: string; accounts?: { email: string; password: string; role: string; user_id: string }[] } = {};
  if (fs.existsSync(accountsOut)) saved = JSON.parse(fs.readFileSync(accountsOut, 'utf8'));
  const savedPw = new Map((saved.accounts ?? []).map((a) => [a.email.toLowerCase(), a]));
  const result: { email: string; password: string; role: string; user_id: string }[] = [];
  let created = 0, reset = 0;
  const persist = () => {
    fs.mkdirSync(path.dirname(accountsOut), { recursive: true });
    fs.writeFileSync(accountsOut, JSON.stringify({ company_id: DEMO_COMPANY_ID, company_name: DEMO_COMPANY_NAME,
      supabase_url: process.env.SUPABASE_URL, accounts: result }, null, 2), { mode: 0o600 });
    fs.chmodSync(accountsOut, 0o600);
  };
  for (const a of accounts) {
    const email = a.email.toLowerCase();
    const meta = { company_id: DEMO_COMPANY_ID, role: a.role, full_name: a.fullName };
    let id = byEmail.get(email);
    let password = savedPw.get(email)?.password;
    if (id) {
      const prof = await must(sb.from('cadenza_profiles').select('company_id').eq('id', id).maybeSingle(), 'profile lookup');
      if (prof && prof.company_id !== DEMO_COMPANY_ID) throw new Error(`Refusing: ${email} belongs to another company`);
      if (!password) { // unknown password → set a fresh one (demo users only)
        password = strongPassword();
        const { error: upErr } = await sb.auth.admin.updateUserById(id, { password, user_metadata: meta });
        if (upErr) throw new Error(`reset ${email}: ${upErr.message}`); reset++;
      }
      if (!prof) await must(sb.from('cadenza_profiles').insert({ id, company_id: DEMO_COMPANY_ID, role: a.role, full_name: a.fullName }), `profile ${email}`);
    } else {
      password = strongPassword();
      const { data, error: cErr } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
      if (cErr || !data.user) throw new Error(`createUser ${email}: ${cErr?.message ?? 'no user'}`);
      id = data.user.id; created++;
      const prof = await must(sb.from('cadenza_profiles').select('id').eq('id', id).maybeSingle(), 'profile check');
      if (!prof) await must(sb.from('cadenza_profiles').insert({ id, company_id: DEMO_COMPANY_ID, role: a.role, full_name: a.fullName }), `profile ${email}`);
    }
    await must(sb.from('cadenza_profiles').update({ role: a.role, full_name: a.fullName, is_active: true })
      .eq('id', id).eq('company_id', DEMO_COMPANY_ID), `profile update ${email}`);
    result.push({ email, password: password!, role: a.role, user_id: id! });
    persist(); // after each user so a crash never loses a password
  }
  return { ids: new Map(result.map((r) => [r.email, r.user_id])), created, reset };
}

async function seed(o: Opts, plan: Plan) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY');
  process.env.SUPABASE_URL = url;
  const photos = o.noPhotos ? [] : listPhotos(o.photosDir);
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const C = DEMO_COMPANY_ID;
  const routes = buildRoutes(plan);

  console.log(`🌱 Seeding ${DEMO_COMPANY_NAME} (${C})`);
  // 1. company (+ tier)
  const existing = await must(sb.from('cadenza_companies').select('id').eq('id', C).maybeSingle(), 'company');
  const companyRow = { name: DEMO_COMPANY_NAME, subscription_tier: 'pro', phone: '(954) 555-0100', email: 'office@example.com', address: '4000 S University Dr, Davie, FL 33328' };
  if (existing) await must(sb.from('cadenza_companies').update(companyRow).eq('id', C), 'company update');
  else await must(sb.from('cadenza_companies').insert({ id: C, ...companyRow }), 'company insert');

  // 2. users
  const accounts = [{ email: DEMO_ADMIN_EMAIL, fullName: 'Demo Admin', role: 'admin' },
    ...plan.techs.map((t) => ({ email: t.email, fullName: t.fullName, role: 'technician' }))];
  const { ids, created, reset } = await ensureUsers(sb, accounts, o.accountsOut);
  const adminId = ids.get(DEMO_ADMIN_EMAIL)!;
  const techId = new Map(plan.techs.map((t) => [t.key, ids.get(t.email.toLowerCase())!]));
  console.log(`  users: ${accounts.length} (${created} created, ${reset} password reset) → ${o.accountsOut}`);

  // 3. plan limits: active Pro subscription for the demo admin (same as QA seed, provider 'test')
  const sub = await must(sb.from('cadenza_billing_subscriptions').select('id').eq('user_id', adminId).eq('status', 'active').limit(1), 'sub');
  if (!sub?.length) await must(sb.from('cadenza_billing_subscriptions').insert({ user_id: adminId, plan_id: 'plan_pro_month', status: 'active',
    provider: 'test', provider_subscription_id: `demo-sub-${C}`, provider_customer_id: `demo-cust-${C}`,
    current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + 365 * 86400000).toISOString() }), 'sub insert');

  // 4. can't-service reasons
  const reasons = await must(sb.from('cadenza_cant_service_reasons').select('slug').eq('company_id', C), 'reasons');
  const haveR = new Set((reasons ?? []).map((r) => r.slug));
  const newR = CANT_REASONS.filter((r) => !haveR.has(r.slug)).map((r, i) => ({ company_id: C, slug: r.slug, label: r.label, sort_order: i + 1 }));
  if (newR.length) await insertBatches(sb, 'cadenza_cant_service_reasons', newR);

  // 5. properties (key: address+city)
  const props = await fetchAll<{ id: string; address: string; city: string | null }>((f, t) => sb.from('cadenza_properties')
    .select('id, address, city').eq('company_id', C).order('id').range(f, t), 'properties');
  const propId = new Map(props.map((p) => [propKey(p.address, p.city ?? ''), p.id]));
  const toInsert = plan.properties.filter((p) => !propId.has(p.key));
  const insP = await insertBatches(sb, 'cadenza_properties', toInsert.map((p) => ({ company_id: C, customer_name: p.customer_name,
    customer_email: p.customer_email, customer_phone: p.customer_phone, address: p.address, city: p.city, state: p.state, zip: p.zip,
    gate_code: p.gate_code, pool_type: p.pool_type, pool_surface: p.pool_surface, equipment_notes: p.equipment_notes, notes: p.notes,
    is_active: p.is_active })), 'id, address, city');
  for (const p of insP) propId.set(propKey(p.address as string, (p.city as string) ?? ''), p.id as string);
  console.log(`  properties: ${plan.properties.length} (${insP.length} new)`);

  // 6. routes (key: tech + day + name), revive soft-deleted
  const exR = await fetchAll<{ id: string; name: string; technician_id: string; day_of_week: number | null; is_deleted: boolean }>((f, t) =>
    sb.from('cadenza_routes').select('id, name, technician_id, day_of_week, is_deleted').eq('company_id', C).order('id').range(f, t), 'routes');
  const routeId = new Map<string, string>();
  for (const r of exR) routeId.set(`${r.technician_id}|${r.day_of_week}|${spanishRouteName(r.name) ?? r.name}`, r.id);
  const revive = exR.filter((r) => r.is_deleted).map((r) => r.id);
  for (const c of chunks(revive, 200)) await must(sb.from('cadenza_routes').update({ is_deleted: false, is_active: true }).in('id', c).eq('company_id', C), 'revive routes');
  const newRoutes = routes.filter((r) => !routeId.has(`${techId.get(r.techKey)}|${r.day}|${r.name}`));
  const insR = await insertBatches(sb, 'cadenza_routes', newRoutes.map((r) => ({ company_id: C, name: r.name, technician_id: techId.get(r.techKey),
    day_of_week: r.day, is_active: true })), 'id, name, technician_id, day_of_week');
  for (const r of insR) routeId.set(`${r.technician_id}|${r.day_of_week}|${r.name}`, r.id as string);
  const rid = (r: PlanRoute) => routeId.get(`${techId.get(r.techKey)}|${r.day}|${r.name}`)!;
  console.log(`  routes: ${routes.length} (${insR.length} new)`);

  // 7. stops + schedules (scoped via demo route ids)
  const allRouteIds = routes.map(rid);
  const exS: { id: string; route_id: string; property_id: string; is_deleted: boolean }[] = [];
  for (const c of chunks(allRouteIds, 100)) exS.push(...await fetchAll<typeof exS[number]>((f, t) => sb.from('cadenza_route_stops')
    .select('id, route_id, property_id, is_deleted').in('route_id', c).order('id').range(f, t), 'stops'));
  const stopId = new Map(exS.map((s) => [`${s.route_id}|${s.property_id}`, s.id]));
  const reviveS = exS.filter((s) => s.is_deleted).map((s) => s.id);
  for (const c of chunks(reviveS, 200)) await must(sb.from('cadenza_route_stops').update({ is_deleted: false }).in('id', c), 'revive stops') // ids come from the demo-route-scoped query above;
  const newStops = routes.flatMap((r) => r.stops.map((p, i) => ({ route_id: rid(r), property_id: propId.get(p.key)!, stop_order: i + 1,
    day_of_week: r.day, service_frequency: 'weekly', week_ordinal: null }))).filter((s) => !stopId.has(`${s.route_id}|${s.property_id}`));
  const insS = await insertBatches(sb, 'cadenza_route_stops', newStops, 'id, route_id, property_id, day_of_week');
  for (const s of insS) stopId.set(`${s.route_id}|${s.property_id}`, s.id as string);
  const allStopIds = [...stopId.values()];
  const exSch = new Set<string>();
  for (const c of chunks(allStopIds, 200)) for (const s of await fetchAll<{ route_stop_id: string }>((f, t) => sb.from('cadenza_route_stop_schedules')
    .select('route_stop_id').in('route_stop_id', c).eq('is_deleted', false).order('id').range(f, t), 'schedules')) exSch.add(s.route_stop_id);
  const effFrom = pastDates(o.weeks)[0].date;
  const newSch = routes.flatMap((r) => r.stops.map((p) => ({ route_stop_id: stopId.get(`${rid(r)}|${propId.get(p.key)}`)!, day_of_week: r.day,
    service_frequency: 'weekly', week_ordinal: null, effective_from: effFrom }))).filter((s) => !exSch.has(s.route_stop_id));
  await insertBatches(sb, 'cadenza_route_stop_schedules', newSch);
  console.log(`  stops: ${stopId.size} (${insS.length} new), schedules +${newSch.length}`);

  // 8. jobs (key: property + date + route)
  const visits = buildVisits(routes, o.weeks, o.seed);
  const dates = pastDates(o.weeks);
  const exJ = await fetchAll<{ id: string; property_id: string; scheduled_date: string; route_id: string | null }>((f, t) => sb.from('cadenza_service_jobs')
    .select('id, property_id, scheduled_date, route_id').eq('company_id', C).eq('is_deleted', false)
    .gte('scheduled_date', dates[0].date).lte('scheduled_date', dates[dates.length - 1].date).order('id').range(f, t), 'jobs');
  const jobId = new Map(exJ.map((j) => [`${j.property_id}|${j.scheduled_date}|${j.route_id}`, j.id]));
  const vk = (v: PlanVisit) => `${propId.get(v.prop.key)}|${v.date}|${rid(v.route)}`;
  const newJobs = visits.filter((v) => !jobId.has(vk(v))).map((v) => ({ company_id: C, property_id: propId.get(v.prop.key)!,
    technician_id: techId.get(v.route.techKey)!, scheduled_date: v.date, status: v.outcome === 'skipped' ? 'skipped' : 'completed',
    route_order: v.order, route_id: rid(v.route), job_source: 'route', estimated_duration_min: 30,
    en_route_at: v.arrival, updated_at: v.departure }));
  const insJ = await insertBatches(sb, 'cadenza_service_jobs', newJobs, 'id, property_id, scheduled_date, route_id');
  for (const j of insJ) jobId.set(`${j.property_id}|${j.scheduled_date}|${j.route_id}`, j.id as string);
  console.log(`  jobs: ${visits.length} (${insJ.length} new)`);

  // 9. reports
  const allJobIds = visits.map((v) => jobId.get(vk(v))!);
  const repByJob = new Map<string, string>();
  for (const c of chunks(allJobIds, 200)) for (const r of await fetchAll<{ id: string; job_id: string }>((f, t) => sb.from('cadenza_service_reports')
    .select('id, job_id').eq('company_id', C).eq('is_deleted', false).in('job_id', c).order('id').range(f, t), 'reports')) repByJob.set(r.job_id, r.id);
  const newReps = visits.filter((v) => !repByJob.has(jobId.get(vk(v))!)).map((v) => {
    const r = v.r; const fu = v.outcome === 'followup' ? pick(r, FOLLOW_UPS) : null;
    const resolved = fu && r() < 0.3;
    return { job_id: jobId.get(vk(v))!, company_id: C, technician_id: techId.get(v.route.techKey)!, arrival_time: v.arrival, departure_time: v.departure,
      ph_level: v.outcome === 'skipped' ? null : +(7.2 + r() * 0.6).toFixed(1), chlorine_level: v.outcome === 'skipped' ? null : +(1 + r() * 3).toFixed(1),
      alkalinity: v.outcome === 'skipped' ? null : 80 + Math.floor(r() * 40),
      notes: v.outcome === 'skipped' ? SKIP_NOTE : pick(r, TECH_NOTES),
      follow_up_needed: !!fu, follow_up_notes: fu?.note ?? null, issue_categories: fu ? [fu.cat] : [],
      follow_up_status: resolved ? 'resolved' : 'open',
      cant_service_reasons: v.outcome === 'skipped' ? [pick(r, CANT_REASONS).slug] : [] };
  });
  const insRep = await insertBatches(sb, 'cadenza_service_reports', newReps, 'id, job_id, follow_up_needed, follow_up_status');
  for (const r of insRep) repByJob.set(r.job_id as string, r.id as string);
  console.log(`  reports: ${repByJob.size} (${insRep.length} new)`);

  // 10. photos — upload the library once under the demo company folder, reuse across visits
  let photoRows = 0;
  if (photos.length) {
    const lib: string[] = [];
    for (const f of photos) {
      const p = `${C}/demo-library/${path.basename(f)}`;
      const { error } = await sb.storage.from(BUCKET).upload(p, fs.readFileSync(f), { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(`upload ${p}: ${error.message}`);
      lib.push(p);
    }
    const allRep = [...repByJob.values()];
    const withPhoto = new Set<string>();
    for (const c of chunks(allRep, 200)) for (const p of await fetchAll<{ report_id: string }>((f, t) => sb.from('cadenza_report_photos')
      .select('report_id').eq('company_id', C).in('report_id', c).order('id').range(f, t), 'photos')) withPhoto.add(p.report_id);
    const rows = visits.filter((v) => v.outcome !== 'skipped').flatMap((v) => {
      const rep = repByJob.get(jobId.get(vk(v))!)!; if (withPhoto.has(rep)) return [];
      const rr = keyed(o.seed, `photo|${rep}`); const n = v.outcome === 'followup' ? 2 : 1;
      return Array.from({ length: n }, (_, i) => ({ report_id: rep, company_id: C, storage_path: pick(rr, lib),
        photo_type: v.outcome === 'followup' && i === 1 ? 'equipment' : 'after', caption: null, storage_tier: 'hot' }));
    });
    photoRows = (await insertBatches(sb, 'cadenza_report_photos', rows)).length;
    console.log(`  photos: ${lib.length} files uploaded, ${photoRows} new photo rows`);
  }

  // 11. follow-up actions (one note per follow-up job; resolved ones get a resolution entry)
  const fuVisits = visits.filter((v) => v.outcome === 'followup');
  const fuJobIds = fuVisits.map((v) => jobId.get(vk(v))!);
  const haveA = new Set<string>();
  for (const c of chunks(fuJobIds, 200)) for (const a of await fetchAll<{ job_id: string }>((f, t) => sb.from('cadenza_job_follow_up_actions')
    .select('job_id').eq('company_id', C).in('job_id', c).order('id').range(f, t), 'actions')) haveA.add(a.job_id);
  const repStatus = new Map<string, string>();
  for (const c of chunks(fuJobIds, 200)) for (const r of await must(sb.from('cadenza_service_reports').select('job_id, follow_up_status')
    .eq('company_id', C).in('job_id', c), 'fu status') ?? []) repStatus.set(r.job_id, r.follow_up_status);
  const actions = fuVisits.filter((v) => !haveA.has(jobId.get(vk(v))!)).flatMap((v) => {
    const j = jobId.get(vk(v))!; const rep = repByJob.get(j)!;
    const a = [{ company_id: C, job_id: j, report_id: rep, author_id: adminId, action_type: 'note', body: ACTION_NOTE, metadata: {} }];
    if (repStatus.get(j) === 'resolved') a.push({ company_id: C, job_id: j, report_id: rep, author_id: adminId, action_type: 'resolved', body: ACTION_RESOLVED, metadata: {} });
    return a;
  });
  await insertBatches(sb, 'cadenza_job_follow_up_actions', actions);
  console.log(`  follow-up actions +${actions.length}`);
  console.log('✅ Demo seed complete. Logins are in the accounts file (not printed).');
}

// ---------------------------------------------------------------- --today / --refresh-texts
function serviceClient(): SB {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export type TodayStatus = 'completed' | 'in_progress' | 'en_route' | 'pending';
const RANK: Record<string, number> = { pending: 0, en_route: 1, in_progress: 2, completed: 3, skipped: 3, cancelled: 3 };

/** Weekday whose routes are used for `dow` (weekend → Fri/Mon routes so Sat demos still have a live board). */
export function sourceDayFor(dow: number): number { return dow === 6 ? 5 : dow === 0 ? 1 : dow; }

/**
 * Deterministic status for each stop of a route today: the first `done` stops completed, then one
 * in_progress, one en_route, the rest pending. `done` grows with the local hour so the board looks
 * live whenever it is run (≈25% at 8am → ≈90% by 5pm), and varies per route.
 */
export function todayStatuses(stopCount: number, routeKey: string, hour: number, seed = 20261102): TodayStatus[] {
  const r = keyed(seed, `today|${routeKey}`);
  const dayFrac = Math.min(0.9, Math.max(0.15, (hour - 7) / 11));
  const frac = Math.min(0.95, Math.max(0.05, dayFrac + (r() - 0.5) * 0.3));
  const done = Math.min(stopCount, Math.floor(stopCount * frac));
  return Array.from({ length: stopCount }, (_, i) =>
    i < done ? 'completed' : i === done ? 'in_progress' : i === done + 1 ? 'en_route' : 'pending');
}

function localHour(): number {
  return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date()), 10) % 24;
}

async function seedToday(o: Opts) {
  const sb = serviceClient(); const C = DEMO_COMPANY_ID;
  const date = todayInTz(); const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); const src = sourceDayFor(dow);
  const hour = localHour(); const now = Date.now(); const iso = (ms: number) => new Date(ms).toISOString();
  console.log(`📅 --today ${date} (${DAYS[dow]}), routes of ${DAYS[src]}, ${DEMO_COMPANY_NAME}`);

  // 0. close leftovers from earlier days (en_route / in_progress → completed), demo only
  const stale = await fetchAll<{ id: string; scheduled_date: string; status: string }>((f, t) => sb.from('cadenza_service_jobs')
    .select('id, scheduled_date, status').eq('company_id', C).eq('is_deleted', false).lt('scheduled_date', date)
    .in('status', ['en_route', 'in_progress']).order('id').range(f, t), 'stale jobs');
  for (const c of chunks(stale.map((j) => j.id), 200)) {
    await must(sb.from('cadenza_service_jobs').update({ status: 'completed' }).in('id', c).eq('company_id', C), 'close stale');
    await must(sb.from('cadenza_service_reports').update({ departure_time: iso(now - 86400000) }).in('job_id', c)
      .eq('company_id', C).is('departure_time', null), 'close stale reports');
  }

  // 1. routes + stops for the source weekday
  const routes = await must(sb.from('cadenza_routes').select('id, technician_id').eq('company_id', C).eq('is_deleted', false)
    .eq('day_of_week', src).order('name'), 'routes') ?? [];
  if (!routes.length) throw new Error(`No demo routes for ${DAYS[src]} — run the full seed first`);
  const stops: { id: string; route_id: string; property_id: string; stop_order: number }[] = [];
  for (const c of chunks(routes.map((r) => r.id as string), 100)) stops.push(...await fetchAll<typeof stops[number]>((f, t) =>
    sb.from('cadenza_route_stops').select('id, route_id, property_id, stop_order').in('route_id', c).eq('is_deleted', false)
      .order('id').range(f, t), 'stops'));

  // 2. existing jobs today (any source, incl. cron-generated pending ones)
  const exJ = await fetchAll<{ id: string; property_id: string; route_id: string | null; status: string }>((f, t) => sb.from('cadenza_service_jobs')
    .select('id, property_id, route_id, status').eq('company_id', C).eq('is_deleted', false).eq('scheduled_date', date).order('id').range(f, t), 'today jobs');
  const jobBy = new Map(exJ.map((j) => [`${j.property_id}|${j.route_id}`, j]));
  const lib = [...new Set((await must(sb.from('cadenza_report_photos').select('storage_path').eq('company_id', C).limit(200), 'photo lib') ?? [])
    .map((p) => p.storage_path as string).filter(Boolean))];

  type Want = { route: { id: string; technician_id: string }; stop: typeof stops[number]; status: TodayStatus; arrival: number; departure: number };
  const wants: Want[] = [];
  for (const route of routes as { id: string; technician_id: string }[]) {
    const rs = stops.filter((s) => s.route_id === route.id).sort((a, b) => a.stop_order - b.stop_order);
    const st = todayStatuses(rs.length, route.id, hour, o.seed);
    const done = st.filter((x) => x === 'completed').length;
    rs.forEach((stop, i) => {
      // completed stops end before now, spaced ~35 min apart; the in_progress one arrived 5–20 min ago
      const back = (done - i) * 35 * 60000;
      const arrival = st[i] === 'completed' ? now - back - 25 * 60000 : now - (5 + (i % 4) * 5) * 60000;
      wants.push({ route, stop, status: st[i], arrival, departure: now - back + 5 * 60000 });
    });
  }

  // 3. insert missing jobs as pending, then move each job forward to its target (never backwards)
  const missing = wants.filter((w) => !jobBy.has(`${w.stop.property_id}|${w.route.id}`));
  const ins = await insertBatches(sb, 'cadenza_service_jobs', missing.map((w) => ({ company_id: C, property_id: w.stop.property_id,
    technician_id: w.route.technician_id, route_id: w.route.id, scheduled_date: date, status: 'pending', route_order: w.stop.stop_order,
    job_source: 'route', estimated_duration_min: 30 })), 'id, property_id, route_id, status');
  for (const j of ins) jobBy.set(`${j.property_id}|${j.route_id}`, j as { id: string; property_id: string; route_id: string; status: string });

  const reps = new Map<string, { id: string; departure_time: string | null }>();
  const todayIds = [...jobBy.values()].map((j) => j.id);
  for (const c of chunks(todayIds, 200)) for (const r of await fetchAll<{ id: string; job_id: string; departure_time: string | null }>((f, t) =>
    sb.from('cadenza_service_reports').select('id, job_id, departure_time').eq('company_id', C).eq('is_deleted', false).in('job_id', c)
      .order('id').range(f, t), 'today reports')) reps.set(r.job_id, r);

  const counts: Record<string, number> = { completed: 0, in_progress: 0, en_route: 0, pending: 0 };
  let moved = 0, newReports = 0, newPhotos = 0;
  const newRepRows: Record<string, unknown>[] = [];
  const byStatus = new Map<string, string[]>();
  for (const w of wants) {
    const job = jobBy.get(`${w.stop.property_id}|${w.route.id}`)!;
    const target = RANK[job.status] >= RANK[w.status] ? job.status : w.status;
    counts[target] = (counts[target] ?? 0) + 1;
    if (target !== job.status) { moved++; (byStatus.get(target) ?? byStatus.set(target, []).get(target)!).push(job.id); }
    if ((target === 'completed' || target === 'in_progress') && !reps.has(job.id)) {
      const r = keyed(o.seed, `today|${job.id}`); const fin = target === 'completed';
      newRepRows.push({ job_id: job.id, company_id: C, technician_id: w.route.technician_id, arrival_time: iso(w.arrival),
        departure_time: fin ? iso(Math.min(w.departure, now - 60000)) : null,
        ph_level: fin ? +(7.2 + r() * 0.6).toFixed(1) : null, chlorine_level: fin ? +(1 + r() * 3).toFixed(1) : null,
        alkalinity: fin ? 80 + Math.floor(r() * 40) : null, notes: fin ? pick(r, TECH_NOTES) : null,
        skimmed: fin, brushed: fin, emptied_baskets: fin, follow_up_needed: false, issue_categories: [], follow_up_status: 'open',
        cant_service_reasons: [] });
    } else if (target === 'completed' && reps.get(job.id)?.departure_time == null && reps.has(job.id)) {
      await must(sb.from('cadenza_service_reports').update({ departure_time: iso(now - 60000) }).eq('id', reps.get(job.id)!.id).eq('company_id', C), 'finish report');
    }
  }
  for (const [status, ids] of byStatus) for (const c of chunks(ids, 200)) {
    const patch: Record<string, unknown> = { status };
    if (status !== 'pending') patch.en_route_at = iso(now - 30 * 60000);
    await must(sb.from('cadenza_service_jobs').update(patch).in('id', c).eq('company_id', C).eq('scheduled_date', date), `status ${status}`);
  }
  const insRep = await insertBatches(sb, 'cadenza_service_reports', newRepRows, 'id, job_id, departure_time');
  newReports = insRep.length;
  if (lib.length) {
    const rows = insRep.filter((r) => r.departure_time).map((r) => ({ report_id: r.id, company_id: C,
      storage_path: pick(keyed(o.seed, `photo|${r.id}`), lib), photo_type: 'after', caption: null, storage_tier: 'hot' }));
    newPhotos = (await insertBatches(sb, 'cadenza_report_photos', rows)).length;
  }
  console.log(`  routes ${routes.length}, jobs today ${wants.length} (${ins.length} new, ${moved} advanced), reports +${newReports}, photos +${newPhotos}, closed stale ${stale.length}`);
  console.log(`  board: ${JSON.stringify(counts)}`);
  console.log('✅ --today done');
}

async function refreshTexts() {
  const sb = serviceClient(); const C = DEMO_COMPANY_ID;
  console.log(`🔤 --refresh-texts ${DEMO_COMPANY_NAME}`);
  let total = 0;
  for (const [table, col, en, es] of textRefreshPairs()) {
    const data = await must(sb.from(table).update({ [col]: es }).eq('company_id', C).eq(col, en).select('id'), `${table}.${col}`);
    const n = (data ?? []).length; total += n; if (n) console.log(`  ${table}.${col}: ${n} → "${es}"`);
  }
  const routes = await fetchAll<{ id: string; name: string }>((f, t) => sb.from('cadenza_routes').select('id, name').eq('company_id', C).order('id').range(f, t), 'routes');
  let renamed = 0;
  for (const r of routes) {
    const es = spanishRouteName(r.name); if (!es || es === r.name) continue;
    await must(sb.from('cadenza_routes').update({ name: es }).eq('id', r.id).eq('company_id', C), 'rename route'); renamed++;
  }
  console.log(`  routes renamed: ${renamed}`);
  console.log(`✅ --refresh-texts done (${total + renamed} rows)`);
}

function listPhotos(dir?: string): string[] {
  if (!dir) throw new Error('--photos-dir <dir> is required (or pass --no-photos)');
  if (!fs.existsSync(dir)) throw new Error(`Photos dir not found: ${dir}`);
  const files = fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort().map((f) => path.join(dir, f));
  if (!files.length) throw new Error(`No .jpg files in ${dir}`);
  return files;
}

export function summarize(plan: Plan, weeks: number, seed: number) {
  const routes = buildRoutes(plan); const visits = buildVisits(routes, weeks, seed);
  const skipped = visits.filter((v) => v.outcome === 'skipped').length;
  const followups = visits.filter((v) => v.outcome === 'followup').length;
  return { technicians: plan.techs.length, properties: plan.properties.length, routes: routes.length,
    routeStops: routes.reduce((s, r) => s + r.stops.length, 0), jobs: visits.length,
    completed: visits.length - skipped, skipped, followUps: followups,
    photoRows: (visits.length - skipped - followups) + followups * 2,
    cities: [...new Set(plan.properties.map((p) => p.city))].sort() };
}

async function main() {
  if (process.env.CI) { console.error('❌ demo-seed must never run in CI (CI is set).'); process.exit(1); }
  const o = parseArgs(process.argv.slice(2));
  if ((DEMO_COMPANY_ID as string) === QA_COMPANY_ID) throw new Error('refusing QA company');
  if (o.refreshTexts || o.today) {
    if (o.dryRun) { console.log(JSON.stringify({ dryRun: true, mode: o.today ? 'today' : 'refresh-texts', date: todayInTz(), company: DEMO_COMPANY_ID })); return; }
    if (o.refreshTexts) await refreshTexts();
    if (o.today) await seedToday(o);
    return;
  }
  const plan = o.csv ? planFromCsv(o.csv) : generatePlan(o);
  if (o.dryRun) {
    if (!o.noPhotos && o.photosDir) console.log(`photo files: ${listPhotos(o.photosDir).length}`);
    console.log(JSON.stringify({ dryRun: true, company: DEMO_COMPANY_ID, weeks: o.weeks, ...summarize(plan, o.weeks, o.seed) }, null, 2));
    return;
  }
  await seed(o, plan);
}

if (require.main === module) main().catch((e) => { console.error('❌', e instanceof Error ? e.message : e); process.exit(1); });
