/**
 * POST /api/photos/upload-check
 * Check if user can upload more photos for a service job (enforce plan limits)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { canUploadPhotos } from '@/lib/plan-limits';

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await createAuthenticatedRouteClient();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serviceJobId } = await request.json();
    if (!serviceJobId) {
      return NextResponse.json({ error: 'Service job ID required' }, { status: 400 });
    }

    const client = supabase as unknown as CadenzaSupabaseClient;

    // Check plan limits
    const result = await canUploadPhotos(supabase, user.id, serviceJobId);

    if (!result.allowed) {
      return NextResponse.json(
        {
          allowed: false,
          error: result.reason,
          limit: result.limit,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      allowed: true,
      limit: result.limit,
    });
  } catch (error) {
    console.error('Photo upload check error:', error);
    return NextResponse.json(
      { error: 'Failed to check photo limits' },
      { status: 500 }
    );
  }
}
