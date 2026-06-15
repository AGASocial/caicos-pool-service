/**
 * Subscription limits and feature gating utilities
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { isPaidSubscriptionEffective } from '@/lib/billing/subscription-utils';

export interface SubscriptionLimits {
  maxStorageMb: number;
  maxFileSizeMb: number;
  prioritySupport: boolean;
  advancedSecurity: boolean;
}

export interface UsageStats {
  storageUsedMb: number;
}

function storageGbToMb(features: Record<string, unknown>): number {
  const storageGb = features.storage_gb as number | undefined;
  if (storageGb != null && storageGb > 0) return storageGb * 1024;
  return (features.max_storage_mb as number) || 50;
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
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription || !subscription.plan) {
    const { data: freePlan } = await supabase
      .from('cadenza_billing_plans')
      .select('*')
      .eq('id', 'plan_free')
      .single();

    if (freePlan) {
      const features = freePlan.features as Record<string, unknown>;
      return {
        maxStorageMb: storageGbToMb(features),
        maxFileSizeMb: (features.max_file_size_mb as number) || 10,
        prioritySupport: false,
        advancedSecurity: false,
      };
    }

    return getFreeTrialLimits();
  }

  const effective = isPaidSubscriptionEffective({
    planId: subscription.plan_id as string,
    status: subscription.status as string,
    currentPeriodEnd: subscription.current_period_end as string | null,
  });

  if (!effective) {
    const { data: freePlan } = await supabase
      .from('cadenza_billing_plans')
      .select('*')
      .eq('id', 'plan_free')
      .single();

    if (freePlan) {
      const features = freePlan.features as Record<string, unknown>;
      return {
        maxStorageMb: storageGbToMb(features),
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
    maxStorageMb: storageGbToMb(features),
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
  return {
    storageUsedMb: 0,
  };
}

/**
 * Check if user's subscription is active and within billing period
 */
export async function hasActiveSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: subscription } = await supabase
    .from('cadenza_billing_subscriptions')
    .select('plan_id, status, current_period_end')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) return false;
  return isPaidSubscriptionEffective({
    planId: subscription.plan_id as string,
    status: subscription.status as string,
    currentPeriodEnd: subscription.current_period_end as string | null,
  });
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
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const [limits, usage] = await Promise.all([
    getSubscriptionLimits(supabase, userId),
    getUsageStats(supabase, userId),
  ]);

  const effective = subscription
    ? isPaidSubscriptionEffective({
        planId: subscription.plan_id as string,
        status: subscription.status as string,
        currentPeriodEnd: subscription.current_period_end as string | null,
      })
    : false;

  if (!subscription || !effective) {
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
