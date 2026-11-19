import {
  isChemicalEventType,
  type RoutineAutoSendEventType,
} from './types';

export type DecideCustomerReportInput = {
  /** Company-configured routine event types that should auto-email. */
  autoSendEventTypes: readonly string[];
  /** Event types recorded on this visit (may include chemical tags). */
  recordedEventTypes: readonly string[];
  /** True when chemical/salt readings or additions were logged. */
  hasChemicalData: boolean;
  /** Job has billable add-on work. */
  hasPaidExtras: boolean;
  /** Per-job toggle: email customer about paid extras on close. */
  sendPaidExtraReport: boolean;
  /** Property customer email; required to send. */
  customerEmail: string | null | undefined;
};

export type DecideCustomerReportResult =
  | {
      action: 'send';
      eventsToReport: RoutineAutoSendEventType[];
      includePaidExtras: boolean;
    }
  | {
      action: 'skip';
      reason:
        | 'no_customer_email'
        | 'chemicals_only'
        | 'paid_extra_report_disabled'
        | 'no_auto_send_events';
    };

/**
 * Pure decision: whether to email a customer report for a completed visit.
 * Chemicals/salt are never included in the send decision as reportable events.
 */
export function decideCustomerReport(
  input: DecideCustomerReportInput,
): DecideCustomerReportResult {
  const email = input.customerEmail?.trim() ?? '';
  if (!email) {
    return { action: 'skip', reason: 'no_customer_email' };
  }

  const autoSet = new Set(
    input.autoSendEventTypes.filter((t) => !isChemicalEventType(t)),
  );

  const eventsToReport = input.recordedEventTypes.filter(
    (t): t is RoutineAutoSendEventType =>
      !isChemicalEventType(t) && autoSet.has(t),
  );

  // Dedupe while preserving order
  const uniqueEvents = [...new Set(eventsToReport)];

  const includePaidExtras = Boolean(input.hasPaidExtras && input.sendPaidExtraReport);

  if (uniqueEvents.length === 0 && !includePaidExtras) {
    if (input.hasPaidExtras && !input.sendPaidExtraReport) {
      return { action: 'skip', reason: 'paid_extra_report_disabled' };
    }
    if (input.hasChemicalData || input.recordedEventTypes.some(isChemicalEventType)) {
      return { action: 'skip', reason: 'chemicals_only' };
    }
    return { action: 'skip', reason: 'no_auto_send_events' };
  }

  return {
    action: 'send',
    eventsToReport: uniqueEvents,
    includePaidExtras,
  };
}

export type ReportLikeForEvents = {
  service_event_types?: string[] | null;
  cleaned_filter?: boolean | null;
  backwashed?: boolean | null;
  other_chemicals?: string | null;
  chlorine_added?: string | null;
  acid_added?: string | null;
  ph_level?: number | null;
  chlorine_level?: number | null;
  alkalinity?: number | null;
  calcium_hardness?: number | null;
  cyanuric_acid?: number | null;
  salt_level?: number | null;
};

/**
 * Collect recorded event tags from a service report, deriving filter_cleaning
 * from legacy cleaned_filter/backwashed flags. Never invents chemical email events
 * from readings — chemicals are detected separately via hasChemicalData.
 */
export function collectRecordedEvents(report: ReportLikeForEvents | null | undefined): {
  recordedEventTypes: string[];
  hasChemicalData: boolean;
} {
  if (!report) {
    return { recordedEventTypes: [], hasChemicalData: false };
  }

  const events = new Set<string>();
  for (const raw of report.service_event_types ?? []) {
    if (typeof raw === 'string' && raw.trim()) events.add(raw.trim());
  }
  if (report.cleaned_filter || report.backwashed) {
    events.add('filter_cleaning');
  }

  const hasChemicalData = Boolean(
    (report.other_chemicals && String(report.other_chemicals).trim()) ||
      (report.chlorine_added && String(report.chlorine_added).trim()) ||
      (report.acid_added && String(report.acid_added).trim()) ||
      report.ph_level != null ||
      report.chlorine_level != null ||
      report.alkalinity != null ||
      report.calcium_hardness != null ||
      report.cyanuric_acid != null ||
      report.salt_level != null ||
      [...events].some(isChemicalEventType),
  );

  return { recordedEventTypes: [...events], hasChemicalData };
}
