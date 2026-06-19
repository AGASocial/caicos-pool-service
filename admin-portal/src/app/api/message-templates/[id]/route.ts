import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { normalizeTemplateRow } from '@/lib/message-templates';
import {
  MESSAGE_TEMPLATE_SELECT,
  clearChannelDefault,
  isOfficeRole,
  parseIssueCategories,
  parseTemplateLocale,
} from '@/lib/message-templates-api';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const { data: existing, error: fetchErr } = await client
    .from('cadenza_message_templates')
    .select(MESSAGE_TEMPLATE_SELECT)
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const row = existing as Record<string, unknown>;
  const channel = row.channel === 'sms' ? 'sms' : 'email';
  const locale = parseTemplateLocale(row.locale != null ? String(row.locale) : null);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    updates.name = name;
  }
  if (body.body !== undefined) {
    const templateBody = String(body.body).trim();
    if (!templateBody) return NextResponse.json({ error: 'body cannot be empty' }, { status: 400 });
    updates.body = templateBody;
  }
  if (body.subject !== undefined && channel === 'email') {
    const subject = body.subject == null ? null : String(body.subject).trim();
    if (!subject) return NextResponse.json({ error: 'subject is required for email' }, { status: 400 });
    updates.subject = subject;
  }
  if (body.issue_categories !== undefined) {
    const categories = parseIssueCategories(body.issue_categories);
    if (!categories) {
      return NextResponse.json({ error: 'issue_categories must be an array' }, { status: 400 });
    }
    updates.issue_categories = categories;
  }
  if (body.is_default !== undefined) {
    updates.is_default = Boolean(body.is_default);
  }

  const nextCategories =
    (updates.issue_categories as string[] | undefined) ??
    (Array.isArray(row.issue_categories) ? row.issue_categories : []);
  const nextIsDefault =
    updates.is_default !== undefined ? Boolean(updates.is_default) : Boolean(row.is_default);

  if (nextIsDefault && nextCategories.length > 0) {
    return NextResponse.json(
      { error: 'Default templates cannot be linked to specific issue types' },
      { status: 400 },
    );
  }

  try {
    if (nextIsDefault) {
      await clearChannelDefault(client, profile.company_id, channel, locale, id);
    }

    const { data, error } = await client
      .from('cadenza_message_templates')
      .update(updates)
      .eq('id', id)
      .select(MESSAGE_TEMPLATE_SELECT)
      .single();

    if (error) {
      console.error('PATCH message-templates error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(normalizeTemplateRow(data as Record<string, unknown>));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const { error } = await client.from('cadenza_message_templates').delete().eq('id', id);
  if (error) {
    console.error('DELETE message-templates error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
