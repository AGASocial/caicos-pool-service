/**
 * @jest-environment node
 */
jest.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: {} }));
jest.mock('../mailer', () => ({ sendCustomerReportEmail: jest.fn() }));

import { isCustomerAutoReportsEnabled } from '../process';

describe('isCustomerAutoReportsEnabled (customer email kill switch)', () => {
  const original = process.env.CUSTOMER_AUTO_REPORTS_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.CUSTOMER_AUTO_REPORTS_ENABLED;
    else process.env.CUSTOMER_AUTO_REPORTS_ENABLED = original;
  });

  it('is off by default', () => {
    delete process.env.CUSTOMER_AUTO_REPORTS_ENABLED;
    expect(isCustomerAutoReportsEnabled()).toBe(false);
  });

  it('is off for any value other than "true"', () => {
    process.env.CUSTOMER_AUTO_REPORTS_ENABLED = 'yes';
    expect(isCustomerAutoReportsEnabled()).toBe(false);
  });

  it('is on only when explicitly "true"', () => {
    process.env.CUSTOMER_AUTO_REPORTS_ENABLED = ' TRUE ';
    expect(isCustomerAutoReportsEnabled()).toBe(true);
  });
});
