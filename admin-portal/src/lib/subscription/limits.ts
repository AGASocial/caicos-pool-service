/**
 * Subscription limits and feature gating utilities
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface SubscriptionLimits {
  maxStorageMb: number;
  maxFileSizeMb: number;
  prioritySupport: boolean;
  advancedSecurity: boolean;
}

export interface UsageStats {
  storageUsedMb: number;
}

/**
 * Get user's subscription limits based on their active subscription
 */
export async function getSubscriptionLimits(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionLimits> {
  const { data: subscription } = await supabase
    .from('cadenza_billing_subscriptions')
    .select(`
      *,
      plan:cadenza_billing_plans(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!subscription || !subscription.plan) {
    const { data: freePlan } = await supabase
      .from('cadenza_billing_plans')
      .select('*')
      .eq('id', 'plan_free')
      .single();

    if (freePlan) {
      const features = freePlan.features as Record<string, unknown>;
      return {
        maxStorageMb: (features.max_storage_mb as number) || 50,
        maxFileSizeMb: (features.max_file_size_mb as number) || 10,
        prioritySupport: false,
        advancedSecurity: false,
      };
    }

    return getFreeTrialLimits();
  }

  const plan = Array.isArray(subscription.plan) ? subscription.plan[0] : subscription.plan;
  const features = plan.features as Record<string, unknown>;

  return {
    maxStorageMb: (features.max_storage_mb as number) || 100,
    maxFileSizeMb: (features.max_file_size_mb as number) || 10,
    prioritySupport: (features.priority_support as boolean) || false,
    advancedSecurity: (features.advanced_security as boolean) || false,
  };
}

/**
 * Get free tier/trial limits (fallback if Free plan not in database)
 */
export function getFreeTrialLimits(): SubscriptionLimits {
  return {
    maxStorageMb: 50,
    maxFileSizeMb: 10,
    prioritySupport: false,
    advancedSecurity: false,
  };
}

/**
 * Get user's current usage statistics
 */
export async function getUsageStats(
  _supabase: SupabaseClient,
  _userId: string
): Promise<UsageStats> {
  // Storage tracking can be wired to cadenza file usage when implemented
  return {
    storageUsedMb: 0,
  };
}

/**
 * Check if user's subscription is active
 */
export async function hasActiveSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: subscription } = await supabase
    .from('cadenza_billing_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  return !!subscription;
}

/**
 * Get subscription status for user
 */
export async function getSubscriptionStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  hasSubscription: boolean;
  status?: string;
  planName?: string;
  limits: SubscriptionLimits;
  usage: UsageStats;
}> {
  const { data: subscription } = await supabase
    .from('cadenza_billing_subscriptions')
    .select(`
      *,
      plan:cadenza_billing_plans(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  const [limits, usage] = await Promise.all([
    getSubscriptionLimits(supabase, userId),
    getUsageStats(supabase, userId),
  ]);

  if (!subscription) {
    return {
      hasSubscription: false,
      limits,
      usage,
    };
  }

  const plan = Array.isArray(subscription.plan) ? subscription.plan[0] : subscription.plan;

  return {
    hasSubscription: true,
    status: subscription.status,
    planName: plan?.name,
    limits,
    usage,
  };
}
