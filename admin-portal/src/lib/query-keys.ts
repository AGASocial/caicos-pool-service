/** Shared TanStack Query keys (US-F-002). */

export const queryKeys = {
  auth: {
    session: ['auth', 'session'] as const,
  },
  security: {
    session: ['security', 'session'] as const,
  },
  team: {
    all: ['team'] as const,
  },
  jobs: {
    all: ['jobs'] as const,
    list: (filters: Record<string, string | undefined>) => ['jobs', 'list', filters] as const,
  },
  properties: {
    all: ['properties'] as const,
    list: (filters: Record<string, string | boolean | number | undefined>) =>
      ['properties', 'list', filters] as const,
  },
  routes: {
    all: ['routes'] as const,
    list: () => ['routes', 'list'] as const,
  },
  dashboard: {
    stats: ['dashboard', 'stats'] as const,
  },
} as const;
