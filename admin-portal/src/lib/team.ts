"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { queryKeys } from "@/lib/query-keys";

export interface TeamMember {
  id: string;
  full_name: string;
  role?: string;
  is_active?: boolean;
  /** From denormalized cadenza_profiles.email_confirmed_at. */
  email_confirmed?: boolean;
  /** Pending end-of-period deactivation (paid per-seat). */
  scheduled_deactivation_at?: string | null;
}

export interface SeatInfoClient {
  subscribed: number;
  active: number;
  available: number;
  isOverLimit: boolean;
  isFree?: boolean;
  currentPeriodEnd?: string | null;
  pendingDeactivations?: Array<{
    id: string;
    full_name: string;
    scheduled_deactivation_at: string;
  }>;
}

async function fetchSeats(): Promise<SeatInfoClient> {
  const res = await apiFetch('/api/billing/seats');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Failed to fetch seat information');
  }
  const json = await res.json();
  return json as SeatInfoClient;
}

export function useSeats(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.billing.seats,
    queryFn: fetchSeats,
    staleTime: 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

async function fetchTeam(): Promise<TeamMember[]> {
  const res = await apiFetch("/api/team");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to fetch team members");
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Cached list of team members for the current user's company.
 * Uses React Query so multiple components share the same request/cache.
 */
export function useTeam(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.team.all,
    queryFn: fetchTeam,
    staleTime: 2 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export type SetActivePayload = { id: string; is_active: boolean };

export type SetActiveResult = {
  ok: boolean;
  is_active: boolean;
  pending?: boolean;
  scheduled_deactivation_at?: string | null;
  seatAdded?: boolean;
  notice?: string;
};

async function setTeamMemberActive({ id, is_active }: SetActivePayload): Promise<SetActiveResult> {
  const res = await apiFetch(`/api/team/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to update team member");
  return data;
}

/**
 * Mutation to activate or deactivate a team member. Invalidates the team list on success.
 */
export function useSetTeamMemberActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setTeamMemberActive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.seats });
    },
  });
}
