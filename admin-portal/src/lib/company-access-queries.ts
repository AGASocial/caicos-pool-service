"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import type { CompanyAccessMode } from "@/lib/company-access";

export const companyAccessQueryKey = ["billing", "access-mode"] as const;

export interface CompanyAccessPayload {
  accessMode: CompanyAccessMode;
  code?: string;
  expiryDate?: string | null;
  daysRemaining?: number | null;
}

async function fetchAccessMode(): Promise<CompanyAccessPayload> {
  const res = await fetch("/api/billing/access-mode", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch access mode");
  const json = await res.json();
  return (json.data ?? json) as CompanyAccessPayload;
}

export function useCompanyAccess(options?: { enabled?: boolean }) {
  const { user, loading } = useAuth();
  const enabled = (options?.enabled ?? true) && !!user?.id && !loading;

  return useQuery({
    queryKey: [...companyAccessQueryKey, user?.id ?? ""] as const,
    queryFn: fetchAccessMode,
    staleTime: 60 * 1000,
    enabled,
  });
}

export function useIsReadOnly(options?: { enabled?: boolean }): boolean {
  const { data } = useCompanyAccess(options);
  return data?.accessMode === "read_only";
}
