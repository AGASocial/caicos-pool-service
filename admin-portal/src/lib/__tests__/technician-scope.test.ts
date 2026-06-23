import {
  jobMatchesTechnicianScope,
  technicianJobsOrFilter,
} from '../technician-scope';

describe('technician-scope', () => {
  const scope = {
    hasAssignedRoutes: true,
    routeIds: ['route-1', 'route-2'],
    propertyIds: ['prop-1'],
  };

  describe('jobMatchesTechnicianScope', () => {
    it('matches jobs on assigned routes', () => {
      expect(
        jobMatchesTechnicianScope({ route_id: 'route-1', technician_id: null }, 'tech-1', scope),
      ).toBe(true);
    });

    it('matches jobs assigned directly to the technician', () => {
      expect(
        jobMatchesTechnicianScope({ route_id: null, technician_id: 'tech-1' }, 'tech-1', scope),
      ).toBe(true);
    });

    it('rejects jobs outside scope', () => {
      expect(
        jobMatchesTechnicianScope({ route_id: 'route-9', technician_id: 'other' }, 'tech-1', scope),
      ).toBe(false);
    });

    it('rejects all jobs when no routes are assigned', () => {
      expect(
        jobMatchesTechnicianScope(
          { route_id: 'route-1', technician_id: 'tech-1' },
          'tech-1',
          { ...scope, hasAssignedRoutes: false, routeIds: [] },
        ),
      ).toBe(false);
    });
  });

  describe('technicianJobsOrFilter', () => {
    it('builds a supabase or filter for routes and technician id', () => {
      expect(technicianJobsOrFilter('tech-1', ['route-1', 'route-2'])).toBe(
        'route_id.in.(route-1,route-2),technician_id.eq.tech-1',
      );
    });
  });
});
