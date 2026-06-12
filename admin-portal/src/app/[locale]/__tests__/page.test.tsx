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

  const mockAuthenticatedSession = () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url === '/api/auth/session') {
        return { ok: true, json: async () => ({ authenticated: true }) };
      }
      // Legacy /api/assets used to drive a wizard redirect when it returned []
      return { ok: true, json: async () => [] };
    });
  };

  it('redirects authenticated users to the dashboard', async () => {
    mockAuthenticatedSession();

    render(<LocalePage />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
    });
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/wizard');
  });

  it('does not fetch /api/assets when signed in', async () => {
    mockAuthenticatedSession();

    render(<LocalePage />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalled();
    });
    expect(mockFetch).not.toHaveBeenCalledWith('/api/assets');
  });

  it('shows the landing page for unauthenticated visitors', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: false }),
    });

    render(<LocalePage />);

    expect(await screen.findByText(/get started/i)).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
