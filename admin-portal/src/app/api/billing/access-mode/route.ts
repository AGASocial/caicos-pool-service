/**
 * GET /api/billing/access-mode
 * Returns company access mode for the authenticated user (full | read_only).
 */

import { createClient } from '@supabase/supabase-js';
import {
  getAuthenticatedUserId,
  errorResponse,
  successResponse,
} from '@/lib/billing/server';
import {
  FREE_PLAN_EXPIRED,
  getCompanyAccessMode,
} from '@/lib/company-access';

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return errorResponse('Server configuration error', 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const access = await getCompanyAccessMode(admin, userId);

    return successResponse({
      accessMode: access.mode,
      code: access.mode === 'read_only' ? FREE_PLAN_EXPIRED : undefined,
      expiryDate: access.expiryDate?.toISOString() ?? null,
      daysRemaining: access.daysRemaining ?? null,
    });
  } catch (error) {
    console.error('Error fetching access mode:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch access mode',
      500,
    );
  }
}
