/**
 * @jest-environment node
 */
import { isOverMonthlyCap } from '../cap';

describe('voice-notes cap', () => {
  it('is over when month-to-date reaches cap', () => {
    expect(isOverMonthlyCap(4.99, 5)).toBe(false);
    expect(isOverMonthlyCap(5, 5)).toBe(true);
    expect(isOverMonthlyCap(5.01, 5)).toBe(true);
  });
});
