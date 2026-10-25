/**
 * Tests for plan limits enforcement
 */

import {
  canUploadPhotos,
  canUploadVideo,
  isFreePlanExpired,
} from '../plan-limits';
import { getBillingService } from '../billing/server';
import type { CadenzaSupabaseClient } from '../supabase-cadenza';

// Mock dependencies
jest.mock('../billing/server', () => ({
  getBillingService: jest.fn(),
}));

const mockGetBillingService = getBillingService as jest.MockedFunction<typeof getBillingService>;

describe('Plan Limits', () => {
  // @ts-expect-error - Mock type doesn't fully match CadenzaSupabaseClient
  let mockSupabase: Pick<CadenzaSupabaseClient, 'from' | 'select' | 'eq' | 'single'>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    } as unknown as typeof mockSupabase;
  });

  describe('canUploadPhotos', () => {
    it('should allow photo upload when under limit', async () => {

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

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      // @ts-expect-error - Mock chaining for test
      mockSupabase.select.mockReturnThis();
      // @ts-expect-error - Mock chaining for test
      mockSupabase.eq.mockReturnThis();
      // @ts-expect-error - Mock with maybeSingle
      (mockSupabase as { maybeSingle: jest.Mock }).maybeSingle = jest.fn().mockResolvedValue({ data: { count: 2 } });

      // @ts-expect-error - Partial mock is sufficient for test
      const result = await canUploadPhotos(mockSupabase as CadenzaSupabaseClient, 'user-123', 'job-123');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(4);
    });

    it('should block photo upload when at limit', async () => {
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

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      // @ts-expect-error - Mock for test
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            count: 'exact',
            head: true,
          }),
        }),
      } as never);

      // Mock count query
      const countResult = { count: 4, error: null };
      // @ts-expect-error - Mock for test
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve(countResult)),
        })),
      })) as never;

      // @ts-expect-error - Partial mock is sufficient for test
      const result = await canUploadPhotos(mockSupabase as CadenzaSupabaseClient, 'user-123', 'job-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Photo limit reached');
      expect(result.limit).toBe(4);
    });

    it('should allow unlimited photos when limit is -1', async () => {
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

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      // @ts-expect-error - Partial mock is sufficient for test
      const result = await canUploadPhotos(mockSupabase as CadenzaSupabaseClient, 'user-123', 'job-123');

      expect(result.allowed).toBe(true);
    });
  });

  describe('canUploadVideo', () => {
    it('should block video upload for non-Pro plans', async () => {
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

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      // @ts-expect-error - Partial mock is sufficient for test
      const result = await canUploadVideo(mockSupabase as CadenzaSupabaseClient, 'user-123', 30);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not available on your plan');
    });

    it('should allow video upload for Pro plan within duration limit', async () => {
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

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      // @ts-expect-error - Partial mock is sufficient for test
      const result = await canUploadVideo(mockSupabase as CadenzaSupabaseClient, 'user-123', 45);

      expect(result.allowed).toBe(true);
      expect(result.maxSeconds).toBe(60);
    });

    it('should block video upload exceeding duration limit', async () => {
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

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      // @ts-expect-error - Partial mock is sufficient for test
      const result = await canUploadVideo(mockSupabase as CadenzaSupabaseClient, 'user-123', 90);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('duration exceeds limit');
      expect(result.maxSeconds).toBe(60);
    });
  });

  describe('isFreePlanExpired', () => {
    it('should detect expired free plan after 90 days', async () => {
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

      // Mock created 100 days ago
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 100);

      // @ts-expect-error - Mock for test
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { created_at: createdAt.toISOString() },
            }),
          }),
        }),
      } as never);

      // @ts-expect-error - Partial mock is sufficient for test
      const result = await isFreePlanExpired(mockSupabase as CadenzaSupabaseClient, 'user-123');

      expect(result.expired).toBe(true);
      expect(result.daysRemaining).toBe(0);
    });

    it('should not expire non-free plans', async () => {
      const mockBillingService = {
        getUserSubscription: jest.fn().mockResolvedValue({
          id: 'sub-123',
          planId: 'plan_pro_month',
        }),
      };

      mockGetBillingService.mockResolvedValue(mockBillingService as never);

      // @ts-expect-error - Partial mock is sufficient for test
      const result = await isFreePlanExpired(mockSupabase as CadenzaSupabaseClient, 'user-123');

      expect(result.expired).toBe(false);
    });
  });
});
