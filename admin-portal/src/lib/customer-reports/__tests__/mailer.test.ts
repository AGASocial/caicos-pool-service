/**
 * @jest-environment node
 */

const mockReportSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockReportSend },
  })),
}));

describe('customer-report mailer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    mockReportSend.mockReset();
    mockReportSend.mockResolvedValue({ data: { id: 'email_report_1' }, error: null });
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('no-ops without RESEND_API_KEY (never throws)', async () => {
    delete process.env.RESEND_API_KEY;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendCustomerReportEmail } = await import('../mailer');
    const result = await sendCustomerReportEmail({
      to: 'customer@example.com',
      customerName: 'Pat',
      propertyAddress: '1 Pool Lane',
      companyName: 'Acme Pools',
      scheduledDate: '2026-11-17',
      eventsToReport: ['filter_cleaning'],
      includePaidExtras: false,
    });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(mockReportSend).not.toHaveBeenCalled();
    const joined = warn.mock.calls.map((c) => String(c[0])).join(' ');
    expect(joined).not.toMatch(/re_/i);
    warn.mockRestore();
  });

  it('sends with REPORTS_EMAIL_FROM and idempotency key', async () => {
    process.env.RESEND_API_KEY = 're_test_xxx';
    process.env.REPORTS_EMAIL_FROM = 'Reports <reports@test.com>';
    const { sendCustomerReportEmail } = await import('../mailer');
    const result = await sendCustomerReportEmail({
      to: 'customer@example.com',
      locale: 'en',
      customerName: 'Pat',
      propertyAddress: '1 Pool Lane',
      companyName: 'Acme Pools',
      scheduledDate: '2026-11-17',
      eventsToReport: ['filter_change'],
      includePaidExtras: true,
      idempotencyKey: 'customer-report/job-1',
    });
    expect(result.ok).toBe(true);
    expect(result.messageId).toBe('email_report_1');
    expect(mockReportSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['customer@example.com'],
        from: 'Reports <reports@test.com>',
        subject: expect.stringMatching(/Service report/i),
        html: expect.stringContaining('Filter change'),
        text: expect.stringContaining('Billable add-on work'),
      }),
      { idempotencyKey: 'customer-report/job-1' },
    );
  });

  it('never includes chemical readings in the email body', async () => {
    process.env.RESEND_API_KEY = 're_test_xxx';
    const { sendCustomerReportEmail } = await import('../mailer');
    await sendCustomerReportEmail({
      to: 'customer@example.com',
      customerName: 'Pat',
      propertyAddress: '1 Pool Lane',
      companyName: 'Acme Pools',
      scheduledDate: '2026-11-17',
      eventsToReport: ['low_water_level'],
      includePaidExtras: false,
    });
    const payload = mockReportSend.mock.calls[0][0] as { html: string; text: string };
    expect(payload.html + payload.text).not.toMatch(/chlorine|pH|salt|ppm/i);
  });
});
