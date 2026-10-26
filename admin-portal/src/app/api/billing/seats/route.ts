/**
 * Seat Management API
 * GET /api/billing/seats - Get seat information
 */

import { NextRequest } from 'next/server';
import {
  getAuthenticatedUserId,
  errorResponse,
  successResponse,
} from '@/lib/billing/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import { getSeatInfo } from '@/lib/seat-management';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    const { supabase } = await createAuthenticatedRouteClient();
    const seatInfo = await getSeatInfo(supabase, userId);

    return successResponse(seatInfo);
  } catch (error) {
    console.error('Error fetching seat info:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch seat information',
      500
    );
  }
}
