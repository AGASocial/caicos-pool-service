import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import {
  buildLastServiceResponse,
  fetchLastService,
  loadSharedFlag,
  LastServiceSchemaPendingError,
} from '@/lib/last-service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/properties/[id]/last-service?job_id=optional — compact summary of the most recent
 * completed visit at a shared property (same company only). `last_service` is null unless the
 * property is shared. A property outside the caller's company answers 404.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: propertyId } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobId = new URL(request.url).searchParams.get('job_id');
  if (!UUID_RE.test(propertyId) || (jobId != null && !UUID_RE.test(jobId))) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  }

  const client = supabase as unknown as SupabaseClient;
  const { data: profile } = await client
    .from('cadenza_profiles')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const companyId = String(profile.company_id);

  try {
    const isShared = await loadSharedFlag(client, companyId, propertyId);
    if (isShared === null) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    const lastService = isShared ? await fetchLastService(client, companyId, propertyId, jobId) : null;
    return NextResponse.json(buildLastServiceResponse(isShared, lastService));
  } catch (error) {
    if (error instanceof LastServiceSchemaPendingError) {
      return NextResponse.json({ error: error.message, code: 'SCHEMA_PENDING' }, { status: 503 });
    }
    console.error('GET /api/properties/[id]/last-service failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to load last service' }, { status: 500 });
  }
}
