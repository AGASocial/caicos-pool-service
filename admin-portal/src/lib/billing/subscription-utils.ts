/**
 * Shared subscription period / effectiveness helpers.
 */

export interface SubscriptionPeriodLike {
  planId?: string;
  status?: string;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean;
}

export function isSubscriptionPeriodExpired(
  sub: SubscriptionPeriodLike | null | undefined,
): boolean {
  if (!sub?.currentPeriodEnd) return false;
  return new Date(sub.currentPeriodEnd) < new Date();
}

/** True when the user should receive paid-plan limits and billing UI (not downgraded to Free). */
export function isPaidSubscriptionEffective(
  sub: SubscriptionPeriodLike | null | undefined,
): boolean {
  if (!sub || sub.planId === 'plan_free') return false;
  if (!sub.status || !['active', 'trialing', 'past_due'].includes(sub.status)) {
    return false;
  }
  return !isSubscriptionPeriodExpired(sub);
}
