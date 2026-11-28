/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../route';

const mockRun = jest.fn();
jest.mock('@/lib/monday-digest', () => ({ runMondayDigest: (...args: unknown[]) => mockRun(...args) }));

function call(authorization?: string) {
  return GET(
    new NextRequest('http://localhost/api/cron/monday-digest', {
      headers: authorization ? { authorization } : {},
    }),
  );
}

describe('GET /api/cron/monday-digest', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    mockRun.mockReset();
    process.env = { ...originalEnv, CRON_SECRET: 'cron-test-secret' };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('AC-3: returns 401 without an Authorization header', async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('AC-3: returns 401 for a wrong secret, a wrong scheme and the raw secret', async () => {
    expect((await call('Bearer nope')).status).toBe(401);
    expect((await call('Basic cron-test-secret')).status).toBe(401);
    expect((await call('cron-test-secret')).status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('AC-3: returns 401 when CRON_SECRET is not configured, even for "Bearer undefined"', async () => {
    delete process.env.CRON_SECRET;
    expect((await call('Bearer undefined')).status).toBe(401);
    expect((await call('Bearer ')).status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('AC-3: authorized + flag off returns 200 skipped / disabled', async () => {
    mockRun.mockResolvedValue({ ok: true, skipped: true, reason: 'disabled' });
    const res = await call('Bearer cron-test-secret');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: true, reason: 'disabled' });
  });

  it('returns the run summary (counts only, no addresses) when enabled', async () => {
    mockRun.mockResolvedValue({ ok: true, week_start: '2026-11-30', emails_sent: 2 });
    const res = await call('Bearer cron-test-secret');
    expect(await res.json()).toEqual({ ok: true, week_start: '2026-11-30', emails_sent: 2 });
  });

  it('returns a generic 500 when the run throws', async () => {
    mockRun.mockRejectedValue(new Error('secret detail'));
    const res = await call('Bearer cron-test-secret');
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret detail');
  });
});
