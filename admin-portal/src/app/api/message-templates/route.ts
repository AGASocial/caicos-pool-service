import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { DEFAULT_TEMPLATE_LOCALE, normalizeTemplateRow } from '@/lib/message-templates';
import {
  MESSAGE_TEMPLATE_SELECT,
  clearChannelDefault,
  isOfficeRole,
  parseChannel,
  parseIssueCategories,
  parseTemplateLocale,
} from '@/lib/message-templates-api';

export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;
  const channelParam = request.nextUrl.searchParams.get('channel');
  const channel = channelParam ? parseChannel(channelParam) : null;
  const locale = parseTemplateLocale(
    request.nextUrl.searchParams.get('locale') ?? DEFAULT_TEMPLATE_LOCALE,
  );

  let query = client
    .from('cadenza_message_templates')
    .select(MESSAGE_TEMPLATE_SELECT)
    .eq('locale', locale)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (channel) {
    query = query.eq('channel', channel);
  }

  const { data, error } = await query;
  if (error) {
    console.error('GET message-templates error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map((row) => normalizeTemplateRow(row as Record<string, unknown>)));
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;

  const { data: profile } = await client
    .from('cadenza_profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.company_id || !isOfficeRole(String(profile.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const channel = parseChannel(body.channel);
  const locale = parseTemplateLocale(body.locale ?? DEFAULT_TEMPLATE_LOCALE);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const templateBody = typeof body.body === 'string' ? body.body.trim() : '';
  const subject =
    body.subject == null || body.subject === ''
      ? null
      : String(body.subject).trim();
  const issueCategories = parseIssueCategories(body.issue_categories) ?? [];
  const isDefault = Boolean(body.is_default);

  if (!channel) {
    return NextResponse.json({ error: 'channel must be email or sms' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!templateBody) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 });
  }
  if (channel === 'email' && !subject) {
    return NextResponse.json({ error: 'subject is required for email templates' }, { status: 400 });
  }
  if (isDefault && issueCategories.length > 0) {
    return NextResponse.json(
      { error: 'Default templates cannot be linked to specific issue types' },
      { status: 400 },
    );
  }

  try {
    if (isDefault) {
      await clearChannelDefault(client, profile.company_id, channel, locale);
    }

    const { data, error } = await client
      .from('cadenza_message_templates')
      .insert({
        company_id: profile.company_id,
        channel,
        locale,
        name,
        subject: channel === 'sms' ? null : subject,
        body: templateBody,
        issue_categories: issueCategories,
        is_default: isDefault,
      })
      .select(MESSAGE_TEMPLATE_SELECT)
      .single();

    if (error) {
      console.error('POST message-templates error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(normalizeTemplateRow(data as Record<string, unknown>), { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
