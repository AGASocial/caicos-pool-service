/**
 * @jest-environment node
 */

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

jest.mock('@/lib/app-url', () => ({
  resolveAppUrl: () => 'https://app.test',
}));

describe('billing-mailer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('no-ops without RESEND_API_KEY (never throws)', async () => {
    delete process.env.RESEND_API_KEY;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendPaymentFailedEmail } = await import('../billing-mailer');
    const ok = await sendPaymentFailedEmail({
      to: 'owner@example.com',
      gracePeriodEndsAt: '2026-11-27T00:00:00.000Z',
      eventId: 'evt_1',
    });
    expect(ok).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    const joined = warn.mock.calls.map((c) => String(c[0])).join(' ');
    expect(joined).not.toMatch(/re_/i);
    warn.mockRestore();
  });

  it('sends payment-failed email with idempotency key when key is set', async () => {
    process.env.RESEND_API_KEY = 're_test_xxx';
    process.env.BILLING_EMAIL_FROM = 'Billing <billing@test.com>';
    const { sendPaymentFailedEmail } = await import('../billing-mailer');
    const ok = await sendPaymentFailedEmail({
      to: 'owner@example.com',
      locale: 'es',
      gracePeriodEndsAt: '2026-11-27T00:00:00.000Z',
      eventId: 'evt_pay_fail',
    });
    expect(ok).toBe(true);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['owner@example.com'],
        from: 'Billing <billing@test.com>',
        subject: expect.stringMatching(/pago falló/i),
      }),
      { idempotencyKey: 'billing/payment-failed/evt_pay_fail' },
    );
  });
});
