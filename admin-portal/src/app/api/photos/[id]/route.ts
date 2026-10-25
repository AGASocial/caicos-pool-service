/**
 * GET /api/photos/[id] - Get presigned URL for a photo (hot or archived)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, user } = await createAuthenticatedRouteClient();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const photoId = params.id;

    // Get photo record
    const client = supabase as unknown as CadenzaSupabaseClient;
    const { data: photo, error: photoError } = await client
      .from('cadenza_report_photos')
      .select('id, company_id, storage_tier, file_path, archive_key')
      .eq('id', photoId)
      .single();

    if (photoError || !photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify user belongs to photo's company (RLS should handle this, but double-check)
    const { data: profile } = await client
      .from('cadenza_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.company_id !== photo.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (photo.storage_tier === 'hot') {
      // Photo is in Supabase Storage - get public URL or presigned URL
      const { data } = await supabase.storage
        .from('report-photos')
        .createSignedUrl(photo.file_path, 3600); // 1 hour

      if (data?.signedUrl) {
        return NextResponse.json({
          url: data.signedUrl,
          storage_tier: 'hot',
          expires_in: 3600,
        });
      }

      return NextResponse.json({ error: 'Failed to get photo URL' }, { status: 500 });
    } else if (photo.storage_tier === 'archive' && photo.archive_key) {
      // Photo is in R2 - generate presigned URL
      if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
        return NextResponse.json({ error: 'R2 not configured' }, { status: 500 });
      }

      const r2Client = new S3Client({
        endpoint: process.env.R2_ENDPOINT,
        region: 'auto',
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });

      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: photo.archive_key,
      });

      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

      return NextResponse.json({
        url: signedUrl,
        storage_tier: 'archive',
        expires_in: 3600,
      });
    }

    return NextResponse.json({ error: 'Invalid storage tier' }, { status: 500 });
  } catch (error) {
    console.error('Error getting photo URL:', error);
    return NextResponse.json(
      { error: 'Failed to get photo URL' },
      { status: 500 }
    );
  }
}
