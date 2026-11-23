/**
 * @jest-environment node
 */

import {
  collectRecordedEvents,
  decideCustomerReport,
} from '../decide';
import { DEFAULT_AUTO_SEND_EVENT_TYPES } from '../types';

describe('decideCustomerReport', () => {
  const base = {
    autoSendEventTypes: [...DEFAULT_AUTO_SEND_EVENT_TYPES],
    recordedEventTypes: [] as string[],
    hasChemicalData: false,
    hasPaidExtras: false,
    sendPaidExtraReport: false,
    customerEmail: 'customer@example.com',
  };

  it('sends when a configured routine event was recorded', () => {
    const result = decideCustomerReport({
      ...base,
      recordedEventTypes: ['filter_change', 'chemical_reading'],
    });
    expect(result).toEqual({
      action: 'send',
      eventsToReport: ['filter_change'],
      includePaidExtras: false,
    });
  });

  it('never sends chemicals alone even if they are the only thing logged', () => {
    const result = decideCustomerReport({
      ...base,
      recordedEventTypes: ['chemical_reading', 'salt_addition'],
      hasChemicalData: true,
    });
    expect(result).toEqual({ action: 'skip', reason: 'chemicals_only' });
  });

  it('never treats chemical tags as auto-send even if misconfigured on company', () => {
    const result = decideCustomerReport({
      ...base,
      autoSendEventTypes: ['chemical_reading', 'filter_cleaning'],
      recordedEventTypes: ['chemical_reading'],
      hasChemicalData: true,
    });
    expect(result).toEqual({ action: 'skip', reason: 'chemicals_only' });
  });

  it('sends paid extras when the per-job toggle is on', () => {
    const result = decideCustomerReport({
      ...base,
      hasPaidExtras: true,
      sendPaidExtraReport: true,
    });
    expect(result).toEqual({
      action: 'send',
      eventsToReport: [],
      includePaidExtras: true,
    });
  });

  it('skips paid extras when the per-job toggle is off', () => {
    const result = decideCustomerReport({
      ...base,
      hasPaidExtras: true,
      sendPaidExtraReport: false,
    });
    expect(result).toEqual({ action: 'skip', reason: 'paid_extra_report_disabled' });
  });

  it('respects company auto-send config (event not enabled → no send)', () => {
    const result = decideCustomerReport({
      ...base,
      autoSendEventTypes: ['filter_change'],
      recordedEventTypes: ['filter_cleaning', 'low_water_level'],
    });
    expect(result).toEqual({ action: 'skip', reason: 'no_auto_send_events' });
  });

  it('skips when customer email is missing', () => {
    const result = decideCustomerReport({
      ...base,
      customerEmail: '  ',
      recordedEventTypes: ['o_ring_replacement'],
    });
    expect(result).toEqual({ action: 'skip', reason: 'no_customer_email' });
  });

  it('combines matching events with paid-extra toggle', () => {
    const result = decideCustomerReport({
      ...base,
      recordedEventTypes: ['low_water_level'],
      hasPaidExtras: true,
      sendPaidExtraReport: true,
    });
    expect(result).toEqual({
      action: 'send',
      eventsToReport: ['low_water_level'],
      includePaidExtras: true,
    });
  });
});

describe('collectRecordedEvents', () => {
  it('derives filter_cleaning from cleaned_filter', () => {
    const { recordedEventTypes, hasChemicalData } = collectRecordedEvents({
      cleaned_filter: true,
      ph_level: 7.4,
    });
    expect(recordedEventTypes).toContain('filter_cleaning');
    expect(hasChemicalData).toBe(true);
  });

  it('keeps explicit service_event_types and detects salt additions', () => {
    const { recordedEventTypes, hasChemicalData } = collectRecordedEvents({
      service_event_types: ['o_ring_replacement', 'salt_addition'],
      other_chemicals: '1 bag salt',
    });
    expect(recordedEventTypes).toEqual(
      expect.arrayContaining(['o_ring_replacement', 'salt_addition']),
    );
    expect(hasChemicalData).toBe(true);
  });
});
