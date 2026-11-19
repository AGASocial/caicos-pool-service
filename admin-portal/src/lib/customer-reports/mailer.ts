/**
 * Customer visit report emails via Resend.
 * Never throws; missing RESEND_API_KEY → log + no-op. Never logs the API key.
 *
 * Resend is loaded lazily so importing this module does not pull postal-mime
 * into jsdom unit tests that only mock the mailer.
 */

import type { RoutineAutoSendEventType } from './types';

export type CustomerReportMailLocale = 'en' | 'es';

export type SendCustomerReportEmailParams = {
  to: string;
  locale?: CustomerReportMailLocale | string | null;
  customerName: string;
  propertyAddress: string;
  companyName: string;
  scheduledDate: string;
  technicianName?: string | null;
  eventsToReport: readonly RoutineAutoSendEventType[];
  includePaidExtras: boolean;
  /** Idempotency: typically customer-report/{jobId} */
  idempotencyKey?: string;
};

export type SendCustomerReportEmailResult = {
  ok: boolean;
  messageId?: string | null;
  skipped?: boolean;
  error?: string;
};

const EVENT_LABELS: Record<
  RoutineAutoSendEventType,
  { en: string; es: string }
> = {
  filter_change: { en: 'Filter change', es: 'Cambio de filtro' },
  o_ring_replacement: { en: 'O-ring replacement', es: 'Reemplazo de o-ring' },
  filter_cleaning: { en: 'Filter cleaning', es: 'Limpieza de filtro' },
  low_water_level: { en: 'Low water level', es: 'Nivel de agua bajo' },
};

function normalizeLocale(locale?: string | null): CustomerReportMailLocale {
  return locale?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function fromAddress(): string {
  return (
    process.env.REPORTS_EMAIL_FROM?.trim() ||
    'Cadenza <reports@hello.cadenzaops.com>'
  );
}

function formatEventList(
  events: readonly RoutineAutoSendEventType[],
  includePaidExtras: boolean,
  locale: CustomerReportMailLocale,
): string[] {
  const lines = events.map((e) => EVENT_LABELS[e][locale]);
  if (includePaidExtras) {
    lines.push(
      locale === 'es' ? 'Trabajo adicional facturable' : 'Billable add-on work',
    );
  }
  return lines;
}

export async function sendCustomerReportEmail(
  params: SendCustomerReportEmailParams,
): Promise<SendCustomerReportEmailResult> {
  const locale = normalizeLocale(params.locale);
  const lines = formatEventList(
    params.eventsToReport,
    params.includePaidExtras,
    locale,
  );

  const copy =
    locale === 'es'
      ? {
          subject: `Reporte de servicio — ${params.propertyAddress}`,
          greeting: `Estimado/a ${params.customerName},`,
          intro: `Completamos el servicio en ${params.propertyAddress} el ${params.scheduledDate}.`,
          tech: params.technicianName
            ? `Técnico: ${params.technicianName}.`
            : null,
          listTitle: 'Durante la visita registramos:',
          closing: `Saludos cordiales,\n${params.companyName}`,
        }
      : {
          subject: `Service report — ${params.propertyAddress}`,
          greeting: `Dear ${params.customerName},`,
          intro: `We completed service at ${params.propertyAddress} on ${params.scheduledDate}.`,
          tech: params.technicianName
            ? `Technician: ${params.technicianName}.`
            : null,
          listTitle: 'During the visit we recorded:',
          closing: `Best regards,\n${params.companyName}`,
        };

  const listText = lines.map((l) => `• ${l}`).join('\n');
  const listHtml = `<ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`;

  const text = [
    copy.greeting,
    '',
    copy.intro,
    copy.tech,
    '',
    copy.listTitle,
    listText,
    '',
    copy.closing,
  ]
    .filter((p) => p != null && p !== '')
    .join('\n');

  const html = [
    `<p>${copy.greeting}</p>`,
    `<p>${copy.intro}</p>`,
    copy.tech ? `<p>${copy.tech}</p>` : '',
    `<p>${copy.listTitle}</p>`,
    listHtml,
    `<p>${copy.closing.replace(/\n/g, '<br/>')}</p>`,
  ]
    .filter(Boolean)
    .join('');

  try {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
      console.warn('customer-report-mailer: RESEND_API_KEY not set; skipping send');
      return { ok: false, skipped: true, error: 'resend_api_key_missing' };
    }

    const { Resend } = await import('resend');
    const resend = new Resend(key);

    const { data, error } = await resend.emails.send(
      {
        from: fromAddress(),
        to: [params.to],
        subject: copy.subject,
        html,
        text,
      },
      params.idempotencyKey
        ? { idempotencyKey: params.idempotencyKey }
        : undefined,
    );

    if (error) {
      console.error('customer-report-mailer: send failed:', error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true, messageId: data?.id ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('customer-report-mailer: unexpected error:', message);
    return { ok: false, error: message };
  }
}
