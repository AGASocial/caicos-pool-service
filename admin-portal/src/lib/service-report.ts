/** Mirrors technician-app/lib/visitForm.ts issue keys. */

import type { SupabaseClient } from '@supabase/supabase-js';

export type IssueCategoryKey =
  | 'motor'
  | 'filter'
  | 'circulation'
  | 'timer'
  | 'chemistry'
  | 'other';

export const ISSUE_CATEGORY_KEYS: IssueCategoryKey[] = [
  'motor',
  'filter',
  'circulation',
  'timer',
  'chemistry',
  'other',
];

export type ServiceReport = {
  id: string;
  created_at: string;
  issue_categories: string[] | null;
  cant_service_reasons: string[] | null;
  notes: string | null;
  follow_up_needed: boolean | null;
  follow_up_notes: string | null;
  follow_up_status: 'open' | 'resolved' | null;
  other_chemicals: string | null;
  cleaned_filter: boolean | null;
  vacuumed: boolean | null;
  pump_ok: boolean | null;
  filter_ok: boolean | null;
  heater_ok: boolean | null;
  cleaner_ok: boolean | null;
  ph_level: number | null;
  chlorine_level: number | null;
  alkalinity: number | null;
  calcium_hardness: number | null;
  cyanuric_acid: number | null;
  salt_level: number | null;
  water_temp_f: number | null;
};

export const REPORT_SELECT = `
  id,
  created_at,
  issue_categories,
  cant_service_reasons,
  notes,
  follow_up_needed,
  follow_up_notes,
  follow_up_status,
  other_chemicals,
  cleaned_filter,
  vacuumed,
  pump_ok,
  filter_ok,
  heater_ok,
  cleaner_ok,
  ph_level,
  chlorine_level,
  alkalinity,
  calcium_hardness,
  cyanuric_acid,
  salt_level,
  water_temp_f
`;

/** Report row plus nested photos — one PostgREST round trip. */
export const REPORT_WITH_PHOTOS_SELECT = `
  id,
  created_at,
  issue_categories,
  cant_service_reasons,
  notes,
  follow_up_needed,
  follow_up_notes,
  follow_up_status,
  other_chemicals,
  cleaned_filter,
  vacuumed,
  pump_ok,
  filter_ok,
  heater_ok,
  cleaner_ok,
  ph_level,
  chlorine_level,
  alkalinity,
  calcium_hardness,
  cyanuric_acid,
  salt_level,
  water_temp_f,
  report_photos:cadenza_report_photos (
    id,
    storage_path,
    caption,
    photo_type,
    created_at
  )
`;

export type ReportPhoto = {
  id: string;
  storage_path: string;
  caption: string | null;
  photo_type: string | null;
  created_at: string;
  url: string | null;
};

const SIGNED_PHOTO_URL_TTL_SEC = 3600;

export function mapReportRow(row: Record<string, unknown>): ServiceReport {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    issue_categories: normalizeIssueCategories(row.issue_categories),
    cant_service_reasons: normalizeCantServiceReasons(row.cant_service_reasons),
    notes: row.notes != null ? String(row.notes) : null,
    follow_up_needed: row.follow_up_needed != null ? Boolean(row.follow_up_needed) : null,
    follow_up_notes: row.follow_up_notes != null ? String(row.follow_up_notes) : null,
    follow_up_status:
      row.follow_up_status === 'resolved' ? 'resolved' : row.follow_up_status === 'open' ? 'open' : null,
    other_chemicals: row.other_chemicals != null ? String(row.other_chemicals) : null,
    cleaned_filter: row.cleaned_filter != null ? Boolean(row.cleaned_filter) : null,
    vacuumed: row.vacuumed != null ? Boolean(row.vacuumed) : null,
    pump_ok: row.pump_ok != null ? Boolean(row.pump_ok) : null,
    filter_ok: row.filter_ok != null ? Boolean(row.filter_ok) : null,
    heater_ok: row.heater_ok != null ? Boolean(row.heater_ok) : null,
    cleaner_ok: row.cleaner_ok != null ? Boolean(row.cleaner_ok) : null,
    ph_level: row.ph_level != null ? Number(row.ph_level) : null,
    chlorine_level: row.chlorine_level != null ? Number(row.chlorine_level) : null,
    alkalinity: row.alkalinity != null ? Number(row.alkalinity) : null,
    calcium_hardness: row.calcium_hardness != null ? Number(row.calcium_hardness) : null,
    cyanuric_acid: row.cyanuric_acid != null ? Number(row.cyanuric_acid) : null,
    salt_level: row.salt_level != null ? Number(row.salt_level) : null,
    water_temp_f: row.water_temp_f != null ? Number(row.water_temp_f) : null,
  };
}

function mapPhotoRow(row: Record<string, unknown>): Omit<ReportPhoto, 'url'> {
  return {
    id: String(row.id),
    storage_path: String(row.storage_path),
    caption: row.caption != null ? String(row.caption) : null,
    photo_type: row.photo_type != null ? String(row.photo_type) : null,
    created_at: String(row.created_at),
  };
}

/** Batch-sign private storage paths (RLS-scoped route client). */
export async function attachSignedPhotoUrls(
  supabase: SupabaseClient,
  photos: Omit<ReportPhoto, 'url'>[],
): Promise<ReportPhoto[]> {
  if (!photos.length) return [];

  const paths = photos.map((photo) => photo.storage_path);
  const { data: signedData } = await supabase.storage
    .from('report-photos')
    .createSignedUrls(paths, SIGNED_PHOTO_URL_TTL_SEC);

  return photos.map((photo, index) => ({
    ...photo,
    url: signedData?.[index]?.signedUrl ?? null,
  }));
}

export function extractReportPhotos(raw: unknown): Omit<ReportPhoto, 'url'>[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => mapPhotoRow(row as Record<string, unknown>));
}

export function normalizeIssueCategories(raw: unknown): IssueCategoryKey[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is IssueCategoryKey =>
    typeof k === 'string' && ISSUE_CATEGORY_KEYS.includes(k as IssueCategoryKey),
  );
}

export function normalizeCantServiceReasons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is string => typeof k === 'string' && k.length > 0);
}

export function hasCantServiceReasons(report: ServiceReport): boolean {
  return (report.cant_service_reasons?.length ?? 0) > 0;
}

export function hasVisitExtras(report: ServiceReport): boolean {
  return Boolean(report.cleaned_filter || report.vacuumed || report.other_chemicals);
}

export function hasChemicalReadings(report: ServiceReport): boolean {
  return [
    report.ph_level,
    report.chlorine_level,
    report.alkalinity,
    report.calcium_hardness,
    report.cyanuric_acid,
    report.salt_level,
    report.water_temp_f,
  ].some((v) => v != null);
}

export function hasEquipmentFlags(report: ServiceReport): boolean {
  return [report.pump_ok, report.filter_ok, report.heater_ok, report.cleaner_ok].some(
    (v) => v === false,
  );
}
