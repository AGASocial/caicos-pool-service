"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

export const billingPlansQueryKey = ["billing", "plans"] as const;

/** Row from GET /api/billing/plans (subset used for limits). */
export interface BillingPlanRow {
  id: string;
  name: string;
  features?: TechnicianPlanFeatures & Record<string, unknown>;
}

export interface TechnicianPlanFeatures {
  max_technicians?: number;
  max_users?: number;
}

export interface BillingSubscriptionPayload {
  currentPeriodEnd?: string | Date | null;
  plan?: { features?: TechnicianPlanFeatures & Record<string, unknown> };
}

export interface BillingSubscriptionResponse {
  subscription: BillingSubscriptionPayload;
  config?: { provider?: string };
}

async function fetchBillingPlans(): Promise<BillingPlanRow[]> {
  const res = await fetch("/api/billing/plans", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch billing plans");
  const json = await res.json();
  return Array.isArray(json.plans) ? json.plans : [];
}

/**
 * All public plans (shared cache for any consumer).
 * Plans are global; not scoped per user.
 */
export function useBillingPlans(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: billingPlansQueryKey,
    queryFn: fetchBillingPlans,
    staleTime: 10 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

/**
 * plan_free from the plans list. Uses the same cache as useBillingPlans.
 */
export function useFreePlan(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: billingPlansQueryKey,
    queryFn: fetchBillingPlans,
    select: (plans) => plans.find((p) => p.id === "plan_free") ?? null,
    staleTime: 10 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

async function fetchBillingSubscription(): Promise<BillingSubscriptionResponse> {
  const res = await fetch("/api/billing/subscriptions", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch subscription");
  return res.json();
}

/**
 * Current user's subscription (and embedded plan when applicable).
 */
export function useBillingSubscription(options: {
  userId: string | undefined;
  enabled?: boolean;
}) {
  const { userId, enabled = true } = options;
  return useQuery({
    queryKey: ["billing", "subscription", userId ?? ""] as const,
    queryFn: fetchBillingSubscription,
    staleTime: 60 * 1000,
    enabled: !!userId && enabled,
  });
}

export function maxTechniciansFromPlanFeatures(
  features: TechnicianPlanFeatures | undefined | null,
  fallback: number,
): number {
  if (!features) return fallback;
  return features.max_technicians ?? features.max_users ?? fallback;
}

/**
 * Technician cap for invite UI: active plan features, or plan_free when the billing period has ended.
 * @param freePlanPending — true while the free-plan query has not settled (pass `useQuery().isPending`).
 */
export function computeInviteMaxTechnicians(
  subscription: BillingSubscriptionPayload | undefined,
  freePlan: BillingPlanRow | null | undefined,
  freePlanPending: boolean,
): number {
  if (!subscription) return -1;
  const periodEnd = subscription.currentPeriodEnd;
  const isExpired = periodEnd != null && new Date(periodEnd) < new Date();
  if (isExpired) {
    if (freePlanPending) return -1;
    return maxTechniciansFromPlanFeatures(freePlan?.features, 3);
  }
  const features = subscription.plan?.features as TechnicianPlanFeatures | undefined;
  if (!features) return -1;
  return maxTechniciansFromPlanFeatures(features, 5);
}

/**
 * Prefetch billing plans (including plan_free) and subscription when the dashboard session is active.
 * Mount once under the authenticated shell (e.g. LayoutWrapper).
 */
export function SessionBillingPrefetch() {
  const { user, loading } = useAuth();
  const enabled = !!user?.id && !loading;
  useFreePlan({ enabled });
  useBillingSubscription({ userId: user?.id, enabled });
  return null;
}
