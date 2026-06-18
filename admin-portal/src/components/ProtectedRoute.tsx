"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/ui/loading-state';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      console.log('User not authenticated, redirecting to login');
      router.replace(`/${locale}/auth/login`);
    }
  }, [loading, isAuthenticated, router, locale]);

  if (loading) {
    return fallback || <LoadingState fullScreen />;
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
} 