import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuth } from '../auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

describe('useAuth', () => {
  const mockFetch = global.fetch as jest.Mock;
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
    Wrapper.displayName = 'AuthTestWrapper';
    return Wrapper;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should initialize with loading state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: false, user: null }),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should return user when authenticated session exists', async () => {
    const user = { id: 'user-123', email: 'test@example.com' };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true, user }),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(user);
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({
      method: 'GET',
      credentials: 'include',
    }));
  });

  it('should return null user when not authenticated', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: false, user: null }),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle failed session request gracefully', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // When session request fails, fetchSession returns { authenticated: false, user: null }
    // So we should be logged out, not have an error
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should call logout endpoint on signOut', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: true, user: { id: 'user-123' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false, user: null }),
      });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }));
  });

  it('should refresh session when auth-changed is dispatched', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false, user: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: true, user: { id: 'user-999' } }),
      });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      window.dispatchEvent(new Event('auth-changed'));
    });

    await waitFor(() => {
      expect(result.current.user?.id).toBe('user-999');
    });
  });
});
