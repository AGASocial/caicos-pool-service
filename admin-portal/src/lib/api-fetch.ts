/** Client fetch with timeout and abort (US-F-006). */

const DEFAULT_TIMEOUT_MS = 10_000;

export class ApiFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiFetchError';
  }
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * fetch wrapper with AbortSignal timeout.
 * Retry policy: defer to QueryClient defaults (staleTime + retry: 1 for queries).
 */
export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, ...init } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiFetchError(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
