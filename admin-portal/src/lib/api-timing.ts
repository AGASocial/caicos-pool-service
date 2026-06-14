import { NextResponse } from 'next/server';

/** Request duration logging wrapper (US-B-015). */

export async function withApiTiming<T extends Response>(
  label: string,
  handler: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const res = await handler();
    const ms = Math.round(performance.now() - start);
    console.info(JSON.stringify({ type: 'api_timing', route: label, duration_ms: ms, status: res.status }));
    return res;
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    console.error(JSON.stringify({ type: 'api_timing', route: label, duration_ms: ms, error: true }));
    throw err;
  }
}

export function jsonWithCache(
  data: unknown,
  init?: ResponseInit & { cacheControl?: string },
): NextResponse {
  const headers = new Headers(init?.headers);
  if (init?.cacheControl) {
    headers.set('Cache-Control', init.cacheControl);
  }
  return NextResponse.json(data, { ...init, headers });
}
