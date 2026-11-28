/**
 * @jest-environment node
 */
import type { DigestIssue, DigestTechnicianGroup } from '@/lib/monday-digest';

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

jest.mock('@/lib/app-url', () => ({
  resolveAppUrl: () => 'https://app.test',
}));

const issue = (over: Partial<DigestIssue> & { id: string }): DigestIssue => ({
  source: 'service_report',
  job_id: 'job-1',
  property_id: 'prop-1',
  created_at: '2026-11-10T12:00:00.000Z',
  summary: null,
  issue_categories: [],
  urgency: null,
  last_reviewed_at: null,
  days_open: 17,
  technician_id: 'tech-1',
  technician_name: 'Tech One',
  property: { id: 'prop-1', customer_name: 'QA Billing Property 1', address: '1 Test St' },
  ...over,
});

const groups: DigestTechnicianGroup<DigestIssue>[] = [
  {
    technician_id: 'tech-1',
    technician_name: 'Tech One',
    issues: [
      issue({ id: 'r1', issue_categories: ['motor'], summary: 'Motor hums <b>loud</b>' }),
      issue({
        id: 'n1',
        source: 'voice_note',
        job_id: 'job-2',
        urgency: 'high',
        days_open: 5,
        summary: 'Pump leaking',
      }),
      issue({
        id: 'n2',
        source: 'voice_note',
        job_id: 'job-3',
        urgency: 'low',
        days_open: 2,
        summary: 'RAW TRANSCRIPT: the customer said the gate code is 1234',
        summary_is_transcript: true,
      }),
    ],
  },
  {
    technician_id: null,
    technician_name: null,
    issues: [issue({ id: 'r2', technician_id: null, technician_name: null, days_open: 1, property: null })],
  },
];

const baseParams = {
  to: 'qa-billing-office@cadenzaops.com',
  companyId: 'co-1',
  weekStart: '2026-11-23',
  groups,
  issueCount: 4,
};

describe('digest-mailer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });
    process.env = { ...originalEnv, VERCEL_ENV: 'preview' };
    delete process.env.DIGEST_EMAIL_FROM;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('AC-4: no-ops without RESEND_API_KEY and never logs a key', async () => {
    delete process.env.RESEND_API_KEY;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendMondayDigestEmail } = await import('../digest-mailer');
    const result = await sendMondayDigestEmail(baseParams);
    expect(result).toEqual({ sent: false, messageId: null, reason: 'no_api_key' });
    expect(sendMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.map((c) => String(c[0])).join(' ')).not.toMatch(/re_/i);
    warn.mockRestore();
  });

  it('AC-4: never sends to a non-QA recipient outside production, even with a key', async () => {
    process.env.RESEND_API_KEY = 're_test_xxx';
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendMondayDigestEmail } = await import('../digest-mailer');
    const result = await sendMondayDigestEmail({ ...baseParams, to: 'office@example.com' });
    expect(result).toMatchObject({ sent: false, reason: 'recipient_not_allowed' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends with the fallback From, an idempotency key and the Resend message id', async () => {
    process.env.RESEND_API_KEY = 're_test_xxx';
    const { sendMondayDigestEmail } = await import('../digest-mailer');
    const result = await sendMondayDigestEmail(baseParams);
    expect(result).toEqual({ sent: true, messageId: 'email_1' });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload, options] = sendMock.mock.calls[0];
    expect(payload.from).toBe('Cadenza <notifications@hello.cadenzaops.com>');
    expect(payload.to).toEqual(['qa-billing-office@cadenzaops.com']);
    expect(payload.subject).toBe('Monday digest: 4 open issues');
    expect(options).toEqual({
      idempotencyKey: 'monday-digest/co-1/2026-11-23/qa-billing-office@cadenzaops.com',
    });
  });

  it('uses DIGEST_EMAIL_FROM when set', async () => {
    process.env.RESEND_API_KEY = 're_test_xxx';
    process.env.DIGEST_EMAIL_FROM = 'Digest <digest@test.example>';
    const { sendMondayDigestEmail } = await import('../digest-mailer');
    await sendMondayDigestEmail(baseParams);
    expect(sendMock.mock.calls[0][0].from).toBe('Digest <digest@test.example>');
  });

  it('AC-4: includes technician grouping, days open, property identity and a job link', async () => {
    process.env.RESEND_API_KEY = 're_test_xxx';
    const { sendMondayDigestEmail } = await import('../digest-mailer');
    await sendMondayDigestEmail(baseParams);
    const { text, html } = sendMock.mock.calls[0][0];
    expect(text).toContain('Tech One (3)');
    expect(text).toContain('Unassigned (1)');
    expect(text.indexOf('Tech One')).toBeLessThan(text.indexOf('Unassigned'));
    expect(text).toContain('17 days open');
    expect(text).toContain('1 day open');
    expect(text).toContain('QA Billing Property 1, 1 Test St');
    expect(text).toContain('Unknown property');
    expect(text).toContain('https://app.test/en/jobs/job-1');
    expect(text).toContain('https://app.test/en/open-issues');
    expect(html).toContain('<h3>Tech One (3)</h3>');
  });

  it('keeps raw voice-note transcripts out of the email but keeps the classification', async () => {
    process.env.RESEND_API_KEY = 're_test_xxx';
    const { sendMondayDigestEmail } = await import('../digest-mailer');
    await sendMondayDigestEmail(baseParams);
    const { text, html } = sendMock.mock.calls[0][0];
    expect(text).not.toContain('RAW TRANSCRIPT');
    expect(html).not.toContain('gate code');
    expect(text).toContain('Pump leaking · high urgency');
    expect(text).toContain('low urgency');
  });

  it('escapes HTML in user-provided text', async () => {
    process.env.RESEND_API_KEY = 're_test_xxx';
    const { sendMondayDigestEmail } = await import('../digest-mailer');
    await sendMondayDigestEmail(baseParams);
    const { html } = sendMock.mock.calls[0][0];
    expect(html).not.toContain('<b>loud</b>');
    expect(html).toContain('&lt;b&gt;loud&lt;/b&gt;');
  });

  it('renders Spanish copy for es locales and defaults other locales to English', async () => {
    process.env.RESEND_API_KEY = 're_test_xxx';
    const { sendMondayDigestEmail } = await import('../digest-mailer');
    await sendMondayDigestEmail({ ...baseParams, locale: 'es-MX' });
    const es = sendMock.mock.calls[0][0];
    expect(es.subject).toBe('Resumen del lunes: 4 problemas abiertos');
    expect(es.text).toContain('Sin asignar (1)');
    expect(es.text).toContain('17 días abierto');
    expect(es.text).toContain('https://app.test/es/jobs/job-1');

    await sendMondayDigestEmail({ ...baseParams, locale: 'fr' });
    expect(sendMock.mock.calls[1][0].subject).toBe('Monday digest: 4 open issues');
  });

  it('never throws: a Resend error is reported as send_failed', async () => {
    process.env.RESEND_API_KEY = 're_test_xxx';
    sendMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { sendMondayDigestEmail } = await import('../digest-mailer');
    await expect(sendMondayDigestEmail(baseParams)).resolves.toEqual({
      sent: false,
      messageId: null,
      reason: 'send_failed',
    });
    sendMock.mockRejectedValue(new Error('network'));
    await expect(sendMondayDigestEmail(baseParams)).resolves.toMatchObject({ sent: false });
    err.mockRestore();
  });
});
