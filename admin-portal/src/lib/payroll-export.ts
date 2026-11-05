/**
 * Payroll export — per-technician completed pools for a date range.
 * Pure helpers (no I/O) so they can be unit-tested; the route does the queries.
 */

export type PayrollRow = {
  technicianId: string;
  technicianName: string;
  date: string; // scheduled_date (YYYY-MM-DD)
  customer: string;
  address: string;
  completedAt: string | null; // ISO timestamp (report departure_time, else job updated_at)
};

export type PayrollTechSummary = {
  technicianId: string;
  fullName: string;
  completed: number;
};

type JobRow = {
  id: string;
  scheduled_date: string;
  updated_at?: string | null;
  technician_id: string | null;
  technician?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  property?:
    | { customer_name?: string | null; address?: string | null; city?: string | null; state?: string | null; zip?: string | null }
    | { customer_name?: string | null; address?: string | null; city?: string | null; state?: string | null; zip?: string | null }[]
    | null;
  reports?: { departure_time?: string | null; is_deleted?: boolean | null }[] | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export function mapPayrollRows(jobs: JobRow[]): PayrollRow[] {
  const rows = jobs
    .filter((j) => j.technician_id)
    .map((j) => {
      const prop = one(j.property);
      const tech = one(j.technician);
      const report = (j.reports ?? []).find((r) => !r.is_deleted && r.departure_time);
      const addr = [prop?.address, prop?.city, [prop?.state, prop?.zip].filter(Boolean).join(' ')]
        .filter((s) => s && String(s).trim())
        .join(', ');
      return {
        technicianId: j.technician_id as string,
        technicianName: tech?.full_name?.trim() || 'Unknown',
        date: j.scheduled_date,
        customer: prop?.customer_name ?? '',
        address: addr,
        completedAt: report?.departure_time ?? j.updated_at ?? null,
      };
    });
  rows.sort(
    (a, b) =>
      a.technicianName.localeCompare(b.technicianName) ||
      a.date.localeCompare(b.date) ||
      (a.completedAt ?? '').localeCompare(b.completedAt ?? ''),
  );
  return rows;
}

/** Format an ISO timestamp as local time "YYYY-MM-DD HH:mm" in the given IANA zone. */
export function formatCompletedTime(iso: string | null, timeZone = 'America/Chicago'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}`;
}

export function csvEscape(value: unknown): string {
  let s = value == null ? '' : String(value);
  // Neutralize spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export type PayrollLocale = 'en' | 'es';

const CSV_LABELS: Record<PayrollLocale, { header: string[]; summary: string[] }> = {
  en: {
    header: ['Technician', 'Date', 'Customer', 'Address', 'Completed Time'],
    summary: ['Technician', 'Completed Pools'],
  },
  es: {
    header: ['Técnico', 'Fecha', 'Cliente', 'Dirección', 'Hora de finalización'],
    summary: ['Técnico', 'Piscinas completadas'],
  },
};

export function payrollLocale(value: string | null | undefined): PayrollLocale {
  return value && value.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export const PAYROLL_CSV_HEADER = CSV_LABELS.en.header;
export const UTF8_BOM = '\uFEFF';

export type PayrollCsvOptions = {
  timeZone?: string;
  locale?: PayrollLocale;
  /** Append a blank line + per-technician totals block. Off by default so that
   *  the number of data rows equals the "completed" count on the Reports screen. */
  includeSummary?: boolean;
};

/** Excel-compatible CSV (UTF-8 BOM + CRLF): header + one row per completed job. */
export function buildPayrollCsv(
  rows: PayrollRow[],
  summary: PayrollTechSummary[],
  opts: PayrollCsvOptions | string = {},
): string {
  const o: PayrollCsvOptions = typeof opts === 'string' ? { timeZone: opts } : opts;
  const timeZone = o.timeZone ?? 'America/Chicago';
  const labels = CSV_LABELS[o.locale ?? 'en'];
  const lines: string[] = [labels.header.map(csvEscape).join(',')];
  for (const r of rows) {
    lines.push(
      [r.technicianName, r.date, r.customer, r.address, formatCompletedTime(r.completedAt, timeZone)]
        .map(csvEscape)
        .join(','),
    );
  }
  if (o.includeSummary && summary.length) {
    lines.push('');
    lines.push(labels.summary.map(csvEscape).join(','));
    for (const s of summary) lines.push([s.fullName, s.completed].map(csvEscape).join(','));
  }
  return UTF8_BOM + lines.join('\r\n') + '\r\n';
}

/** Count of completed, technician-assigned jobs according to get_job_report_stats. */
export function statsCompletedTotal(byTechnician: { completed: number }[] | null | undefined): number {
  return (byTechnician ?? []).reduce((n, t) => n + (t.completed || 0), 0);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isValidDate(s: string | null): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  return !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
}
