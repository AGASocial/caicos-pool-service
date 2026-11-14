/**
 * Active payment gateway name. Defaults to Stripe; PayU remains selectable via env.
 */
export function getConfiguredPaymentGatewayName(): string {
  return process.env.NEXT_PUBLIC_PAYMENT_GATEWAY || 'stripe';
}
