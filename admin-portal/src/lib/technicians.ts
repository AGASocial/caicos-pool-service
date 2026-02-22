"use client";

import { useQuery } from "@tanstack/react-query";

export interface Technician {
  id: string;
  full_name: string;
  role?: string;
  is_active?: boolean;
}

async function fetchTechnicians(): Promise<Technician[]> {
  const res = await fetch("/api/technicians");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to fetch technicians");
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Cached list of technicians for the current user's company.
 * Uses React Query so multiple components share the same request/cache.
 */
export function useTechnicians() {
  return useQuery({
    queryKey: ["technicians"],
    queryFn: fetchTechnicians,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
