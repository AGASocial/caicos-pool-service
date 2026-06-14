"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { queryKeys } from "@/lib/query-keys";

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    [key: string]: unknown;
  };
  profile?: {
    company_id: string;
    role: string;
    full_name: string;
    is_active: boolean;
  } | null;
}

interface SessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

async function fetchSession(): Promise<SessionResponse> {
  const response = await apiFetch("/api/auth/session", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    return { authenticated: false, user: null };
  }
  return response.json() as Promise<SessionResponse>;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const onAuthChanged = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
    };
    window.addEventListener("auth-changed", onAuthChanged);
    return () => window.removeEventListener("auth-changed", onAuthChanged);
  }, [queryClient]);

  const user = data?.authenticated ? data.user ?? null : null;

  const signOut = async () => {
    try {
      const response = await apiFetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to sign out");
      }

      queryClient.setQueryData(queryKeys.auth.session, {
        authenticated: false,
        user: null,
      });
      window.dispatchEvent(new Event("auth-changed"));
    } catch (err) {
      console.error("Error signing out:", err);
      throw err;
    }
  };

  return {
    user,
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? "Failed to get session" : null,
    signOut,
    isAuthenticated: !!user,
    refreshSession: refetch,
  };
}

/** Invalidate session cache (e.g. after login). */
export function invalidateAuthSession(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
}
