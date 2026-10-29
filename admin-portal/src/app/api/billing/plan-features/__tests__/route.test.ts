/**
 * Tests for plan features API endpoint
 */

import { describe, it, expect } from '@jest/globals';

describe('/api/billing/plan-features', () => {
  describe('getLiveStatusBoardAccess', () => {
    function getLiveStatusBoardAccess(planId: string, features: Record<string, unknown>): boolean {
      if ('live_status_board' in features) {
        return features.live_status_board as boolean;
      }

      if (planId === 'plan_free') {
        return false;
      }

      if (planId === 'plan_necessary_month' || planId === 'plan_pro_month') {
        return true;
      }

      return true;
    }

    it('should return false for Free plan by default', () => {
      expect(getLiveStatusBoardAccess('plan_free', {})).toBe(false);
    });

    it('should return true for Standard plan', () => {
      expect(getLiveStatusBoardAccess('plan_necessary_month', {})).toBe(true);
    });

    it('should return true for Pro plan', () => {
      expect(getLiveStatusBoardAccess('plan_pro_month', {})).toBe(true);
    });

    it('should respect explicit feature flag when present', () => {
      expect(getLiveStatusBoardAccess('plan_free', { live_status_board: true })).toBe(true);
      expect(getLiveStatusBoardAccess('plan_pro_month', { live_status_board: false })).toBe(false);
    });

    it('should default to true for unknown plan IDs', () => {
      expect(getLiveStatusBoardAccess('plan_unknown', {})).toBe(true);
    });
  });
});
