'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { hasEntitlement, type Action, type Resource } from '@/lib/entitlements';
import { LoadingState } from '@/components/ui/loading-state';

type EntitlementGateProps = {
  resource: Resource;
  action?: Action;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
};

/**
 * Client-side route guard. Redirects when the signed-in user lacks the entitlement.
 * API routes must enforce the same rules server-side.
 */
export function EntitlementGate({
  resource,
  action = 'view',
  children,
  fallback,
  redirectTo = '/dashboard',
}: EntitlementGateProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = hasEntitlement(user?.profile?.role, resource, action);

  useEffect(() => {
    if (!loading && user && !allowed) {
      router.replace(redirectTo);
    }
  }, [loading, user, allowed, router, redirectTo]);

  if (loading) {
    return fallback ?? <LoadingState fullScreen />;
  }

  if (!user || !allowed) {
    return null;
  }

  return <>{children}</>;
}
