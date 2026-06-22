/** Can't-service reason catalog — slugs match cadenza_cant_service_reasons.slug */

export type CantServiceReason = {
  slug: string;
  label: string;
  sort_order: number;
};

/** Fallback when DB catalog is unavailable (matches migration seed). */
export const DEFAULT_CANT_SERVICE_REASONS: CantServiceReason[] = [
  { slug: 'gate_locked', label: 'Puerta cerrada', sort_order: 0 },
  { slug: 'client_cancelled', label: 'Cliente canceló', sort_order: 10 },
  { slug: 'client_not_home', label: 'Cliente no está', sort_order: 20 },
  { slug: 'dog_in_yard', label: 'Perro en el patio', sort_order: 30 },
  { slug: 'access_blocked', label: 'Acceso bloqueado', sort_order: 40 },
  { slug: 'bad_weather', label: 'Clima adverso', sort_order: 50 },
  { slug: 'pool_under_repair', label: 'Piscina en reparación', sort_order: 60 },
  { slug: 'vehicle_blocking', label: 'Vehículo bloqueando acceso', sort_order: 70 },
];

export function labelsForSlugs(slugs: string[], catalog: CantServiceReason[]): string[] {
  const bySlug = new Map(catalog.map((r) => [r.slug, r.label]));
  return slugs.map((slug) => bySlug.get(slug) ?? slug);
}
