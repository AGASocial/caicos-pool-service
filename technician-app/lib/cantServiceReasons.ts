/** Can't-service reason catalog — slugs match cadenza_cant_service_reasons.slug */

export type CantServiceReason = {
  slug: string;
  label: string;
  sort_order: number;
};

/** Fallback when DB catalog is unavailable (matches migration seed slugs). */
export const DEFAULT_CANT_SERVICE_REASONS: CantServiceReason[] = [
  { slug: 'gate_locked', label: 'gate_locked', sort_order: 0 },
  { slug: 'client_cancelled', label: 'client_cancelled', sort_order: 10 },
  { slug: 'client_not_home', label: 'client_not_home', sort_order: 20 },
  { slug: 'dog_in_yard', label: 'dog_in_yard', sort_order: 30 },
  { slug: 'access_blocked', label: 'access_blocked', sort_order: 40 },
  { slug: 'bad_weather', label: 'bad_weather', sort_order: 50 },
  { slug: 'pool_under_repair', label: 'pool_under_repair', sort_order: 60 },
  { slug: 'vehicle_blocking', label: 'vehicle_blocking', sort_order: 70 },
];

export function labelsForSlugs(
  slugs: string[],
  catalog: CantServiceReason[],
  resolveLabel: (slug: string, dbLabel: string) => string
): string[] {
  const bySlug = new Map(catalog.map((r) => [r.slug, r.label]));
  return slugs.map((slug) => resolveLabel(slug, bySlug.get(slug) ?? slug));
}
