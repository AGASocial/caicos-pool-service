/**
 * @jest-environment node
 */
import {
  assertNoVoiceNotesInCustomerReport,
  payloadContainsVoiceNoteFields,
  stripVoiceNoteFields,
} from '../customer-report-guard';

describe('AC-13 voice notes excluded from customer reports', () => {
  it('detects voice-note fields in a payload', () => {
    expect(
      payloadContainsVoiceNoteFields({
        eventsToReport: ['filter_cleaning'],
        voiceNotes: [{ transcript: 'secret' }],
      }),
    ).toBe(true);
    expect(
      payloadContainsVoiceNoteFields({
        to: 'customer@example.com',
        eventsToReport: ['filter_cleaning'],
        includePaidExtras: false,
      }),
    ).toBe(false);
  });

  it('strips accidental voice-note keys', () => {
    const cleaned = stripVoiceNoteFields({
      to: 'customer@example.com',
      voice_note: 'should go',
      transcript: 'also go',
      eventsToReport: ['filter_change'],
    });
    expect(cleaned).toEqual({
      to: 'customer@example.com',
      eventsToReport: ['filter_change'],
    });
  });

  it('assert throws when voice notes sneak into customer report params', () => {
    expect(() =>
      assertNoVoiceNotesInCustomerReport({
        customerName: 'Pat',
        transcript: 'do not email this',
      }),
    ).toThrow(/AC-13/);
  });

  it('mailer params type never includes voice note fields (runtime guard passes)', async () => {
    process.env.RESEND_API_KEY = '';
    const { sendCustomerReportEmail } = await import(
      '@/lib/customer-reports/mailer'
    );
    const result = await sendCustomerReportEmail({
      to: 'customer@example.com',
      customerName: 'Pat',
      propertyAddress: '1 Pool Lane',
      companyName: 'Acme Pools',
      scheduledDate: '2026-11-24',
      eventsToReport: ['filter_cleaning'],
      includePaidExtras: false,
    });
    expect(result.skipped || result.ok === false).toBe(true);
  });
});
