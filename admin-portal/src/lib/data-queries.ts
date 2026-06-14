"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { queryKeys } from "@/lib/query-keys";
import type { PaginatedResponse } from "@/lib/pagination";

export type JobFilters = {
  date_from?: string;
  date_to?: string;
  technician_id?: string;
  status?: string;
  job_source?: string;
  route_id?: string;
  day_of_week?: string;
  cursor?: string;
  limit?: number;
};

export type PropertyFilters = {
  active_only?: boolean;
  include_route?: boolean;
  unassigned?: boolean;
  cursor?: string;
  limit?: number;
};

function buildJobsQuery(filters: JobFilters): string {
  const params = new URLSearchParams();
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.technician_id) params.set("technician_id", filters.technician_id);
  if (filters.status) params.set("status", filters.status);
  if (filters.job_source) params.set("job_source", filters.job_source);
  if (filters.route_id) params.set("route_id", filters.route_id);
  if (filters.day_of_week !== undefined && filters.day_of_week !== "") {
    params.set("day_of_week", filters.day_of_week);
  }
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.limit) params.set("limit", String(filters.limit));
  return params.toString();
}

function buildPropertiesQuery(filters: PropertyFilters): string {
  const params = new URLSearchParams();
  if (filters.active_only === false) params.set("active_only", "false");
  if (filters.include_route) params.set("include_route", "1");
  if (filters.unassigned) params.set("unassigned", "1");
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (filters.limit) params.set("limit", String(filters.limit));
  return params.toString();
}

async function fetchJobsPage(filters: JobFilters) {
  const qs = buildJobsQuery(filters);
  const res = await apiFetch(`/api/jobs?${qs}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to fetch jobs");
  }
  return res.json() as Promise<PaginatedResponse<Record<string, unknown>>>;
}

async function fetchPropertiesPage(filters: PropertyFilters) {
  const qs = buildPropertiesQuery(filters);
  const res = await apiFetch(`/api/properties?${qs}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to fetch properties");
  }
  return res.json() as Promise<PaginatedResponse<Record<string, unknown>>>;
}

async function fetchRoutesPage(cursor?: string) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const res = await apiFetch(`/api/routes?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to fetch routes");
  }
  return res.json() as Promise<PaginatedResponse<Record<string, unknown>>>;
}

export function useJobs(filters: JobFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.jobs.list(filters as Record<string, string | undefined>),
    queryFn: () => fetchJobsPage(filters),
    staleTime: 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useProperties(filters: PropertyFilters = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.properties.list(filters),
    queryFn: () => fetchPropertiesPage(filters),
    staleTime: 2 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useRoutes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.routes.list(),
    queryFn: () => fetchRoutesPage(),
    staleTime: 2 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

/** Invalidate list caches after mutations (US-F-002-5). */
export function useInvalidateListQueries() {
  const queryClient = useQueryClient();
  return {
    invalidateJobs: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
    invalidateProperties: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.all }),
    invalidateRoutes: () => queryClient.invalidateQueries({ queryKey: queryKeys.routes.all }),
    invalidateTeam: () => queryClient.invalidateQueries({ queryKey: queryKeys.team.all }),
  };
}
