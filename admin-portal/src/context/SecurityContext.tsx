"use client";

import React, { createContext, useContext, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';
import { queryKeys } from '@/lib/query-keys';

interface SecuritySession {
  authenticated: boolean;
  hasPin: boolean;
  locked: boolean;
}

async function fetchSecuritySession(): Promise<SecuritySession> {
  const res = await apiFetch('/api/security/check-session');
  if (!res.ok) {
    return { authenticated: false, hasPin: false, locked: false };
  }
  const data = await res.json();
  return {
    authenticated: !!data.authenticated,
    hasPin: !!data.hasPin,
    locked: !!data.locked,
  };
}

interface SecurityState {
  hasPin: boolean;
  locked: boolean;
  loading: boolean;
  checkStatus: () => Promise<void>;
}

const SecurityContext = createContext<SecurityState | undefined>(undefined);

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.security.session,
    queryFn: fetchSecuritySession,
    staleTime: 5 * 60 * 1000,
  });

  const checkStatus = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.security.session });
    await refetch();
  }, [queryClient, refetch]);

  const authenticated = data?.authenticated ?? false;
  const state = {
    hasPin: authenticated ? (data?.hasPin ?? false) : false,
    locked: authenticated ? (data?.locked ?? true) : false,
    loading: isLoading,
  };

  return (
    <SecurityContext.Provider value={{ ...state, checkStatus }}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}

/** Call after successful PIN verify/set to refresh security state only. */
export function invalidateSecuritySession(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.security.session });
}
