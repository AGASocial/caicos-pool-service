/**
 * Role-based entitlements for the admin portal.
 *
 * Format: `{resource}.{action}` — e.g. `team.view`, `report.create`.
 * Extend ROLE_ENTITLEMENTS when adding roles or granular permissions.
 */

export const ROLES = ['owner', 'admin', 'technician', 'operations'] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = ['view', 'create', 'edit', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = [
  'dashboard',
  'report',
  'job',
  'route',
  'property',
  'team',
  'billing',
  'settings',
  'message_template',
  'trash',
  'follow_up',
] as const;
export type Resource = (typeof RESOURCES)[number];

export type Entitlement = `${Resource}.${Action}`;

export const ENTITLEMENT_DENIED = 'ENTITLEMENT_DENIED' as const;

export function entitlement(resource: Resource, action: Action): Entitlement {
  return `${resource}.${action}`;
}

export function normalizeRole(role: string | undefined | null): Role | null {
  const value = role?.toLowerCase();
  if (value && (ROLES as readonly string[]).includes(value)) {
    return value as Role;
  }
  return null;
}

export function isOfficeRole(role: string | undefined | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'owner' || normalized === 'admin' || normalized === 'operations';
}

function allActions(resource: Resource): Entitlement[] {
  return ACTIONS.map((action) => entitlement(resource, action));
}

const OFFICE_RESOURCES: Resource[] = [
  'dashboard',
  'report',
  'job',
  'route',
  'property',
  'team',
  'billing',
  'settings',
  'message_template',
  'trash',
  'follow_up',
];

const OFFICE_ENTITLEMENTS = new Set<Entitlement>(
  OFFICE_RESOURCES.flatMap((resource) => allActions(resource)),
);

const TECHNICIAN_ENTITLEMENTS = new Set<Entitlement>([
  ...allActions('dashboard'),
  entitlement('job', 'view'),
  entitlement('property', 'view'),
  entitlement('settings', 'view'),
  entitlement('settings', 'edit'),
]);

const ROLE_ENTITLEMENTS: Record<Role, ReadonlySet<Entitlement>> = {
  owner: OFFICE_ENTITLEMENTS,
  admin: OFFICE_ENTITLEMENTS,
  operations: OFFICE_ENTITLEMENTS,
  technician: TECHNICIAN_ENTITLEMENTS,
};

export function getEntitlementsForRole(role: string | undefined | null): ReadonlySet<Entitlement> {
  const normalized = normalizeRole(role);
  if (!normalized) return new Set();
  return ROLE_ENTITLEMENTS[normalized];
}

export function hasEntitlement(
  role: string | undefined | null,
  resource: Resource,
  action: Action,
): boolean {
  return getEntitlementsForRole(role).has(entitlement(resource, action));
}

export function entitlementError(resource: Resource, action: Action) {
  return {
    error: 'Forbidden',
    code: ENTITLEMENT_DENIED,
    resource,
    action,
  };
}
