/**
 * Tests for Live Status Board status mapping and relative time
 */

import { describe, it, expect } from '@jest/globals';

type JobStatus = 'pending' | 'en_route' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';

type StatusBoardJob = {
  id: string;
  status: JobStatus;
  en_route_at: string | null;
  cadenza_service_reports?: Array<{
    arrival_time: string | null;
    departure_time: string | null;
  }> | null;
};

function getRelativeTime(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function getJobState(job: StatusBoardJob): {
  label: string;
  variant: string;
  time: string | null;
} {
  const reports = Array.isArray(job.cadenza_service_reports) ? job.cadenza_service_reports : [];
  const report = reports[0];

  if (job.status === 'completed' && report?.departure_time) {
    return {
      label: 'Done',
      variant: 'success',
      time: getRelativeTime(report.departure_time),
    };
  }

  if (job.status === 'in_progress' && report?.arrival_time) {
    return {
      label: 'On site',
      variant: 'default',
      time: getRelativeTime(report.arrival_time),
    };
  }

  if (job.status === 'en_route' && job.en_route_at) {
    return {
      label: 'On the way',
      variant: 'secondary',
      time: getRelativeTime(job.en_route_at),
    };
  }

  if (job.status === 'skipped') {
    return {
      label: 'Skipped',
      variant: 'outline',
      time: null,
    };
  }

  return {
    label: 'Pending',
    variant: 'outline',
    time: null,
  };
}

describe('LiveStatusBoard', () => {
  describe('getRelativeTime', () => {
    it('should return "now" for timestamps within the last minute', () => {
      const timestamp = new Date(Date.now() - 30000).toISOString(); // 30 seconds ago
      expect(getRelativeTime(timestamp)).toBe('now');
    });

    it('should return minutes for timestamps within the last hour', () => {
      const timestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
      expect(getRelativeTime(timestamp)).toBe('5m ago');
    });

    it('should return hours for timestamps older than an hour', () => {
      const timestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      expect(getRelativeTime(timestamp)).toBe('2h ago');
    });

    it('should return null for null timestamp', () => {
      expect(getRelativeTime(null)).toBeNull();
    });
  });

  describe('getJobState', () => {
    it('should return "On the way" for en_route status', () => {
      const job: StatusBoardJob = {
        id: '1',
        status: 'en_route',
        en_route_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        cadenza_service_reports: null,
      };
      const state = getJobState(job);
      expect(state.label).toBe('On the way');
      expect(state.variant).toBe('secondary');
      expect(state.time).toBe('2m ago');
    });

    it('should return "On site" for in_progress status with arrival time', () => {
      const job: StatusBoardJob = {
        id: '1',
        status: 'in_progress',
        en_route_at: null,
        cadenza_service_reports: [
          {
            arrival_time: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            departure_time: null,
          },
        ],
      };
      const state = getJobState(job);
      expect(state.label).toBe('On site');
      expect(state.variant).toBe('default');
      expect(state.time).toBe('15m ago');
    });

    it('should return "Done" for completed status with departure time', () => {
      const job: StatusBoardJob = {
        id: '1',
        status: 'completed',
        en_route_at: null,
        cadenza_service_reports: [
          {
            arrival_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            departure_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          },
        ],
      };
      const state = getJobState(job);
      expect(state.label).toBe('Done');
      expect(state.variant).toBe('success');
      expect(state.time).toBe('30m ago');
    });

    it('should return "Pending" for pending status', () => {
      const job: StatusBoardJob = {
        id: '1',
        status: 'pending',
        en_route_at: null,
        cadenza_service_reports: null,
      };
      const state = getJobState(job);
      expect(state.label).toBe('Pending');
      expect(state.variant).toBe('outline');
      expect(state.time).toBeNull();
    });

    it('should return "Skipped" for skipped status', () => {
      const job: StatusBoardJob = {
        id: '1',
        status: 'skipped',
        en_route_at: null,
        cadenza_service_reports: null,
      };
      const state = getJobState(job);
      expect(state.label).toBe('Skipped');
      expect(state.variant).toBe('outline');
      expect(state.time).toBeNull();
    });
  });
});
