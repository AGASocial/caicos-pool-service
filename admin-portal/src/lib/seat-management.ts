/**
 * Seat Management Utility
 * Manages technician seat limits and enforcement based on subscription
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface SeatInfo {
  subscribed: number; // Number of paid seats
  active: number; // Number of active technicians
  available: number; // Remaining seats (subscribed - active)
  isOverLimit: boolean; // True if active > subscribed
}

/**
 * Get seat information for a user's subscription
 */
export async function getSeatInfo(
  supabase: SupabaseClient,
  userId: string
): Promise<SeatInfo> {
  // Get subscription quantity
  const { data: subscription } = await supabase
    .from('cadenza_billing_subscriptions')
    .select('quantity, plan_id, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isFree = !subscription || subscription.plan_id === 'plan_free';
  const subscribed = isFree ? 0 : (subscription?.quantity || 1);

  // Get active technician count for this user's company
  const { data: profile } = await supabase
    .from('cadenza_profiles')
    .select('company_id')
    .eq('id', userId)
    .single();

  if (!profile) {
    return {
      subscribed,
      active: 0,
      available: subscribed,
      isOverLimit: false,
    };
  }

  const { count } = await supabase
    .from('cadenza_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', profile.company_id)
    .eq('role', 'technician')
    .eq('is_active', true);

  const active = count || 0;
  const available = Math.max(0, subscribed - active);
  const isOverLimit = !isFree && active > subscribed;

  return {
    subscribed,
    active,
    available,
    isOverLimit,
  };
}

/**
 * Check if a user can add more technicians
 */
export async function canAddTechnician(
  supabase: SupabaseClient,
  userId: string
): Promise<{ canAdd: boolean; reason?: string }> {
  const seatInfo = await getSeatInfo(supabase, userId);

  // Free plan has no enforcement
  if (seatInfo.subscribed === 0) {
    return { canAdd: true };
  }

  // Check if already over limit
  if (seatInfo.isOverLimit) {
    return {
      canAdd: false,
      reason: 'Already over seat limit. Please upgrade your plan or remove inactive technicians.',
    };
  }

  // Check if at limit
  if (seatInfo.available === 0) {
    return {
      canAdd: false,
      reason: 'No available seats. Please upgrade your plan to add more technicians.',
    };
  }

  return { canAdd: true };
}

/**
 * Validate technician count before invite
 */
export async function validateTechnicianInvite(
  supabase: SupabaseClient,
  userId: string,
  role: string
): Promise<{ valid: boolean; error?: string }> {
  // Only enforce for technician role
  if (role !== 'technician') {
    return { valid: true };
  }

  const { canAdd, reason } = await canAddTechnician(supabase, userId);

  if (!canAdd) {
    return { valid: false, error: reason };
  }

  return { valid: true };
}
