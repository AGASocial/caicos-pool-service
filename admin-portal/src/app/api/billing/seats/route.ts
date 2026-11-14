/**
 * Seat Management API
 * GET /api/billing/seats - Get seat information (incl. pending deactivations)
 */

import {
  getAuthenticatedUserId,
  errorResponse,
  successResponse,
} from '@/lib/billing/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import { getSeatInfo, processDueTechnicianDeactivations } from '@/lib/seat-management';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return errorResponse('Unauthorized', 401);
    }

    // Opportunistically apply due deactivations (cron is primary).
    try {
      await processDueTechnicianDeactivations(supabaseAdmin as never);
    } catch (e) {
      console.warn('processDueTechnicianDeactivations (seats GET) failed:', e);
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
