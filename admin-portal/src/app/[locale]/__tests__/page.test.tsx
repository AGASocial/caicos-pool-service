import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LocalePage from '../page';

describe('LocalePage', () => {
  const mockFetch = global.fetch as jest.Mock;

  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.spyOn(require('@/i18n/navigation'), 'useRouter').mockReturnValue(mockRouter);
  });

  it('redirects authenticated users to the dashboard', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: true }),
    });

    render(<LocalePage />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows the landing page for unauthenticated visitors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: false }),
    });

    render(<LocalePage />);

    expect(await screen.findByText(/start for free/i)).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
