/**
 * Cursor pagination contract for list API endpoints (US-B-001).
 */

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

export interface PaginationMeta {
  limit: number;
  cursor: string | null;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function parsePaginationParams(searchParams: URLSearchParams): {
  limit: number;
  cursor: string | null;
} {
  const rawLimit = Number(searchParams.get('limit') ?? DEFAULT_PAGE_LIMIT);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.floor(rawLimit)), MAX_PAGE_LIMIT)
    : DEFAULT_PAGE_LIMIT;
  const cursor = searchParams.get('cursor');
  return { limit, cursor: cursor && cursor.trim() ? cursor.trim() : null };
}

/** Encode cursor from a row with id + sort key (scheduled_date for jobs, customer_name for properties). */
export function encodeCursor(id: string, sortKey: string): string {
  return Buffer.from(JSON.stringify({ id, sortKey }), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): { id: string; sortKey: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      id?: string;
      sortKey?: string;
    };
    if (typeof parsed.id === 'string' && typeof parsed.sortKey === 'string') {
      return { id: parsed.id, sortKey: parsed.sortKey };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildPaginatedResponse<T extends { id: string }>(
  rows: T[],
  limit: number,
  getSortKey: (row: T) => string,
): PaginatedResponse<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];
  return {
    data,
    pagination: {
      limit,
      cursor: null,
      hasMore,
      nextCursor: hasMore && last ? encodeCursor(last.id, getSortKey(last)) : null,
    },
  };
}

/** Extract rows from paginated API response (supports legacy bare arrays). */
export function unwrapPaginated<T>(response: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(response)) return response;
  return response.data;
}
