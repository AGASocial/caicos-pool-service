/** Known machine reasons that have a translated label (`reportDeliveries_reason_*`). */
export const KNOWN_DELIVERY_REASONS = [
  'no_customer_email',
  'chemicals_only',
  'paid_extra_report_disabled',
  'no_auto_send_events',
  'auto_send_disabled',
  'resend_api_key_missing',
  'auto_retry_limit',
] as const;

export function translateDeliveryReason(
  t: (key: string) => string,
  reason: string | null | undefined,
): string | null {
  if (!reason) return null;
  return (KNOWN_DELIVERY_REASONS as readonly string[]).includes(reason)
    ? t(`reportDeliveries_reason_${reason}`)
    : reason;
}
