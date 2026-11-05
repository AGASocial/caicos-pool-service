/**
 * GET /api/properties/[id]/photo-history?page=1&page_size=10
 * Visits (newest first) with their report photos; hot photos get signed URLs from
 * the report-photos bucket, archived photos are returned with url=null + archived=true.
 * RLS-scoped route client + explicit company_id filter.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withApiTiming } from '@/lib/api-timing';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { mapHistory, parsePaging, type RawHistoryJob } from '@/lib/photo-history';

const SIGNED_TTL = 3600;
const HISTORY_SELECT = `
  id, scheduled_date, status,
  technician:cadenza_profiles!technician_id ( full_name ),
  reports:cadenza_service_reports (
    id, departure_time, notes, is_deleted,
    photos:cadenza_report_photos ( id, storage_path, caption, photo_type, created_at, is_deleted, storage_tier, archived_at )
  )
`;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiTiming('GET /api/properties/[id]/photo-history', async () => {
    const { id } = await params;
    const { supabase, user } = await createAuthenticatedRouteClient();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const client = supabase as unknown as CadenzaSupabaseClient;

    const { data: profile } = await client
      .from('cadenza_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();
    if (!profile?.company_id) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    const companyId = profile.company_id as string;

    const { data: prop } = await client
      .from('cadenza_properties')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (!prop) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { page, pageSize } = parsePaging(new URL(request.url).searchParams);
    const from = (page - 1) * pageSize;
    const { data, error, count } = await client
      .from('cadenza_service_jobs')
      .select(HISTORY_SELECT, { count: 'exact' })
      .eq('company_id', companyId)
      .eq('property_id', id)
      .eq('is_deleted', false)
      .in('status', ['completed', 'skipped'])
      .order('scheduled_date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error('photo-history error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { visits, pathsToSign, photoRefs } = mapHistory((data ?? []) as unknown as RawHistoryJob[]);
    if (pathsToSign.length) {
      const { data: signed } = await supabase.storage.from('report-photos').createSignedUrls(pathsToSign, SIGNED_TTL);
      photoRefs.forEach((p, i) => {
        p.url = signed?.[i]?.signedUrl ?? null;
      });
    }
    const total = count ?? visits.length;
    return NextResponse.json({ visits, page, pageSize, total, hasMore: from + visits.length < total });
  });
}
