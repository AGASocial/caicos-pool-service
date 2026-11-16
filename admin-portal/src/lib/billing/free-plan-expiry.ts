/**
 * Pure Free-plan expiry evaluation (no next/server — safe for Jest jsdom).
 */

export interface FreePlanExpiryEvaluation {
  expired: boolean;
  expiryDate?: Date;
  daysRemaining?: number;
}

/**
 * Pure Free-plan expiry check from subscription fields + plan duration.
 * Prefers currentPeriodEnd (set at Free onboarding); falls back to createdAt + durationDays.
 */
export function evaluateFreePlanExpiry(input: {
  planId?: string | null;
  currentPeriodEnd?: Date | string | null;
  createdAt?: Date | string | null;
  planDurationDays?: number | null;
  now?: Date;
}): FreePlanExpiryEvaluation {
  if (input.planId !== 'plan_free') {
    return { expired: false };
  }

  const now = input.now ?? new Date();

  if (input.currentPeriodEnd) {
    const expiryDate = new Date(input.currentPeriodEnd);
    if (Number.isNaN(expiryDate.getTime())) {
      return { expired: false };
    }
    const expired = now > expiryDate;
    const daysRemaining = expired
      ? 0
      : Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { expired, expiryDate, daysRemaining };
  }

  const durationDays = input.planDurationDays;
  if (!durationDays || durationDays <= 0 || !input.createdAt) {
    return { expired: false };
  }

  const createdAt = new Date(input.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return { expired: false };
  }

  const expiryDate = new Date(createdAt);
  expiryDate.setDate(expiryDate.getDate() + durationDays);
  const expired = now > expiryDate;
  const daysRemaining = expired
    ? 0
    : Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return { expired, expiryDate, daysRemaining };
}
