/**
 * Bulk-import properties from a CSV file (same columns as PropertyForm / POST /api/properties).
 *
 * Usage (from admin-portal/):
 *   npm run script:import-properties -- --file ../docs/sample-properties-davie-university-dr.csv --company <UUID>
 *     → validates CSV only (default; no DB writes).
 *   npm run script:import-properties -- --file ./data.csv --company <UUID> --insert
 *     → validates, then inserts (requires .env.local + service role).
 *
 * Env (only with --insert): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 *
 * Flow: parse CSV → validate all rows → stop unless --insert → then insert. Any validation error aborts before DB writes.
 */

import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const POOL_TYPES = ['residential', 'commercial', 'spa', 'other'] as const;
const POOL_SURFACES = ['plaster', 'pebble', 'tile', 'vinyl', 'fiberglass', 'other'] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REQUIRED_HEADERS = ['customer_name', 'address'] as const;
const OPTIONAL_HEADERS = [
  'customer_email',
  'customer_phone',
  'city',
  'state',
  'zip',
  'gate_code',
  'pool_type',
  'pool_surface',
  'equipment_notes',
  'notes',
  'is_active',
] as const;

type PropertyRow = {
  customer_name: string;
  address: string;
  customer_email: string | null;
  customer_phone: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  gate_code: string | null;
  pool_type: string | null;
  pool_surface: string | null;
  equipment_notes: string | null;
  notes: string | null;
  is_active: boolean;
};

function parseArgs(): { file?: string; companyId?: string; insert: boolean } {
  const raw = process.argv.slice(2);
  let file: string | undefined;
  let companyId: string | undefined;
  let insert = false;
  const positional: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === '--insert') insert = true;
    else if (a === '--dry-run') {
      /* backward compat: default is already validate-only */
    } else if (a.startsWith('--file=')) file = a.slice('--file='.length);
    else if (a === '--file') file = raw[++i];
    else if (a.startsWith('--company=')) companyId = a.slice('--company='.length);
    else if (a === '--company') companyId = raw[++i];
    else if (!a.startsWith('-')) positional.push(a);
  }

  if (!file && positional[0]) file = positional[0];
  if (!companyId && positional[1]) companyId = positional[1];

  return { file, companyId, insert };
}

/** RFC 4180–style parser: quoted fields, doubled quotes, commas inside quotes. */
function parseCsv(content: string): string[][] {
  let text = content;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== '') {
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/^\ufeff/, '');
}

function parseBool(raw: string | undefined): boolean | 'invalid' {
  if (raw === undefined || raw === '') return true;
  const v = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(v)) return true;
  if (['false', '0', 'no', 'n'].includes(v)) return false;
  return 'invalid';
}

function validatePoolType(raw: string | undefined): string | null | 'invalid' {
  if (raw === undefined || raw.trim() === '') return null;
  const v = raw.trim().toLowerCase();
  if ((POOL_TYPES as readonly string[]).includes(v)) return v;
  return 'invalid';
}

function validatePoolSurface(raw: string | undefined): string | null | 'invalid' {
  if (raw === undefined || raw.trim() === '') return null;
  const v = raw.trim().toLowerCase();
  if ((POOL_SURFACES as readonly string[]).includes(v)) return v;
  return 'invalid';
}

function rowToProperty(
  cells: string[],
  col: Map<string, number>,
): { ok: true; row: PropertyRow } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const get = (key: string) => {
    const idx = col.get(key);
    if (idx === undefined) return '';
    return cells[idx] ?? '';
  };

  const customer_name = get('customer_name').trim();
  const address = get('address').trim();
  if (!customer_name) errors.push('customer_name is required');
  if (!address) errors.push('address is required');

  const emailRaw = get('customer_email').trim();
  let customer_email: string | null = null;
  if (emailRaw) {
    if (!EMAIL_RE.test(emailRaw)) errors.push(`invalid customer_email: ${emailRaw}`);
    else customer_email = emailRaw;
  }

  const poolType = validatePoolType(get('pool_type'));
  if (poolType === 'invalid') errors.push(`invalid pool_type (allowed: ${POOL_TYPES.join(', ')})`);

  const poolSurface = validatePoolSurface(get('pool_surface'));
  if (poolSurface === 'invalid') {
    errors.push(`invalid pool_surface (allowed: ${POOL_SURFACES.join(', ')})`);
  }

  const active = parseBool(get('is_active'));
  if (active === 'invalid') errors.push('is_active must be true/false, 1/0, or yes/no');

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    row: {
      customer_name,
      address,
      customer_email,
      customer_phone: get('customer_phone').trim() || null,
      city: get('city').trim() || null,
      state: get('state').trim() || null,
      zip: get('zip').trim() || null,
      gate_code: get('gate_code').trim() || null,
      pool_type: poolType === 'invalid' ? null : poolType,
      pool_surface: poolSurface === 'invalid' ? null : poolSurface,
      equipment_notes: get('equipment_notes').trim() || null,
      notes: get('notes').trim() || null,
      is_active: active === 'invalid' ? true : active,
    },
  };
}

function buildColumnMap(headerRow: string[]): { ok: true; col: Map<string, number> } | { ok: false; message: string } {
  const headers = headerRow.map(normalizeHeader);
  const col = new Map<string, number>();
  const seen = new Set<string>();

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
    if (seen.has(h)) return { ok: false, message: `Duplicate column: ${h}` };
    seen.add(h);
    col.set(h, i);
  }

  for (const req of REQUIRED_HEADERS) {
    if (!col.has(req)) {
      return { ok: false, message: `Missing required column: ${req}` };
    }
  }

  const allowed = new Set<string>([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]);
  const unknown: string[] = [];
  for (const h of col.keys()) {
    if (!allowed.has(h)) unknown.push(h);
  }
  if (unknown.length) {
    console.warn(`Warning: ignoring unknown columns: ${unknown.join(', ')}`);
  }

  return { ok: true, col };
}

async function assertCompanyExists(supabase: SupabaseClient, companyId: string): Promise<void> {
  const { data, error } = await supabase.from('caicos_companies').select('id').eq('id', companyId).maybeSingle();
  if (error) throw new Error(`Failed to verify company: ${error.message}`);
  if (!data) throw new Error(`No company found for id ${companyId}`);
}

async function insertBatches(
  supabase: SupabaseClient,
  companyId: string,
  rows: PropertyRow[],
  batchSize: number,
): Promise<void> {
  const payloads = rows.map((r) => ({
    company_id: companyId,
    customer_name: r.customer_name,
    address: r.address,
    customer_email: r.customer_email,
    customer_phone: r.customer_phone,
    city: r.city,
    state: r.state,
    zip: r.zip,
    gate_code: r.gate_code,
    pool_type: r.pool_type,
    pool_surface: r.pool_surface,
    equipment_notes: r.equipment_notes,
    notes: r.notes,
    is_active: r.is_active,
  }));

  for (let i = 0; i < payloads.length; i += batchSize) {
    const batch = payloads.slice(i, i + batchSize);
    const { error } = await supabase.from('caicos_properties').insert(batch);
    if (error) {
      throw new Error(`Insert failed at row offset ${i + 1}: ${error.message}`);
    }
    console.log(`Inserted rows ${i + 1}–${i + batch.length} of ${payloads.length}`);
  }
}

async function main(): Promise<void> {
  const { file, companyId, insert } = parseArgs();

  if (!file || !companyId) {
    console.error(`
Usage:
  npm run script:import-properties -- --file <path-to.csv> --company <company-uuid>
    Validate CSV only (default; no database access).

  npm run script:import-properties -- --file <path-to.csv> --company <company-uuid> --insert
  npm run script:import-properties -- <path-to.csv> <company-uuid> --insert
    After validation, insert rows (requires .env.local with Supabase service role).

Options:
  --insert   Perform inserts after successful validation.
`);
    process.exit(1);
  }

  if (!UUID_RE.test(companyId)) {
    console.error(`Invalid company UUID: ${companyId}`);
    process.exit(1);
  }

  const resolved = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolved, 'utf8');
  const table = parseCsv(content);
  if (table.length < 2) {
    console.error('CSV must include a header row and at least one data row.');
    process.exit(1);
  }

  const headerMap = buildColumnMap(table[0]);
  if (!headerMap.ok) {
    console.error(headerMap.message);
    process.exit(1);
  }
  const { col } = headerMap;

  const validationErrors: string[] = [];
  const properties: PropertyRow[] = [];

  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const lineLabel = r + 1;
    if (cells.every((c) => c.trim() === '')) continue;

    const result = rowToProperty(cells, col);
    if (!result.ok) {
      for (const e of result.errors) {
        validationErrors.push(`Row ${lineLabel} (CSV line ${lineLabel}): ${e}`);
      }
      continue;
    }
    properties.push(result.row);
  }

  if (validationErrors.length) {
    console.error('Validation failed:\n');
    for (const msg of validationErrors) console.error(`  • ${msg}`);
    process.exit(1);
  }

  if (properties.length === 0) {
    console.error('No data rows to import after validation.');
    process.exit(1);
  }

  console.log(`Validated ${properties.length} row(s) from ${resolved}`);

  if (!insert) {
    console.log('Validate-only (default): no database calls. Pass --insert to write rows after validation.');
    process.exit(0);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await assertCompanyExists(supabase, companyId);

  await insertBatches(supabase, companyId, properties, 100);
  console.log(`Done. Imported ${properties.length} properties into company ${companyId}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
