/**
 * Resolve the public app base URL for billing redirects (checkout success/cancel,
 * customer portal return_url). Prefer an explicit app URL, then Vercel hostnames,
 * then the incoming request origin.
 */

type HeaderSource = { get(name: string): string | null };

export type ResolveAppUrlOptions = {
  /** Request Origin header (or equivalent), used as last resort */
  requestOrigin?: string | null;
  /** Optional Headers-like object; Origin is read when requestOrigin is omitted */
  headers?: HeaderSource | null;
  /** Injectable env for tests; defaults to process.env */
  env?: NodeJS.ProcessEnv;
};

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function withHttps(hostOrUrl: string): string {
  const trimmed = hostOrUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return stripTrailingSlash(trimmed);
  }
  return `https://${stripTrailingSlash(trimmed)}`;
}

/**
 * Returns the absolute app origin without a trailing slash.
 * Throws if no URL source is available.
 */
export function resolveAppUrl(options: ResolveAppUrlOptions = {}): string {
  const env = options.env ?? process.env;

  const explicit = env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return withHttps(explicit);
  }

  const vercelProduction = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) {
    return withHttps(vercelProduction);
  }

  const vercelUrl = env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return withHttps(vercelUrl);
  }

  const origin =
    options.requestOrigin?.trim() ||
    options.headers?.get('origin')?.trim() ||
    null;
  if (origin) {
    return withHttps(origin);
  }

  throw new Error('Application URL not configured');
}
