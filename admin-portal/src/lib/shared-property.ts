/**
 * KAN-155: `is_shared` handling for the property create/update APIs.
 * "Shared" means visited by more than one technician of the same company. Only office roles may
 * change it; the existing company-scoped RLS on cadenza_properties still applies on top.
 */
import { OFFICE_ROLES } from '@/lib/open-issues-review';

export type SharedFlagResult =
  | { ok: true; provided: false }
  | { ok: true; provided: true; value: boolean }
  | { ok: false; status: 400 | 403; error: string };

/**
 * Reads `is_shared` from a request body. Absent => not provided (leave the column untouched).
 * Present => must be a boolean and the caller must be an office role.
 */
export function parseIsSharedInput(body: unknown, role: string | null | undefined): SharedFlagResult {
  const raw = (body as { is_shared?: unknown } | null)?.is_shared;
  if (raw === undefined) return { ok: true, provided: false };
  if (typeof raw !== 'boolean') {
    return { ok: false, status: 400, error: 'is_shared must be a boolean' };
  }
  if (!role || !OFFICE_ROLES.has(role)) {
    return { ok: false, status: 403, error: 'Only office roles can change is_shared' };
  }
  return { ok: true, provided: true, value: raw };
}
