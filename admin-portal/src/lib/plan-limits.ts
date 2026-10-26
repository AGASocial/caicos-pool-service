/**
 * Plan Limits Utility
 * Centralized enforcement of billing plan feature limits
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getBillingService } from './billing/server';

export interface PlanLimits {
  admin_users: number;
  max_technicians: number;
  max_photos_per_service: number;
  photo_retention_days: number;
  photo_hot_storage_days: number;
  photo_archive_provider: string | null;
  report_history_days: number;
  plan_duration_days: number | null;
  video_per_service: boolean;
  max_video_seconds: number;
  data_export: boolean;
  advanced_analytics: boolean;
  storage_gb: number;
  max_properties: number;
  max_routes: number;
  max_service_jobs: number;
}

/**
 * Get effective plan limits for a user
 * Handles free plan expiry (plan_duration_days) and subscription status
 */
export async function getUserPlanLimits(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanLimits> {
  const billingService = await getBillingService();
  const subscription = await billingService.getUserSubscription(userId);

  let planId = 'plan_free';
  let isExpired = false;

  if (subscription) {
    // Check if subscription is expired
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
      isExpired = true;
    }
    
    // Check free plan duration expiry
    if (!isExpired && subscription.planId === 'plan_free') {
      const { data: subRecord } = await supabase
        .from('cadenza_billing_subscriptions')
        .select('created_at')
        .eq('id', subscription.id)
        .single();

      if (subRecord?.created_at) {
        const createdAt = new Date(subRecord.created_at as string);
        const plan = await billingService.getPlan('plan_free');
        const features = plan.features as Record<string, unknown>;
        const durationDays = features.plan_duration_days as number | null;
        
        if (durationDays && durationDays > 0) {
          const expiryDate = new Date(createdAt);
          expiryDate.setDate(expiryDate.getDate() + durationDays);
          if (new Date() > expiryDate) {
            isExpired = true;
          }
        }
      }
    }

    if (!isExpired) {
      planId = subscription.planId;
    }
  }

  const plan = await billingService.getPlan(planId);
  const features = plan.features as Record<string, unknown>;
  
  return {
    admin_users: (features.admin_users as number) ?? 1,
    max_technicians: (features.max_technicians as number) ?? 3,
    max_photos_per_service: (features.max_photos_per_service as number) ?? 5,
    photo_retention_days: (features.photo_retention_days as number) ?? 30,
    photo_hot_storage_days: (features.photo_hot_storage_days as number) ?? 30,
    photo_archive_provider: (features.photo_archive_provider as string | null) ?? null,
    report_history_days: (features.report_history_days as number) ?? 90,
    plan_duration_days: (features.plan_duration_days as number | null) ?? null,
    video_per_service: (features.video_per_service as boolean) ?? false,
    max_video_seconds: (features.max_video_seconds as number) ?? 0,
    data_export: (features.data_export as boolean) ?? false,
    advanced_analytics: (features.advanced_analytics as boolean) ?? false,
    storage_gb: (features.storage_gb as number) ?? 5,
    max_properties: (features.max_properties as number) ?? 300,
    max_routes: (features.max_routes as number) ?? 10,
    max_service_jobs: (features.max_service_jobs as number) ?? -1,
  } as PlanLimits;
}

/**
 * Check if user can upload photos (within per-service limit)
 */
export async function canUploadPhotos(
  supabase: SupabaseClient,
  userId: string,
  serviceJobId: string
): Promise<{ allowed: boolean; reason?: string; limit?: number }> {
  const limits = await getUserPlanLimits(supabase, userId);
  const maxPhotos = limits.max_photos_per_service;

  if (maxPhotos === -1) {
    return { allowed: true };
  }

  // Count existing photos for this service job
  const { count, error } = await supabase
    .from('cadenza_report_photos')
    .select('id', { count: 'exact', head: true })
    .eq('service_job_id', serviceJobId);

  if (error) {
    throw new Error('Failed to check photo count');
  }

  if ((count ?? 0) >= maxPhotos) {
    return {
      allowed: false,
      reason: `Photo limit reached (${maxPhotos} per service). Please upgrade your plan for more photos.`,
      limit: maxPhotos,
    };
  }

  return { allowed: true, limit: maxPhotos };
}

/**
 * Check if user can upload video
 */
export async function canUploadVideo(
  supabase: SupabaseClient,
  userId: string,
  videoDurationSeconds?: number
): Promise<{ allowed: boolean; reason?: string; maxSeconds?: number }> {
  const limits = await getUserPlanLimits(supabase, userId);

  if (!limits.video_per_service) {
    return {
      allowed: false,
      reason: 'Video upload is not available on your plan. Please upgrade to Pro.',
    };
  }

  const maxSeconds = limits.max_video_seconds;
  if (videoDurationSeconds && maxSeconds > 0 && videoDurationSeconds > maxSeconds) {
    return {
      allowed: false,
      reason: `Video duration exceeds limit (${maxSeconds}s max). Please trim your video.`,
      maxSeconds,
    };
  }

  return { allowed: true, maxSeconds: maxSeconds > 0 ? maxSeconds : undefined };
}

/**
 * Check if user can export data
 */
export async function canExportData(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getUserPlanLimits(supabase, userId);

  if (!limits.data_export) {
    return {
      allowed: false,
      reason: 'Data export is not available on your plan. Please upgrade to Pro.',
    };
  }

  return { allowed: true };
}

/**
 * Get cutoff date for report history based on plan limits
 * Returns null if unlimited history
 */
export async function getReportHistoryCutoff(
  supabase: SupabaseClient,
  userId: string
): Promise<Date | null> {
  const limits = await getUserPlanLimits(supabase, userId);
  const historyDays = limits.report_history_days;

  if (historyDays === -1) {
    return null; // Unlimited
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - historyDays);
  return cutoff;
}

/**
 * Check if free plan is expired and user needs to upgrade
 */
export async function isFreePlanExpired(
  supabase: SupabaseClient,
  userId: string
): Promise<{ expired: boolean; expiryDate?: Date; daysRemaining?: number }> {
  const billingService = await getBillingService();
  const subscription = await billingService.getUserSubscription(userId);

  if (!subscription || subscription.planId !== 'plan_free') {
    return { expired: false };
  }

  const { data: subRecord } = await supabase
    .from('cadenza_billing_subscriptions')
    .select('created_at')
    .eq('id', subscription.id)
    .single();

  if (!subRecord?.created_at) {
    return { expired: false };
  }

  const plan = await billingService.getPlan('plan_free');
  const features = plan.features as Record<string, unknown>;
  const durationDays = features.plan_duration_days as number | null;

  if (!durationDays || durationDays <= 0) {
    return { expired: false }; // No expiry
  }

  const createdAt = new Date(subRecord.created_at as string);
  const expiryDate = new Date(createdAt);
  expiryDate.setDate(expiryDate.getDate() + durationDays);

  const now = new Date();
  const expired = now > expiryDate;
  const daysRemaining = expired ? 0 : Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return { expired, expiryDate, daysRemaining };
}
