import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import type { IssueCategoryKey } from '@/lib/service-report';
import { ISSUE_CATEGORY_KEYS } from '@/lib/service-report';
import type { MessageChannel, TemplateLocale } from '@/lib/message-templates';
import { resolveTemplateLocale } from '@/lib/message-templates';

export { isOfficeRole } from '@/lib/entitlements';

export function parseIssueCategories(raw: unknown): IssueCategoryKey[] | null {
  if (!Array.isArray(raw)) return null;
  const filtered = raw.filter(
    (k): k is IssueCategoryKey =>
      typeof k === 'string' && ISSUE_CATEGORY_KEYS.includes(k as IssueCategoryKey),
  );
  return filtered;
}

export function parseChannel(raw: unknown): MessageChannel | null {
  return raw === 'email' || raw === 'sms' ? raw : null;
}

export function parseTemplateLocale(raw: unknown): TemplateLocale {
  return resolveTemplateLocale(typeof raw === 'string' ? raw : null);
}

export async function clearChannelDefault(
  client: CadenzaSupabaseClient,
  companyId: string,
  channel: MessageChannel,
  locale: TemplateLocale,
  exceptId?: string,
) {
  let query = client
    .from('cadenza_message_templates')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .eq('channel', channel)
    .eq('locale', locale)
    .eq('is_default', true);

  if (exceptId) {
    query = query.neq('id', exceptId);
  }

  const { error } = await query;
  if (error) throw error;
}

export const MESSAGE_TEMPLATE_SELECT =
  'id, company_id, channel, locale, name, subject, body, issue_categories, is_default, created_at, updated_at';
