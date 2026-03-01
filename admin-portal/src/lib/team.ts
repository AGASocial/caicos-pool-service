"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface TeamMember {
  id: string;
  full_name: string;
  role?: string;
  is_active?: boolean;
}

async function fetchTeam(): Promise<TeamMember[]> {
  const res = await fetch("/api/team");
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
export function useTeam() {
  return useQuery({
    queryKey: ["team"],
    queryFn: fetchTeam,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export type SetActivePayload = { id: string; is_active: boolean };

async function setTeamMemberActive({ id, is_active }: SetActivePayload): Promise<{ ok: boolean; is_active: boolean }> {
  const res = await fetch(`/api/team/${encodeURIComponent(id)}`, {
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
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
  });
}
