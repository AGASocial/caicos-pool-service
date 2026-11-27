/**
 * AC-13: voice notes must never appear in customer reports or emails.
 * Customer report builders only accept explicit event types + paid-extras flags;
 * this helper documents and enforces that voice-note fields are stripped.
 */

const VOICE_NOTE_FIELD_MARKERS = [
  'voice_note',
  'voiceNote',
  'voice_notes',
  'voiceNotes',
  'transcript',
  'cadenza_job_voice_notes',
] as const;

export type CustomerFacingPayload = Record<string, unknown>;

/**
 * Returns true if a payload appears to include voice-note content that must
 * not be sent to customers.
 */
export function payloadContainsVoiceNoteFields(
  payload: CustomerFacingPayload,
): boolean {
  const json = JSON.stringify(payload).toLowerCase();
  return VOICE_NOTE_FIELD_MARKERS.some((marker) =>
    json.includes(marker.toLowerCase()),
  );
}

/**
 * Strip any accidental voice-note keys from a customer-facing object.
 * Safe no-op when none are present.
 */
export function stripVoiceNoteFields<T extends CustomerFacingPayload>(
  payload: T,
): T {
  const out: CustomerFacingPayload = { ...payload };
  for (const key of Object.keys(out)) {
    if (/voice.?note/i.test(key) || key === 'transcript') {
      delete out[key];
    }
  }
  return out as T;
}

/**
 * Assert that customer report email params never include voice notes.
 * Used by tests and as a runtime guard before send.
 */
export function assertNoVoiceNotesInCustomerReport(
  params: CustomerFacingPayload,
): void {
  if (payloadContainsVoiceNoteFields(params)) {
    throw new Error(
      'AC-13: customer reports must not include voice notes or transcripts',
    );
  }
}
