/** Message templates with {{merge_tag}} substitution. */

import type { IssueCategoryKey } from '@/lib/service-report';

export type MessageChannel = 'email' | 'sms';

/** Supported template locales — only `en` is active today. */
export type TemplateLocale = 'en' | 'es';

export const DEFAULT_TEMPLATE_LOCALE: TemplateLocale = 'en';

export const SUPPORTED_TEMPLATE_LOCALES: TemplateLocale[] = ['en', 'es'];

export type MessageTemplate = {
  id: string;
  company_id: string;
  channel: MessageChannel;
  locale: TemplateLocale;
  name: string;
  subject: string | null;
  body: string;
  issue_categories: IssueCategoryKey[];
  is_default: boolean;
};

export type TemplateMergeVars = {
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  property_address?: string | null;
  scheduled_date?: string | null;
  technician_name?: string | null;
  company_name?: string | null;
  issue_details?: string | null;
  issue_categories?: string | null;
};

export const TEMPLATE_TAGS = [
  'customer_name',
  'customer_email',
  'customer_phone',
  'property_address',
  'scheduled_date',
  'technician_name',
  'company_name',
  'issue_details',
  'issue_categories',
] as const;

export type TemplateTag = (typeof TEMPLATE_TAGS)[number];

const ISSUE_LABELS: Record<TemplateLocale, Record<IssueCategoryKey, string>> = {
  en: {
    motor: 'Motor',
    filter: 'Filter',
    circulation: 'Circulation',
    timer: 'Timer',
    chemistry: 'Chemistry',
    other: 'Other',
  },
  es: {
    motor: 'Motor',
    filter: 'Filtro',
    circulation: 'Circulación',
    timer: 'Timer',
    chemistry: 'Química',
    other: 'Otro',
  },
};

const ISSUE_PLACEHOLDER: Record<TemplateLocale, string> = {
  en: '[Describe the issue found here]',
  es: '[Describa aquí el issue encontrado]',
};

export function resolveTemplateLocale(value?: string | null): TemplateLocale {
  return value === 'es' ? 'es' : DEFAULT_TEMPLATE_LOCALE;
}

export function issueCategoryLabels(
  keys: IssueCategoryKey[],
  locale: TemplateLocale = DEFAULT_TEMPLATE_LOCALE,
): string[] {
  const labels = ISSUE_LABELS[locale];
  return keys.map((key) => labels[key] ?? key);
}

export function getIssueDetailsPlaceholder(locale: TemplateLocale = DEFAULT_TEMPLATE_LOCALE): string {
  return ISSUE_PLACEHOLDER[locale];
}

export function formatTemplateDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return isoDate;
  const year = match[1];
  const month = Number(match[2]);
  const day = match[3];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (month < 1 || month > 12) return isoDate;
  return `${months[month - 1]}/${day}/${year}`;
}

export const DEFAULT_EMAIL_TEMPLATE: Omit<MessageTemplate, 'id' | 'company_id'> = {
  channel: 'email',
  locale: DEFAULT_TEMPLATE_LOCALE,
  name: 'Generic follow-up',
  subject: 'Service follow-up — {{property_address}}',
  body: `Dear {{customer_name}},

Regarding the service visit at {{property_address}} on {{scheduled_date}}.

The following was noted during the visit:

{{issue_details}}

Please let us know if you have any questions or if you would like to schedule a follow-up visit.

Best regards,
{{company_name}}`,
  issue_categories: [],
  is_default: true,
};

export const DEFAULT_SMS_TEMPLATE: Omit<MessageTemplate, 'id' | 'company_id'> = {
  channel: 'sms',
  locale: DEFAULT_TEMPLATE_LOCALE,
  name: 'Generic SMS follow-up',
  subject: null,
  body:
    'Hi {{customer_name}}, {{company_name}} here about service at {{property_address}} ({{scheduled_date}}). Noted: {{issue_details}}. Any questions?',
  issue_categories: [],
  is_default: true,
};

export function formatSmsForClipboard(body: string): string {
  return body
    .replace(/[ \t]*\n+[ \t]*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function formatTemplateForClipboard(
  channel: MessageChannel,
  subject: string | null,
  body: string,
): string {
  return channel === 'sms' ? formatSmsForClipboard(body) : formatEmailForClipboard(subject, body);
}

export function normalizeTemplateRow(row: Record<string, unknown>): MessageTemplate {
  const rawCategories = row.issue_categories;
  const issue_categories = Array.isArray(rawCategories)
    ? rawCategories.filter((k): k is IssueCategoryKey => typeof k === 'string')
    : [];

  return {
    id: String(row.id),
    company_id: String(row.company_id),
    channel: row.channel === 'sms' ? 'sms' : 'email',
    locale: resolveTemplateLocale(row.locale != null ? String(row.locale) : null),
    name: String(row.name),
    subject: row.subject != null ? String(row.subject) : null,
    body: String(row.body),
    issue_categories,
    is_default: Boolean(row.is_default),
  };
}

/** One template → many issues: pick the most specific match, else default (scoped by locale). */
export function selectMessageTemplate(
  templates: MessageTemplate[],
  channel: MessageChannel,
  issueCategories: string[],
  locale: TemplateLocale = DEFAULT_TEMPLATE_LOCALE,
): MessageTemplate | null {
  const forChannel = templates.filter((t) => t.channel === channel && t.locale === locale);
  if (!forChannel.length) return null;

  if (issueCategories.length > 0) {
    const matches = forChannel.filter((t) =>
      t.issue_categories.some((cat) => issueCategories.includes(cat)),
    );
    if (matches.length) {
      return matches.sort((a, b) => b.issue_categories.length - a.issue_categories.length)[0];
    }
  }

  return (
    forChannel.find((t) => t.is_default) ??
    forChannel.find((t) => t.issue_categories.length === 0) ??
    forChannel[0]
  );
}

export function renderTemplate(
  text: string,
  vars: TemplateMergeVars,
  locale: TemplateLocale = DEFAULT_TEMPLATE_LOCALE,
): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => {
    const normalized = key.toLowerCase() as TemplateTag;
    const value = vars[normalized];
    if (value != null && String(value).trim() !== '') return String(value).trim();
    if (normalized === 'issue_details') return getIssueDetailsPlaceholder(locale);
    return '';
  });
}

export function formatEmailForClipboard(subject: string | null, body: string): string {
  const trimmedSubject = subject?.trim();
  if (!trimmedSubject) return body;
  return `Subject: ${trimmedSubject}\n\n${body}`;
}

export function buildIssueDetailsInput(options: {
  issueCategoryLabels: string[];
  followUpNotes?: string | null;
  /** Single-line flow for SMS; paragraphs for email. */
  inline?: boolean;
  locale?: TemplateLocale;
}): string {
  const locale = options.locale ?? DEFAULT_TEMPLATE_LOCALE;
  const parts: string[] = [];
  if (options.issueCategoryLabels.length) {
    parts.push(options.issueCategoryLabels.join(', '));
  }
  if (options.followUpNotes?.trim()) {
    const note = options.followUpNotes.trim();
    parts.push(options.inline ? note.replace(/\s+/g, ' ') : note);
  }
  if (parts.length) {
    return options.inline ? parts.join('. ') : parts.join('\n\n');
  }
  return getIssueDetailsPlaceholder(locale);
}
