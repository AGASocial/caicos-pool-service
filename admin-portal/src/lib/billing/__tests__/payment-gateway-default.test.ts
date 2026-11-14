import { getConfiguredPaymentGatewayName } from '../payment-gateway-name';

describe('getConfiguredPaymentGatewayName', () => {
  const original = process.env.NEXT_PUBLIC_PAYMENT_GATEWAY;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_PAYMENT_GATEWAY;
    } else {
      process.env.NEXT_PUBLIC_PAYMENT_GATEWAY = original;
    }
  });

  it('defaults to stripe when NEXT_PUBLIC_PAYMENT_GATEWAY is unset', () => {
    delete process.env.NEXT_PUBLIC_PAYMENT_GATEWAY;
    expect(getConfiguredPaymentGatewayName()).toBe('stripe');
  });

  it('keeps payu when explicitly configured', () => {
    process.env.NEXT_PUBLIC_PAYMENT_GATEWAY = 'payu';
    expect(getConfiguredPaymentGatewayName()).toBe('payu');
  });

  it('keeps stripe when explicitly configured', () => {
    process.env.NEXT_PUBLIC_PAYMENT_GATEWAY = 'stripe';
    expect(getConfiguredPaymentGatewayName()).toBe('stripe');
  });
});
