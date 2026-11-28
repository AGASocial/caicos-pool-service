/**
 * KAN-154: Monday open-issues digest email via Resend.
 * Never throws; missing RESEND_API_KEY → log + no-op. Never logs the API key.
 *
 * Content rule: internal-only text stays out. Voice notes appear with their classification
 * summary only; when a note has no classification text (its summary would be a raw transcript
 * excerpt) the email shows just "problem voice note" and the urgency.
 *
 * Resend is loaded lazily, like the billing mailer.
 */
import { resolveAppUrl } from '@/lib/app-url';
import { isAllowedDigestRecipient } from '@/lib/monday-digest-config';
import type { DigestIssue, DigestTechnicianGroup } from '@/lib/monday-digest';

export type DigestMailLocale = 'en' | 'es';

export type DigestSendResult = {
  sent: boolean;
  messageId: string | null;
  reason?: 'no_api_key' | 'recipient_not_allowed' | 'send_failed';
};

export type DigestEmailParams = {
  to: string;
  locale?: DigestMailLocale | string | null;
  companyId: string;
  /** Monday of the America/New_York week, `YYYY-MM-DD`. */
  weekStart: string;
  groups: DigestTechnicianGroup<DigestIssue>[];
  issueCount: number;
};

const COPY = {
  en: {
    subject: (n: number) => `Monday digest: ${n} open ${n === 1 ? 'issue' : 'issues'}`,
    intro: (n: number) => `${n} open ${n === 1 ? 'issue needs' : 'issues need'} attention, grouped by technician.`,
    unassigned: 'Unassigned',
    daysOpen: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} open`,
    serviceReport: 'Service report',
    voiceNote: 'Problem voice note',
    urgency: { low: 'low urgency', medium: 'medium urgency', high: 'high urgency' },
    openJob: 'Open job',
    viewAll: 'View all open issues',
    unknownProperty: 'Unknown property',
  },
  es: {
    subject: (n: number) => `Resumen del lunes: ${n} ${n === 1 ? 'problema abierto' : 'problemas abiertos'}`,
    intro: (n: number) =>
      `${n} ${n === 1 ? 'problema abierto requiere' : 'problemas abiertos requieren'} atención, agrupados por técnico.`,
    unassigned: 'Sin asignar',
    daysOpen: (n: number) => `${n} ${n === 1 ? 'día' : 'días'} abierto`,
    serviceReport: 'Reporte de servicio',
    voiceNote: 'Nota de voz con problema',
    urgency: { low: 'urgencia baja', medium: 'urgencia media', high: 'urgencia alta' },
    openJob: 'Abrir trabajo',
    viewAll: 'Ver todos los problemas abiertos',
    unknownProperty: 'Propiedad desconocida',
  },
} as const;

export function normalizeDigestLocale(locale?: string | null): DigestMailLocale {
  return locale?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fromAddress(): string {
  return process.env.DIGEST_EMAIL_FROM?.trim() || 'Cadenza <notifications@hello.cadenzaops.com>';
}

function appBaseUrl(): string {
  try {
    return resolveAppUrl();
  } catch {
    return 'https://app.cadenzaops.com';
  }
}

/** Issue text safe for a broad email: never a raw voice-note transcript. */
export function digestIssueSummary(issue: DigestIssue, locale: DigestMailLocale): string {
  const copy = COPY[locale];
  if (issue.source === 'voice_note') {
    const urgency = issue.urgency ? copy.urgency[issue.urgency] : null;
    const text = issue.summary_is_transcript ? null : issue.summary;
    return [text, urgency].filter(Boolean).join(' · ');
  }
  const categories = issue.issue_categories.join(', ');
  return [categories, issue.summary].filter(Boolean).join(' — ');
}

type RenderedLine = { text: string; html: string };

function renderIssue(issue: DigestIssue, locale: DigestMailLocale, baseUrl: string): RenderedLine {
  const copy = COPY[locale];
  const property = issue.property
    ? [issue.property.customer_name, issue.property.address].filter(Boolean).join(', ')
    : copy.unknownProperty;
  const kind = issue.source === 'voice_note' ? copy.voiceNote : copy.serviceReport;
  const summary = digestIssueSummary(issue, locale);
  const link = `${baseUrl}/${locale}/jobs/${encodeURIComponent(issue.job_id)}`;
  const age = copy.daysOpen(issue.days_open);
  const parts = [age, property, kind, summary].filter(Boolean);
  return {
    text: `- ${parts.join(' | ')}\n  ${link}`,
    html:
      `<li><strong>${escapeHtml(age)}</strong> — ${escapeHtml(property)}<br/>` +
      `${escapeHtml(kind)}${summary ? `: ${escapeHtml(summary)}` : ''} ` +
      `(<a href="${escapeHtml(link)}">${escapeHtml(copy.openJob)}</a>)</li>`,
  };
}

export function renderMondayDigestEmail(params: {
  locale: DigestMailLocale;
  groups: DigestTechnicianGroup<DigestIssue>[];
  issueCount: number;
  baseUrl: string;
}): { subject: string; text: string; html: string } {
  const { locale, groups, issueCount, baseUrl } = params;
  const copy = COPY[locale];
  const listUrl = `${baseUrl}/${locale}/open-issues`;

  const textBlocks: string[] = [copy.intro(issueCount)];
  const htmlBlocks: string[] = [`<p>${escapeHtml(copy.intro(issueCount))}</p>`];
  for (const group of groups) {
    const name = group.technician_name || copy.unassigned;
    const lines = group.issues.map((issue) => renderIssue(issue, locale, baseUrl));
    textBlocks.push(`${name} (${group.issues.length})\n${lines.map((l) => l.text).join('\n')}`);
    htmlBlocks.push(
      `<h3>${escapeHtml(name)} (${group.issues.length})</h3><ul>${lines.map((l) => l.html).join('')}</ul>`,
    );
  }
  textBlocks.push(`${copy.viewAll}: ${listUrl}`);
  htmlBlocks.push(`<p><a href="${escapeHtml(listUrl)}">${escapeHtml(copy.viewAll)}</a></p>`);

  return {
    subject: copy.subject(issueCount),
    text: textBlocks.join('\n\n'),
    html: htmlBlocks.join(''),
  };
}

export async function sendMondayDigestEmail(params: DigestEmailParams): Promise<DigestSendResult> {
  try {
    // Defense in depth: the runner already filters, but the sender never trusts its caller.
    if (!isAllowedDigestRecipient(params.to)) {
      console.warn('digest-mailer: recipient not allowed in this environment; skipping send');
      return { sent: false, messageId: null, reason: 'recipient_not_allowed' };
    }

    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
      console.warn('digest-mailer: RESEND_API_KEY not set; skipping send');
      return { sent: false, messageId: null, reason: 'no_api_key' };
    }

    const locale = normalizeDigestLocale(params.locale);
    const content = renderMondayDigestEmail({
      locale,
      groups: params.groups,
      issueCount: params.issueCount,
      baseUrl: appBaseUrl(),
    });

    const { Resend } = await import('resend');
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send(
      {
        from: fromAddress(),
        to: [params.to],
        subject: content.subject,
        html: content.html,
        text: content.text,
      },
      { idempotencyKey: `monday-digest/${params.companyId}/${params.weekStart}/${params.to.toLowerCase()}` },
    );

    if (error) {
      console.error('digest-mailer: send failed:', error.message);
      return { sent: false, messageId: null, reason: 'send_failed' };
    }
    return { sent: true, messageId: data?.id ?? null };
  } catch (err) {
    console.error('digest-mailer: unexpected error:', err instanceof Error ? err.message : err);
    return { sent: false, messageId: null, reason: 'send_failed' };
  }
}
