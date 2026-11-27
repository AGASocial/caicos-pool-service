import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { LatestDeliveryIndicator } from '../reports/LatestDeliveryIndicator';
import { DeliveryStatusBadge } from '../reports/DeliveryStatusBadge';

jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '@/lib/auth';

const mockUseAuth = useAuth as jest.Mock;
const mockFetch = global.fetch as jest.Mock;

function mockDeliveries(data: unknown[], ok = true) {
  mockFetch.mockResolvedValue({ ok, json: async () => ({ data }) });
}

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  status: 'failed',
  recipient: 'customer@example.com',
  reason: 'no_customer_email',
  attempt_count: 1,
  created_at: '2026-11-27T10:00:00.000Z',
  updated_at: '2026-11-27T10:00:00.000Z',
  job: { id: 'j1', scheduled_date: '2026-11-27', status: 'completed' },
  property: null,
  actor: { type: 'system', user_id: null, name: null },
  can_retry: true,
  ...over,
});

describe('DeliveryStatusBadge', () => {
  it.each(['sent', 'failed', 'pending', 'skipped'] as const)('renders %s', (status) => {
    render(<DeliveryStatusBadge status={status} />);
    const badge = screen.getByTestId('delivery-status-badge');
    expect(badge).toHaveAttribute('data-status', status);
    expect(badge).toHaveTextContent(`reportDeliveries_status_${status}`);
  });
});

describe('LatestDeliveryIndicator (AC-11)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { profile: { role: 'admin' } } });
  });

  it('shows the latest status for a job and queries by job_id', async () => {
    mockDeliveries([entry({ status: 'sent', reason: null })]);
    render(<LatestDeliveryIndicator jobId="j1" />);

    const card = await screen.findByTestId('job-delivery-indicator');
    expect(card).toHaveTextContent('reportDeliveries_status_sent');
    expect(screen.getByTestId('delivery-indicator-recipient')).toHaveTextContent('customer@example.com');
    expect(mockFetch.mock.calls[0][0]).toContain('job_id=j1');
  });

  it('shows the failure reason for a property and queries by property_id', async () => {
    mockDeliveries([entry({ status: 'failed' })]);
    render(<LatestDeliveryIndicator propertyId="p1" />);

    const card = await screen.findByTestId('property-delivery-indicator');
    expect(card).toHaveTextContent('reportDeliveries_status_failed');
    expect(screen.getByTestId('delivery-indicator-reason')).toHaveTextContent(
      'reportDeliveries_reason_no_customer_email',
    );
    expect(mockFetch.mock.calls[0][0]).toContain('property_id=p1');
  });

  it('says nothing was recorded when there is no delivery', async () => {
    mockDeliveries([]);
    render(<LatestDeliveryIndicator jobId="j1" />);
    expect(await screen.findByTestId('delivery-indicator-none')).toBeInTheDocument();
  });

  it('renders nothing and does not fetch for roles without report access', async () => {
    mockUseAuth.mockReturnValue({ user: { profile: { role: 'technician' } } });
    const { container } = render(<LatestDeliveryIndicator jobId="j1" />);
    await waitFor(() => expect(mockFetch).not.toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the log is unavailable', async () => {
    mockDeliveries([], false);
    const { container } = render(<LatestDeliveryIndicator jobId="j1" />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
