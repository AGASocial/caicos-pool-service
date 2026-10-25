/**
 * Tests for plan limits enforcement
 */

import {
  canUploadPhotos,
  canUploadVideo,
  isFreePlanExpired,
} from '../plan-limits';

// Mock dependencies
jest.mock('../billing/server', () => ({
  getBillingService: jest.fn(),
}));

describe('Plan Limits', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    };
  });

  describe('canUploadPhotos', () => {
    it('should allow photo upload when under limit', async () => {
      const { getBillingService } = require('../billing/server');

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          planId: 'plan_free',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            max_photos_per_service: 4,
          },
        }),
      };

      getBillingService.mockResolvedValue(mockBillingService);

      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.maybeSingle.mockResolvedValue({ data: { count: 2 } });

      const result = await canUploadPhotos(mockSupabase, 'user-123', 'job-123');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(4);
    });

    it('should block photo upload when at limit', async () => {
      const { getBillingService } = require('../billing/server');

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          planId: 'plan_free',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            max_photos_per_service: 4,
          },
        }),
      };

      getBillingService.mockResolvedValue(mockBillingService);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            count: 'exact',
            head: true,
          }),
        }),
      });

      // Mock count query
      const countResult = { count: 4, error: null };
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve(countResult)),
        })),
      }));

      const result = await canUploadPhotos(mockSupabase, 'user-123', 'job-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Photo limit reached');
      expect(result.limit).toBe(4);
    });

    it('should allow unlimited photos when limit is -1', async () => {
      const { getBillingService } = require('../billing/server');

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          planId: 'plan_pro_month',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            max_photos_per_service: -1,
          },
        }),
      };

      getBillingService.mockResolvedValue(mockBillingService);

      const result = await canUploadPhotos(mockSupabase, 'user-123', 'job-123');

      expect(result.allowed).toBe(true);
    });
  });

  describe('canUploadVideo', () => {
    it('should block video upload for non-Pro plans', async () => {
      const { getBillingService } = require('../billing/server');

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          planId: 'plan_free',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            video_per_service: false,
            max_video_seconds: 0,
          },
        }),
      };

      getBillingService.mockResolvedValue(mockBillingService);

      const result = await canUploadVideo(mockSupabase, 'user-123', 30);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not available on your plan');
    });

    it('should allow video upload for Pro plan within duration limit', async () => {
      const { getBillingService } = require('../billing/server');

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          planId: 'plan_pro_month',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            video_per_service: true,
            max_video_seconds: 60,
          },
        }),
      };

      getBillingService.mockResolvedValue(mockBillingService);

      const result = await canUploadVideo(mockSupabase, 'user-123', 45);

      expect(result.allowed).toBe(true);
      expect(result.maxSeconds).toBe(60);
    });

    it('should block video upload exceeding duration limit', async () => {
      const { getBillingService } = require('../billing/server');

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          planId: 'plan_pro_month',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            video_per_service: true,
            max_video_seconds: 60,
          },
        }),
      };

      getBillingService.mockResolvedValue(mockBillingService);

      const result = await canUploadVideo(mockSupabase, 'user-123', 90);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('duration exceeds limit');
      expect(result.maxSeconds).toBe(60);
    });
  });

  describe('isFreePlanExpired', () => {
    it('should detect expired free plan after 90 days', async () => {
      const { getBillingService } = require('../billing/server');

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          id: 'sub-123',
          planId: 'plan_free',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            plan_duration_days: 90,
          },
        }),
      };

      getBillingService.mockResolvedValue(mockBillingService);

      // Mock created 100 days ago
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 100);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { created_at: createdAt.toISOString() },
            }),
          }),
        }),
      });

      const result = await isFreePlanExpired(mockSupabase, 'user-123');

      expect(result.expired).toBe(true);
      expect(result.daysRemaining).toBe(0);
    });

    it('should not expire non-free plans', async () => {
      const { getBillingService } = require('../billing/server');

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          id: 'sub-123',
          planId: 'plan_pro_month',
        }),
      };

      getBillingService.mockResolvedValue(mockBillingService);

      const result = await isFreePlanExpired(mockSupabase, 'user-123');

      expect(result.expired).toBe(false);
    });
  });
});
