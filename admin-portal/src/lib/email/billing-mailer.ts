/**
 * Billing transactional emails via Resend.
 * Never throws; missing RESEND_API_KEY → log + no-op. Never logs the API key.
 *
 * Resend is loaded lazily so importing this module does not pull postal-mime
 * (TextEncoder) into jsdom unit tests that only mock the mailer.
 */

import { resolveAppUrl } from '@/lib/app-url';

export type BillingMailLocale = 'en' | 'es';

export type PaymentFailedEmailParams = {
  to: string;
  locale?: BillingMailLocale | string | null;
  gracePeriodEndsAt: Date | string;
  /** Stripe/provider event id for Resend idempotency */
  eventId?: string;
};

export type TrialEndingEmailParams = {
  to: string;
  locale?: BillingMailLocale | string | null;
  trialEndsAt?: Date | string | null;
  eventId?: string;
};

export type SubscriptionCanceledEmailParams = {
  to: string;
  locale?: BillingMailLocale | string | null;
  /** Prefer subscription id so deleted is emailed once even across event retries */
  idempotencyKey?: string;
  eventId?: string;
};

function normalizeLocale(locale?: string | null): BillingMailLocale {
  return locale?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function formatDate(value: Date | string, locale: BillingMailLocale): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function billingUrl(locale: BillingMailLocale): string {
  let base = 'https://app.cadenzaops.com';
  try {
    base = resolveAppUrl();
  } catch {
    const fallback = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (fallback) base = fallback.replace(/\/+$/, '');
  }
  return `${base}/${locale}/billing`;
}

function fromAddress(): string {
  return process.env.BILLING_EMAIL_FROM?.trim() || 'Cadenza <billing@hello.cadenzaops.com>';
}

async function sendSafe(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}): Promise<boolean> {
  try {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
      console.warn('billing-mailer: RESEND_API_KEY not set; skipping send');
      return false;
    }

    const { Resend } = await import('resend');
    const resend = new Resend(key);

    const { error } = await resend.emails.send(
      {
        from: fromAddress(),
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      },
      opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
    );

    if (error) {
      console.error('billing-mailer: send failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      'billing-mailer: unexpected error:',
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export async function sendPaymentFailedEmail(
  params: PaymentFailedEmailParams,
): Promise<boolean> {
  const locale = normalizeLocale(params.locale);
  const grace = formatDate(params.gracePeriodEndsAt, locale);
  const url = billingUrl(locale);

  const copy =
    locale === 'es'
      ? {
          subject: 'Tu pago falló — actualiza tu método de pago',
          body: `Tu pago falló. Tienes hasta ${grace} para actualizar tu método de pago y mantener el acceso completo.`,
          cta: 'Actualizar método de pago',
        }
      : {
          subject: 'Payment failed — update your payment method',
          body: `Your payment failed. You have until ${grace} to update your payment method and keep full access.`,
          cta: 'Update payment method',
        };

  return sendSafe({
    to: params.to,
    subject: copy.subject,
    text: `${copy.body}\n\n${url}`,
    html: `<p>${copy.body}</p><p><a href="${url}">${copy.cta}</a></p>`,
    idempotencyKey: params.eventId
      ? `billing/payment-failed/${params.eventId}`
      : undefined,
  });
}

export async function sendTrialEndingEmail(
  params: TrialEndingEmailParams,
): Promise<boolean> {
  const locale = normalizeLocale(params.locale);
  const url = billingUrl(locale);
  const when = params.trialEndsAt
    ? formatDate(params.trialEndsAt, locale)
    : null;

  const copy =
    locale === 'es'
      ? {
          subject: 'Tu prueba de Cadenza está por terminar',
          body: when
            ? `Tu período de prueba termina el ${when}. Agrega un método de pago para continuar sin interrupciones.`
            : 'Tu período de prueba está por terminar. Agrega un método de pago para continuar sin interrupciones.',
          cta: 'Ir a facturación',
        }
      : {
          subject: 'Your Cadenza trial is ending soon',
          body: when
            ? `Your trial ends on ${when}. Add a payment method to continue without interruption.`
            : 'Your trial is ending soon. Add a payment method to continue without interruption.',
          cta: 'Go to billing',
        };

  return sendSafe({
    to: params.to,
    subject: copy.subject,
    text: `${copy.body}\n\n${url}`,
    html: `<p>${copy.body}</p><p><a href="${url}">${copy.cta}</a></p>`,
    idempotencyKey: params.eventId
      ? `billing/trial-ending/${params.eventId}`
      : undefined,
  });
}

export async function sendSubscriptionCanceledEmail(
  params: SubscriptionCanceledEmailParams,
): Promise<boolean> {
  const locale = normalizeLocale(params.locale);
  const url = billingUrl(locale);

  const copy =
    locale === 'es'
      ? {
          subject: 'Tu suscripción de Cadenza fue cancelada',
          body: 'Tu suscripción ha sido cancelada. Puedes volver a suscribirte desde la página de facturación cuando quieras.',
          cta: 'Ver facturación',
        }
      : {
          subject: 'Your Cadenza subscription was canceled',
          body: 'Your subscription has been canceled. You can resubscribe anytime from the billing page.',
          cta: 'View billing',
        };

  const idempotencyKey =
    params.idempotencyKey ||
    (params.eventId ? `billing/subscription-canceled/${params.eventId}` : undefined);

  return sendSafe({
    to: params.to,
    subject: copy.subject,
    text: `${copy.body}\n\n${url}`,
    html: `<p>${copy.body}</p><p><a href="${url}">${copy.cta}</a></p>`,
    idempotencyKey,
  });
}
