import {
  entitlement,
  getEntitlementsForRole,
  hasEntitlement,
  isOfficeRole,
  normalizeRole,
} from '../entitlements';

describe('entitlements', () => {
  describe('normalizeRole', () => {
    it('normalizes known roles', () => {
      expect(normalizeRole('Owner')).toBe('owner');
      expect(normalizeRole('TECHNICIAN')).toBe('technician');
    });

    it('returns null for unknown roles', () => {
      expect(normalizeRole('superuser')).toBeNull();
      expect(normalizeRole(null)).toBeNull();
    });
  });

  describe('isOfficeRole', () => {
    it('returns true for office roles', () => {
      expect(isOfficeRole('owner')).toBe(true);
      expect(isOfficeRole('admin')).toBe(true);
      expect(isOfficeRole('operations')).toBe(true);
    });

    it('returns false for technicians', () => {
      expect(isOfficeRole('technician')).toBe(false);
    });
  });

  describe('hasEntitlement', () => {
    it('grants team.view to office roles', () => {
      expect(hasEntitlement('owner', 'team', 'view')).toBe(true);
      expect(hasEntitlement('admin', 'team', 'view')).toBe(true);
      expect(hasEntitlement('operations', 'team', 'view')).toBe(true);
    });

    it('denies team entitlements to technicians', () => {
      expect(hasEntitlement('technician', 'team', 'view')).toBe(false);
      expect(hasEntitlement('technician', 'team', 'create')).toBe(false);
      expect(hasEntitlement('technician', 'team', 'edit')).toBe(false);
    });

    it('allows technicians to view assigned operational pages', () => {
      expect(hasEntitlement('technician', 'dashboard', 'view')).toBe(true);
      expect(hasEntitlement('technician', 'job', 'view')).toBe(true);
      expect(hasEntitlement('technician', 'property', 'view')).toBe(true);
      expect(hasEntitlement('technician', 'settings', 'view')).toBe(true);
    });

    it('denies technicians company reports and routes', () => {
      expect(hasEntitlement('technician', 'report', 'view')).toBe(false);
      expect(hasEntitlement('technician', 'route', 'view')).toBe(false);
    });

    it('denies technicians team management', () => {
      expect(hasEntitlement('technician', 'team', 'create')).toBe(false);
    });
  });

  describe('getEntitlementsForRole', () => {
    it('includes team.view for admins', () => {
      expect(getEntitlementsForRole('admin').has(entitlement('team', 'view'))).toBe(true);
    });

    it('excludes team.view for technicians', () => {
      expect(getEntitlementsForRole('technician').has(entitlement('team', 'view'))).toBe(false);
    });
  });
});
