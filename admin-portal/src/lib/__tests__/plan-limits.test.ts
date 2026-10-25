/**
 * Tests for plan limits enforcement
 */

import {
  canUploadPhotos,
  canUploadVideo,
  isFreePlanExpired,
} from '../plan-limits';
import { getBillingService } from '../billing/server';

// Mock dependencies
jest.mock('../billing/server', () => ({
  getBillingService: jest.fn(),
}));

const mockGetBillingService = getBillingService as jest.MockedFunction<typeof getBillingService>;

describe('Plan Limits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canUploadPhotos', () => {
    it('should allow photo upload when under limit', async () => {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 10); // 10 days ago (not expired)

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'cadenza_report_photos') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => Promise.resolve({ count: 2, error: null })),
              })),
            };
          }
          if (table === 'cadenza_billing_subscriptions') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn(() =>
                    Promise.resolve({
                      data: { created_at: createdAt.toISOString() },
                      error: null,
                    })
                  ),
                })),
              })),
            };
          }
          return {};
        }),
      };

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          id: 'sub-123',
          planId: 'plan_free',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            max_photos_per_service: 4,
            plan_duration_days: 90,
          },
        }),
      };

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      const result = await canUploadPhotos(mockSupabase as never, 'user-123', 'job-123');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(4);
    });

    it('should block photo upload when at limit', async () => {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 10);

      const mockSupabase = {
        from: jest.fn((table: string) => {
          if (table === 'cadenza_report_photos') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => Promise.resolve({ count: 4, error: null })),
              })),
            };
          }
          if (table === 'cadenza_billing_subscriptions') {
            return {
              select: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn(() =>
                    Promise.resolve({
                      data: { created_at: createdAt.toISOString() },
                      error: null,
                    })
                  ),
                })),
              })),
            };
          }
          return {};
        }),
      };

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          id: 'sub-123',
          planId: 'plan_free',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            max_photos_per_service: 4,
            plan_duration_days: 90,
          },
        }),
      };

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      const result = await canUploadPhotos(mockSupabase as never, 'user-123', 'job-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Photo limit reached');
      expect(result.limit).toBe(4);
    });

    it('should allow unlimited photos when limit is -1', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ count: 100, error: null })),
          })),
        })),
      };

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          id: 'sub-123',
          planId: 'plan_pro_month',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            max_photos_per_service: -1,
          },
        }),
      };

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      const result = await canUploadPhotos(mockSupabase as never, 'user-123', 'job-123');

      expect(result.allowed).toBe(true);
    });
  });

  describe('canUploadVideo', () => {
    it('should block video upload for non-Pro plans', async () => {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 10);

      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({
                  data: { created_at: createdAt.toISOString() },
                  error: null,
                })
              ),
            })),
          })),
        })),
      };

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          id: 'sub-123',
          planId: 'plan_free',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            video_per_service: false,
            max_video_seconds: 0,
            plan_duration_days: 90,
          },
        }),
      };

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      const result = await canUploadVideo(mockSupabase as never, 'user-123', 30);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not available on your plan');
    });

    it('should allow video upload for Pro plan within duration limit', async () => {
      const mockSupabase = {} as never;

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          id: 'sub-123',
          planId: 'plan_pro_month',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            video_per_service: true,
            max_video_seconds: 60,
          },
        }),
      };

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      const result = await canUploadVideo(mockSupabase, 'user-123', 45);

      expect(result.allowed).toBe(true);
      expect(result.maxSeconds).toBe(60);
    });

    it('should block video upload exceeding duration limit', async () => {
      const mockSupabase = {} as never;

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          id: 'sub-123',
          planId: 'plan_pro_month',
        }),
        getPlan: jest.fn().mockResolvedValue({
          features: {
            video_per_service: true,
            max_video_seconds: 60,
          },
        }),
      };

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      const result = await canUploadVideo(mockSupabase, 'user-123', 90);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('duration exceeds limit');
      expect(result.maxSeconds).toBe(60);
    });
  });

  describe('isFreePlanExpired', () => {
    it('should detect expired free plan after 90 days', async () => {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 100);

      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: { created_at: createdAt.toISOString() },
                error: null,
              })),
            })),
          })),
        })),
      };

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

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      const result = await isFreePlanExpired(mockSupabase as never, 'user-123');

      expect(result.expired).toBe(true);
      expect(result.daysRemaining).toBe(0);
    });

    it('should not expire non-free plans', async () => {
      const mockSupabase = {} as never;

      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          id: 'sub-123',
          planId: 'plan_pro_month',
        }),
      };

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      const result = await isFreePlanExpired(mockSupabase, 'user-123');

      expect(result.expired).toBe(false);
    });
  });
});

