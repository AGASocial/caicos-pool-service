/** Routine visit events that companies may enable for automatic customer emails. */
export const ROUTINE_AUTO_SEND_EVENT_TYPES = [
  'filter_change',
  'o_ring_replacement',
  'filter_cleaning',
  'low_water_level',
] as const;

export type RoutineAutoSendEventType = (typeof ROUTINE_AUTO_SEND_EVENT_TYPES)[number];

/** Chemical/salt tags may be stored on a visit but are never emailed. */
export const CHEMICAL_EVENT_TYPES = ['chemical_reading', 'salt_addition'] as const;

export type ChemicalEventType = (typeof CHEMICAL_EVENT_TYPES)[number];

export type ServiceEventType = RoutineAutoSendEventType | ChemicalEventType;

export const DEFAULT_AUTO_SEND_EVENT_TYPES: RoutineAutoSendEventType[] = [
  ...ROUTINE_AUTO_SEND_EVENT_TYPES,
];

export const ALL_SERVICE_EVENT_TYPES: ServiceEventType[] = [
  ...ROUTINE_AUTO_SEND_EVENT_TYPES,
  ...CHEMICAL_EVENT_TYPES,
];

export function isRoutineAutoSendEventType(value: string): value is RoutineAutoSendEventType {
  return (ROUTINE_AUTO_SEND_EVENT_TYPES as readonly string[]).includes(value);
}

export function isChemicalEventType(value: string): value is ChemicalEventType {
  return (CHEMICAL_EVENT_TYPES as readonly string[]).includes(value);
}

export function parseAutoSendEventTypes(raw: unknown): RoutineAutoSendEventType[] {
  if (!Array.isArray(raw)) return [...DEFAULT_AUTO_SEND_EVENT_TYPES];
  const out: RoutineAutoSendEventType[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && isRoutineAutoSendEventType(item) && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}
