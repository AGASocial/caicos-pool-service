/** Photo history (pool page) — pure mapping helpers. */

export type HistoryPhoto = {
  id: string;
  caption: string | null;
  photo_type: string | null;
  created_at: string;
  archived: boolean;
  url: string | null;
};

export type HistoryVisit = {
  jobId: string;
  reportId: string | null;
  scheduledDate: string;
  status: string;
  technicianName: string | null;
  completedAt: string | null;
  notes: string | null;
  photos: HistoryPhoto[];
};

type RawPhoto = {
  id: string;
  storage_path: string | null;
  caption?: string | null;
  photo_type?: string | null;
  created_at: string;
  is_deleted?: boolean | null;
  storage_tier?: string | null;
  archived_at?: string | null;
};
type RawReport = {
  id: string;
  departure_time?: string | null;
  notes?: string | null;
  is_deleted?: boolean | null;
  photos?: RawPhoto[] | null;
};
export type RawHistoryJob = {
  id: string;
  scheduled_date: string;
  status: string;
  technician?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  reports?: RawReport[] | null;
};

export function isArchivedPhoto(p: RawPhoto): boolean {
  return p.storage_tier === 'archive' || !!p.archived_at || !p.storage_path;
}

/** Map jobs → visits; returns visits plus the hot storage paths that need signing (in order). */
export function mapHistory(jobs: RawHistoryJob[]): { visits: HistoryVisit[]; pathsToSign: string[]; photoRefs: HistoryPhoto[] } {
  const pathsToSign: string[] = [];
  const photoRefs: HistoryPhoto[] = [];
  const visits = jobs.map((j) => {
    const tech = Array.isArray(j.technician) ? j.technician[0] : j.technician;
    const report = (j.reports ?? []).find((r) => !r.is_deleted) ?? null;
    const photos = (report?.photos ?? [])
      .filter((p) => !p.is_deleted)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => {
        const archived = isArchivedPhoto(p);
        const hp: HistoryPhoto = {
          id: p.id,
          caption: p.caption ?? null,
          photo_type: p.photo_type ?? null,
          created_at: p.created_at,
          archived,
          url: null,
        };
        if (!archived && p.storage_path) {
          pathsToSign.push(p.storage_path);
          photoRefs.push(hp);
        }
        return hp;
      });
    return {
      jobId: j.id,
      reportId: report?.id ?? null,
      scheduledDate: j.scheduled_date,
      status: j.status,
      technicianName: tech?.full_name ?? null,
      completedAt: report?.departure_time ?? null,
      notes: report?.notes ?? null,
      photos,
    };
  });
  return { visits, pathsToSign, photoRefs };
}

export function parsePaging(sp: URLSearchParams): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(sp.get('page')) || 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(sp.get('page_size')) || 10)));
  return { page, pageSize };
}
