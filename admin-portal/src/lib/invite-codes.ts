"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { queryKeys } from "@/lib/query-keys";

export interface InviteCode {
  code: string;
  role: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

async function fetchInviteCodes(): Promise<InviteCode[]> {
  const res = await apiFetch("/api/invite-codes");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to fetch invite codes");
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function isInvitePending(invite: InviteCode): boolean {
  if (invite.used_at) return false;
  return new Date(invite.expires_at) > new Date();
}

export function buildInviteRegisterUrl(code: string): string {
  if (typeof window === "undefined") return `/auth/register?invite=${code}`;
  return `${window.location.origin}/auth/register?invite=${code}`;
}

/**
 * Active (unused, not expired) invite codes for the current company.
 */
export function usePendingInvites() {
  return useQuery({
    queryKey: queryKeys.inviteCodes.all,
    queryFn: async () => {
      const codes = await fetchInviteCodes();
      return codes.filter(isInvitePending);
    },
    staleTime: 2 * 60 * 1000,
  });
}
