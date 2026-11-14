/**
 * Company access mode: full write vs Free-plan expired read-only.
 * Edge-safe helpers (no Stripe / BillingService) for middleware + shared evaluation.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import {
  evaluateFreePlanExpiry,
  type FreePlanExpiryEvaluation,
} from './billing/free-plan-expiry';

export type { FreePlanExpiryEvaluation };
export { evaluateFreePlanExpiry };

export type CompanyAccessMode = 'full' | 'read_only';

export const FREE_PLAN_EXPIRED = 'FREE_PLAN_EXPIRED' as const;

export const FREE_PLAN_EXPIRED_MESSAGE =
  'Tu plan gratuito venció; la cuenta está en solo lectura. Actualiza tu plan.';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Paths that remain writable so companies can upgrade after Free expiry. */
const WRITE_ALLOWLIST_PREFIXES = [
  '/api/billing',
  '/api/webhooks',
  '/api/auth',
  '/api/cron',
  '/api/subscription',
] as const;

export interface CompanyAccessResult {
  mode: CompanyAccessMode;
  code?: typeof FREE_PLAN_EXPIRED;
  expiryDate?: Date;
  daysRemaining?: number;
  billingUserId?: string;
}

export function isApiWriteAllowlisted(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  return WRITE_ALLOWLIST_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

export function freePlanExpiredResponse(): NextResponse {
  return NextResponse.json(
    {
      error: FREE_PLAN_EXPIRED_MESSAGE,
      code: FREE_PLAN_EXPIRED,
      accessMode: 'read_only' as const,
    },
    { status: 402 },
  );
}

async function resolveCompanyBillingUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await supabase
    .from('cadenza_profiles')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle();

  const companyId = profile?.company_id as string | undefined;
  if (!companyId) return userId;

  const { data: owner } = await supabase
    .from('cadenza_profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('role', 'owner')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return (owner?.id as string | undefined) ?? userId;
}

/**
 * Resolve access mode for the company billed to this user's company owner.
 * Uses the same Free-row rules as isFreePlanExpired (current_period_end / duration).
 */
export async function getCompanyAccessMode(
  supabase: SupabaseClient,
  userId: string,
): Promise<CompanyAccessResult> {
  return getCompanyAccessModeEdge(supabase, userId);
}

/**
 * Returns a 402 NextResponse when the company is read-only; otherwise null.
 */
export async function assertWritable(
  supabase: SupabaseClient,
  userId: string,
): Promise<NextResponse | null> {
  const access = await getCompanyAccessMode(supabase, userId);
  if (access.mode === 'read_only') {
    return freePlanExpiredResponse();
  }
  return null;
}

/**
 * Edge-safe Free expiry check (service-role Supabase only — no BillingService).
 */
export async function getCompanyAccessModeEdge(
  supabase: SupabaseClient,
  userId: string,
): Promise<CompanyAccessResult> {
  const billingUserId = await resolveCompanyBillingUserId(supabase, userId);

  const { data: subscription } = await supabase
    .from('cadenza_billing_subscriptions')
    .select('id, plan_id, status, current_period_end, created_at')
    .eq('user_id', billingUserId)
    .eq('plan_id', 'plan_free')
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return { mode: 'full', billingUserId };
  }

  let planDurationDays: number | null = null;
  if (!subscription.current_period_end) {
    const { data: plan } = await supabase
      .from('cadenza_billing_plans')
      .select('features')
      .eq('id', 'plan_free')
      .maybeSingle();
    const features = (plan?.features ?? {}) as Record<string, unknown>;
    planDurationDays =
      typeof features.plan_duration_days === 'number' ? features.plan_duration_days : null;
  }

  const expiry = evaluateFreePlanExpiry({
    planId: subscription.plan_id as string,
    currentPeriodEnd: subscription.current_period_end as string | null,
    createdAt: subscription.created_at as string | null,
    planDurationDays,
  });

  if (expiry.expired) {
    return {
      mode: 'read_only',
      code: FREE_PLAN_EXPIRED,
      expiryDate: expiry.expiryDate,
      daysRemaining: expiry.daysRemaining,
      billingUserId,
    };
  }

  return { mode: 'full', billingUserId };
}

/**
 * Middleware entry: block mutating /api/* when Free plan is expired (except allowlist).
 * Coverage: all POST/PUT/PATCH/DELETE under /api except
 * /api/billing/*, /api/webhooks/*, /api/auth/*, /api/cron/*, /api/subscription/*.
 */
export async function enforceApiWriteAccess(
  request: NextRequest,
  userId: string | null | undefined,
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if (!pathname.startsWith('/api/')) return null;
  if (!isMutatingMethod(method)) return null;
  if (isApiWriteAllowlisted(pathname)) return null;
  if (!userId) return null; // route handlers return 401

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn('enforceApiWriteAccess: missing Supabase env; skipping read-only guard');
    return null;
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const access = await getCompanyAccessModeEdge(admin, userId);
    if (access.mode === 'read_only') {
      return freePlanExpiredResponse();
    }
  } catch (error) {
    console.error('enforceApiWriteAccess failed:', error);
  }

  return null;
}

/** Node helper: assertWritable with a service-role client. */
export async function assertWritableForAuthenticatedUser(
  userId: string,
): Promise<NextResponse | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return null;
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return assertWritable(admin, userId);
}
