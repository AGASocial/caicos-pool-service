/**
 * Seat Management
 * Free-plan technician cap + paid per-seat Stripe quantity sync.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getBillingService } from '@/lib/billing/server';
import type { BillingService } from '@/lib/billing/billing.service';
import type { PlanDefinition, Subscription } from '@/lib/billing/types';
import { isPaidSubscriptionEffective } from '@/lib/billing/subscription-utils';

/** Owner-approved notice when a paid seat is auto-added with proration. */
export const SEAT_ADDED_PRORATION_NOTICE =
  'Se agregó un asiento; se cobrará prorrateado';

export const DEFAULT_FREE_MAX_TECHNICIANS = 3;

export type ProrationBehavior = 'create_prorations' | 'none' | 'always_invoice';

export interface PendingDeactivation {
  id: string;
  full_name: string;
  scheduled_deactivation_at: string;
}

export interface SeatInfo {
  subscribed: number;
  active: number;
  available: number;
  isOverLimit: boolean;
  isFree: boolean;
  maxTechnicians: number;
  isPerSeat: boolean;
  currentPeriodEnd: string | null;
  pendingDeactivations: PendingDeactivation[];
}

export interface CanAddTechnicianResult {
  canAdd: boolean;
  reason?: string;
  code?: string;
  max?: number;
  isPerSeat?: boolean;
  willIncreaseSeat?: boolean;
}

export interface EnsureSeatResult {
  ok: boolean;
  seatAdded?: boolean;
  notice?: string;
  error?: string;
  code?: string;
  max?: number;
}

export interface ScheduleDeactivationResult {
  ok: boolean;
  is_active: boolean;
  scheduled_deactivation_at?: string | null;
  pending?: boolean;
  error?: string;
  quantity?: number;
}

type BillingDeps = {
  getBillingService: () => Promise<BillingService>;
};

const defaultDeps: BillingDeps = {
  getBillingService,
};

async function resolveCompanyBillingUserId(
  supabase: SupabaseClient,
  companyId: string
): Promise<string | null> {
  const { data: owner } = await supabase
    .from('cadenza_profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('role', 'owner')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return (owner?.id as string | undefined) ?? null;
}

async function resolveBillingContext(
  supabase: SupabaseClient,
  userId: string,
  deps: BillingDeps = defaultDeps
): Promise<{
  companyId: string | null;
  billingUserId: string;
  subscription: Subscription | null;
  plan: PlanDefinition | null;
  isFree: boolean;
  isPerSeat: boolean;
  maxTechnicians: number;
}> {
  const { data: profile } = await supabase
    .from('cadenza_profiles')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle();

  const companyId = (profile?.company_id as string | undefined) ?? null;
  let billingUserId = userId;
  if (companyId) {
    const ownerId = await resolveCompanyBillingUserId(supabase, companyId);
    if (ownerId) billingUserId = ownerId;
  }

  const billingService = await deps.getBillingService();
  const subscription = await billingService.getUserSubscription(billingUserId);

  const paid = isPaidSubscriptionEffective({
    planId: subscription?.planId,
    status: subscription?.status,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
  });

  let plan: PlanDefinition | null = null;
  if (subscription) {
    try {
      plan = await billingService.getPlan(subscription.planId);
    } catch {
      plan = null;
    }
  }
  if (!plan) {
    try {
      plan = await billingService.getPlan('plan_free');
    } catch {
      plan = null;
    }
  }

  const isFree = !paid;
  const isPerSeat = !isFree && plan?.pricingModel === 'per_technician';
  const features = (plan?.features ?? {}) as { max_technicians?: number };
  const maxFromFeatures =
    typeof features.max_technicians === 'number' ? features.max_technicians : DEFAULT_FREE_MAX_TECHNICIANS;

  let maxTechnicians: number;
  if (isFree) {
    maxTechnicians = maxFromFeatures > 0 ? maxFromFeatures : DEFAULT_FREE_MAX_TECHNICIANS;
  } else if (isPerSeat) {
    maxTechnicians = subscription?.quantity ?? 1;
  } else {
    maxTechnicians = maxFromFeatures === -1 ? -1 : maxFromFeatures;
  }

  return {
    companyId,
    billingUserId,
    subscription,
    plan,
    isFree,
    isPerSeat,
    maxTechnicians,
  };
}

async function countActiveTechnicians(
  supabase: SupabaseClient,
  companyId: string
): Promise<number> {
  const { count } = await supabase
    .from('cadenza_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('role', 'technician')
    .eq('is_active', true);

  return count ?? 0;
}

async function listPendingDeactivations(
  supabase: SupabaseClient,
  companyId: string
): Promise<PendingDeactivation[]> {
  const { data } = await supabase
    .from('cadenza_profiles')
    .select('id, full_name, scheduled_deactivation_at')
    .eq('company_id', companyId)
    .eq('role', 'technician')
    .not('scheduled_deactivation_at', 'is', null)
    .order('scheduled_deactivation_at', { ascending: true });

  return (data ?? [])
    .filter((row) => row.scheduled_deactivation_at)
    .map((row) => ({
      id: row.id as string,
      full_name: (row.full_name as string) || '',
      scheduled_deactivation_at: row.scheduled_deactivation_at as string,
    }));
}

/**
 * Seat snapshot for billing UI and enforcement.
 */
export async function getSeatInfo(
  supabase: SupabaseClient,
  userId: string,
  deps: BillingDeps = defaultDeps
): Promise<SeatInfo> {
  const ctx = await resolveBillingContext(supabase, userId, deps);

  if (!ctx.companyId) {
    return {
      subscribed: ctx.isFree ? 0 : ctx.maxTechnicians,
      active: 0,
      available: ctx.isFree ? ctx.maxTechnicians : Math.max(0, ctx.maxTechnicians),
      isOverLimit: false,
      isFree: ctx.isFree,
      maxTechnicians: ctx.maxTechnicians,
      isPerSeat: ctx.isPerSeat,
      currentPeriodEnd: ctx.subscription?.currentPeriodEnd?.toISOString?.()
        ?? (ctx.subscription?.currentPeriodEnd
          ? new Date(ctx.subscription.currentPeriodEnd).toISOString()
          : null),
      pendingDeactivations: [],
    };
  }

  const [active, pendingDeactivations] = await Promise.all([
    countActiveTechnicians(supabase, ctx.companyId),
    listPendingDeactivations(supabase, ctx.companyId),
  ]);

  const subscribed = ctx.isFree ? 0 : (ctx.isPerSeat ? (ctx.subscription?.quantity ?? 1) : ctx.maxTechnicians);
  const cap = ctx.isFree ? ctx.maxTechnicians : subscribed;
  const available =
    cap === -1 ? Number.MAX_SAFE_INTEGER : Math.max(0, cap - active);
  const isOverLimit =
    ctx.isFree
      ? active > ctx.maxTechnicians
      : cap !== -1 && active > cap;

  const periodEnd = ctx.subscription?.currentPeriodEnd;
  const currentPeriodEnd = periodEnd
    ? (periodEnd instanceof Date ? periodEnd.toISOString() : new Date(periodEnd).toISOString())
    : null;

  return {
    subscribed: ctx.isFree ? ctx.maxTechnicians : (subscribed === -1 ? active : subscribed),
    active,
    available: available === Number.MAX_SAFE_INTEGER ? -1 : available,
    isOverLimit,
    isFree: ctx.isFree,
    maxTechnicians: ctx.maxTechnicians,
    isPerSeat: ctx.isPerSeat,
    currentPeriodEnd,
    pendingDeactivations,
  };
}

/**
 * Whether a technician can be invited/activated.
 * Free (no paid sub): hard cap (plan max_technicians or 3).
 * Paid per-seat: allowed; seat may auto-increase on activate.
 * Paid flat: hard cap from plan features (-1 = unlimited).
 */
export async function canAddTechnician(
  supabase: SupabaseClient,
  userId: string,
  deps: BillingDeps = defaultDeps
): Promise<CanAddTechnicianResult> {
  const ctx = await resolveBillingContext(supabase, userId, deps);

  if (!ctx.companyId) {
    return { canAdd: false, reason: 'Company not found.', code: 'COMPANY_NOT_FOUND' };
  }

  const active = await countActiveTechnicians(supabase, ctx.companyId);

  if (ctx.isFree) {
    if (active >= ctx.maxTechnicians) {
      return {
        canAdd: false,
        reason: `Technician limit reached for your plan (${ctx.maxTechnicians} max).`,
        code: 'TECHNICIAN_LIMIT_REACHED',
        max: ctx.maxTechnicians,
        isPerSeat: false,
      };
    }
    return { canAdd: true, max: ctx.maxTechnicians, isPerSeat: false };
  }

  if (ctx.isPerSeat) {
    const subscribed = ctx.subscription?.quantity ?? 1;
    if (active >= subscribed) {
      return {
        canAdd: true,
        willIncreaseSeat: true,
        max: subscribed,
        isPerSeat: true,
      };
    }
    return { canAdd: true, max: subscribed, isPerSeat: true };
  }

  if (ctx.maxTechnicians !== -1 && active >= ctx.maxTechnicians) {
    return {
      canAdd: false,
      reason: `Technician limit reached for your plan (${ctx.maxTechnicians} max).`,
      code: 'TECHNICIAN_LIMIT_REACHED',
      max: ctx.maxTechnicians,
      isPerSeat: false,
    };
  }

  return { canAdd: true, max: ctx.maxTechnicians, isPerSeat: false };
}

/**
 * Shared invite/activation gate used by invite-codes and team activation.
 */
export async function validateTechnicianInvite(
  supabase: SupabaseClient,
  userId: string,
  role: string,
  deps: BillingDeps = defaultDeps
): Promise<{ valid: boolean; error?: string; code?: string; max?: number; isPerSeat?: boolean }> {
  if (role !== 'technician') {
    return { valid: true };
  }

  const result = await canAddTechnician(supabase, userId, deps);
  if (!result.canAdd) {
    return {
      valid: false,
      error: result.reason,
      code: result.code,
      max: result.max,
      isPerSeat: result.isPerSeat,
    };
  }

  return { valid: true, max: result.max, isPerSeat: result.isPerSeat };
}

/**
 * After a technician becomes active: enforce Free/flat caps or bump Stripe quantity.
 */
export async function ensureSeatForNewTechnician(
  supabase: SupabaseClient,
  billingUserIdOrActorId: string,
  deps: BillingDeps = defaultDeps
): Promise<EnsureSeatResult> {
  const ctx = await resolveBillingContext(supabase, billingUserIdOrActorId, deps);
  if (!ctx.companyId) {
    return { ok: false, error: 'Company not found.', code: 'COMPANY_NOT_FOUND' };
  }

  const active = await countActiveTechnicians(supabase, ctx.companyId);

  if (ctx.isFree) {
    if (active > ctx.maxTechnicians) {
      return {
        ok: false,
        error: `Technician limit reached for your plan (${ctx.maxTechnicians} max).`,
        code: 'TECHNICIAN_LIMIT_REACHED',
        max: ctx.maxTechnicians,
      };
    }
    return { ok: true };
  }

  if (!ctx.isPerSeat) {
    if (ctx.maxTechnicians !== -1 && active > ctx.maxTechnicians) {
      return {
        ok: false,
        error: `Technician limit reached for your plan (${ctx.maxTechnicians} max).`,
        code: 'TECHNICIAN_LIMIT_REACHED',
        max: ctx.maxTechnicians,
      };
    }
    return { ok: true };
  }

  const subscription = ctx.subscription;
  if (!subscription?.providerSubscriptionId) {
    return { ok: false, error: 'No active subscription found.', code: 'NO_SUBSCRIPTION' };
  }

  const currentQty = subscription.quantity ?? 1;
  if (active <= currentQty) {
    return { ok: true };
  }

  const newQty = active;
  const billingService = await deps.getBillingService();
  await billingService.updateSubscription({
    subscriptionId: subscription.id,
    quantity: newQty,
    prorationBehavior: 'create_prorations',
  });

  return {
    ok: true,
    seatAdded: true,
    notice: SEAT_ADDED_PRORATION_NOTICE,
  };
}

/**
 * Deactivate technician: on paid per-seat, schedule until period end and lower
 * Stripe quantity immediately with proration_behavior=none (no credit). Access
 * continues until scheduled_deactivation_at; cron flips is_active.
 */
export async function scheduleTechnicianDeactivation(
  supabase: SupabaseClient,
  actorUserId: string,
  technicianId: string,
  deps: BillingDeps = defaultDeps
): Promise<ScheduleDeactivationResult> {
  const { data: tech } = await supabase
    .from('cadenza_profiles')
    .select('id, company_id, role, is_active, scheduled_deactivation_at')
    .eq('id', technicianId)
    .maybeSingle();

  if (!tech) {
    return { ok: false, is_active: false, error: 'User not found.' };
  }

  if (tech.role !== 'technician') {
    const { error } = await supabase
      .from('cadenza_profiles')
      .update({ is_active: false, scheduled_deactivation_at: null })
      .eq('id', technicianId);
    if (error) return { ok: false, is_active: true, error: error.message };
    return { ok: true, is_active: false, pending: false, scheduled_deactivation_at: null };
  }

  const ctx = await resolveBillingContext(supabase, actorUserId, deps);

  if (!ctx.isPerSeat || !ctx.subscription) {
    const { error } = await supabase
      .from('cadenza_profiles')
      .update({ is_active: false, scheduled_deactivation_at: null })
      .eq('id', technicianId);
    if (error) return { ok: false, is_active: true, error: error.message };
    return { ok: true, is_active: false, pending: false, scheduled_deactivation_at: null };
  }

  const periodEnd = ctx.subscription.currentPeriodEnd
    ? new Date(ctx.subscription.currentPeriodEnd)
    : null;

  if (!periodEnd || periodEnd.getTime() <= Date.now()) {
    const { error } = await supabase
      .from('cadenza_profiles')
      .update({ is_active: false, scheduled_deactivation_at: null })
      .eq('id', technicianId);
    if (error) return { ok: false, is_active: true, error: error.message };

    const active = ctx.companyId ? await countActiveTechnicians(supabase, ctx.companyId) : 0;
    const currentQty = ctx.subscription.quantity ?? 1;
    if (active < currentQty) {
      const billingService = await deps.getBillingService();
      await billingService.updateSubscription({
        subscriptionId: ctx.subscription.id,
        quantity: Math.max(1, active),
        prorationBehavior: 'none',
      });
    }

    return { ok: true, is_active: false, pending: false, scheduled_deactivation_at: null };
  }

  if (tech.scheduled_deactivation_at) {
    return {
      ok: true,
      is_active: true,
      pending: true,
      scheduled_deactivation_at: tech.scheduled_deactivation_at as string,
      quantity: ctx.subscription.quantity,
    };
  }

  const scheduledAt = periodEnd.toISOString();
  const { error: scheduleError } = await supabase
    .from('cadenza_profiles')
    .update({
      is_active: true,
      scheduled_deactivation_at: scheduledAt,
    })
    .eq('id', technicianId);

  if (scheduleError) {
    return { ok: false, is_active: true, error: scheduleError.message };
  }

  const currentQty = ctx.subscription.quantity ?? 1;
  const newQty = Math.max(1, currentQty - 1);
  if (newQty < currentQty) {
    const billingService = await deps.getBillingService();
    await billingService.updateSubscription({
      subscriptionId: ctx.subscription.id,
      quantity: newQty,
      prorationBehavior: 'none',
    });
  }

  return {
    ok: true,
    is_active: true,
    pending: true,
    scheduled_deactivation_at: scheduledAt,
    quantity: newQty,
  };
}

/**
 * Activate a technician (or cancel a pending deactivation). May auto-add a seat.
 */
export async function activateTechnician(
  supabase: SupabaseClient,
  actorUserId: string,
  technicianId: string,
  deps: BillingDeps = defaultDeps
): Promise<ScheduleDeactivationResult & { notice?: string; seatAdded?: boolean }> {
  const { data: tech } = await supabase
    .from('cadenza_profiles')
    .select('id, role, is_active, scheduled_deactivation_at, company_id')
    .eq('id', technicianId)
    .maybeSingle();

  if (!tech) {
    return { ok: false, is_active: false, error: 'User not found.' };
  }

  // Cancel pending deactivation without needing a new seat (still active).
  if (tech.scheduled_deactivation_at && tech.is_active) {
    const { error } = await supabase
      .from('cadenza_profiles')
      .update({ scheduled_deactivation_at: null })
      .eq('id', technicianId);
    if (error) return { ok: false, is_active: true, error: error.message };

    const seat = await ensureSeatForNewTechnician(supabase, actorUserId, deps);
    if (!seat.ok) {
      return {
        ok: false,
        is_active: true,
        scheduled_deactivation_at: null,
        error: seat.error,
      };
    }

    return {
      ok: true,
      is_active: true,
      pending: false,
      scheduled_deactivation_at: null,
      seatAdded: seat.seatAdded,
      notice: seat.notice,
    };
  }

  if (tech.role === 'technician') {
    const gate = await canAddTechnician(supabase, actorUserId, deps);
    // For Free/flat at hard cap, refuse before flipping active.
    if (!gate.canAdd && !gate.willIncreaseSeat) {
      return {
        ok: false,
        is_active: false,
        error: gate.reason,
      };
    }
  }

  const { error } = await supabase
    .from('cadenza_profiles')
    .update({ is_active: true, scheduled_deactivation_at: null })
    .eq('id', technicianId);

  if (error) {
    return { ok: false, is_active: false, error: error.message };
  }

  if (tech.role === 'technician') {
    const seat = await ensureSeatForNewTechnician(supabase, actorUserId, deps);
    if (!seat.ok) {
      // Roll back activation if seat sync failed / Free cap exceeded.
      await supabase
        .from('cadenza_profiles')
        .update({ is_active: false })
        .eq('id', technicianId);
      return {
        ok: false,
        is_active: false,
        error: seat.error,
      };
    }
    return {
      ok: true,
      is_active: true,
      pending: false,
      scheduled_deactivation_at: null,
      seatAdded: seat.seatAdded,
      notice: seat.notice,
    };
  }

  return { ok: true, is_active: true, pending: false, scheduled_deactivation_at: null };
}

/**
 * Apply due scheduled deactivations (is_active=false). Quantity was already
 * lowered at schedule time with proration_behavior=none.
 */
export async function processDueTechnicianDeactivations(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<{ processed: number }> {
  const iso = now.toISOString();
  const { data: due, error } = await supabase
    .from('cadenza_profiles')
    .select('id')
    .eq('role', 'technician')
    .eq('is_active', true)
    .not('scheduled_deactivation_at', 'is', null)
    .lte('scheduled_deactivation_at', iso);

  if (error || !due?.length) {
    return { processed: 0 };
  }

  const ids = due.map((row) => row.id as string);
  const { error: updateError } = await supabase
    .from('cadenza_profiles')
    .update({ is_active: false, scheduled_deactivation_at: null })
    .in('id', ids);

  if (updateError) {
    console.error('processDueTechnicianDeactivations failed:', updateError);
    return { processed: 0 };
  }

  return { processed: ids.length };
}
