import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/3gpp',
]);

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'video/mp4':
      return 'mp4';
    case 'video/quicktime':
      return 'mov';
    case 'video/x-msvideo':
      return 'avi';
    case 'video/webm':
      return 'webm';
    case 'video/3gpp':
      return '3gp';
    default:
      return 'bin';
  }
}

/**
 * POST /api/storage/presign
 * Returns a signed upload URL for the report-photos bucket, scoped to the user's company.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const propertyId = body?.property_id;
    const scheduledDate =
      typeof body?.scheduled_date === 'string'
        ? body.scheduled_date.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const contentType =
      typeof body?.content_type === 'string' ? body.content_type : 'image/jpeg';

    if (!propertyId || typeof propertyId !== 'string') {
      return NextResponse.json({ error: 'property_id is required' }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      return NextResponse.json(
        { error: 'scheduled_date must be YYYY-MM-DD' },
        { status: 400 }
      );
    }

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Unsupported content_type' }, { status: 400 });
    }

    const client = supabase as unknown as CadenzaSupabaseClient;

    const { data: profile, error: profileError } = await client
      .from('cadenza_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const companyId = profile.company_id as string;

    const { data: property, error: propertyError } = await client
      .from('cadenza_properties')
      .select('id')
      .eq('id', propertyId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (propertyError) {
      return NextResponse.json({ error: propertyError.message }, { status: 500 });
    }

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const ext = extensionForContentType(contentType);
    const objectPath = `${companyId}/${scheduledDate}/${propertyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from('report-photos')
      .createSignedUploadUrl(objectPath, { upsert: false });

    if (error || !data) {
      console.error('POST /api/storage/presign error:', error);
      return NextResponse.json(
        { error: error?.message ?? 'Failed to create signed upload URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path ?? objectPath,
      contentType,
    });
  } catch (e) {
    console.error('POST /api/storage/presign error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
