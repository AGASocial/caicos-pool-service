import { resolveAppUrl } from '../app-url';

describe('resolveAppUrl', () => {
  it('prefers NEXT_PUBLIC_APP_URL', () => {
    expect(
      resolveAppUrl({
        env: {
          NEXT_PUBLIC_APP_URL: 'https://app.example.com/',
          VERCEL_PROJECT_PRODUCTION_URL: 'prod.vercel.app',
          VERCEL_URL: 'preview.vercel.app',
        } as unknown as NodeJS.ProcessEnv,
        requestOrigin: 'https://origin.example.com',
      })
    ).toBe('https://app.example.com');
  });

  it('falls back to VERCEL_PROJECT_PRODUCTION_URL with https', () => {
    expect(
      resolveAppUrl({
        env: {
          VERCEL_PROJECT_PRODUCTION_URL: 'cadenza.vercel.app',
          VERCEL_URL: 'preview.vercel.app',
        } as unknown as NodeJS.ProcessEnv,
        requestOrigin: 'https://origin.example.com',
      })
    ).toBe('https://cadenza.vercel.app');
  });

  it('falls back to VERCEL_URL with https when production URL is unset', () => {
    expect(
      resolveAppUrl({
        env: { VERCEL_URL: 'my-preview-abc.vercel.app' } as unknown as NodeJS.ProcessEnv,
        requestOrigin: 'https://origin.example.com',
      })
    ).toBe('https://my-preview-abc.vercel.app');
  });

  it('falls back to request origin when env URLs are unset', () => {
    expect(
      resolveAppUrl({
        env: {} as unknown as NodeJS.ProcessEnv,
        requestOrigin: 'http://localhost:3000/',
      })
    ).toBe('http://localhost:3000');
  });

  it('reads Origin from headers when requestOrigin is omitted', () => {
    const headers = {
      get: (name: string) => (name === 'origin' ? 'https://from-headers.test' : null),
    };
    expect(resolveAppUrl({ env: {} as unknown as NodeJS.ProcessEnv, headers })).toBe(
      'https://from-headers.test'
    );
  });

  it('throws when no URL source is available', () => {
    expect(() => resolveAppUrl({ env: {} as unknown as NodeJS.ProcessEnv })).toThrow(
      'Application URL not configured'
    );
  });
});
