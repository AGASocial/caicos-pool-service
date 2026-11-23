import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import {
  DEFAULT_AUTO_SEND_EVENT_TYPES,
  parseAutoSendEventTypes,
  ROUTINE_AUTO_SEND_EVENT_TYPES,
} from '@/lib/customer-reports/types';

const OFFICE_ROLES = new Set(['owner', 'admin', 'operations']);

async function loadProfile(client: CadenzaSupabaseClient, userId: string) {
  const { data, error } = await client
    .from('cadenza_profiles')
    .select('company_id, role')
    .eq('id', userId)
    .single();
  if (error || !data?.company_id) return null;
  return data as { company_id: string; role: string };
}

export async function GET() {
  const { supabase, user } = await createAuthenticatedRouteClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;
  const profile = await loadProfile(client, user.id);
  if (!profile) {
    return NextResponse.json({ error: 'Company not found' }, { status: 403 });
  }

  const { data, error } = await client
    .from('cadenza_customer_report_settings')
    .select('company_id, auto_send_event_types, updated_at')
    .eq('company_id', profile.company_id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    company_id: profile.company_id,
    auto_send_event_types: data?.auto_send_event_types
      ? parseAutoSendEventTypes(data.auto_send_event_types)
      : [...DEFAULT_AUTO_SEND_EVENT_TYPES],
    updated_at: data?.updated_at ?? null,
    available_event_types: [...ROUTINE_AUTO_SEND_EVENT_TYPES],
  });
}

export async function PUT(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;
  const profile = await loadProfile(client, user.id);
  if (!profile) {
    return NextResponse.json({ error: 'Company not found' }, { status: 403 });
  }
  if (!OFFICE_ROLES.has(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawTypes =
    body && typeof body === 'object' && 'auto_send_event_types' in body
      ? (body as { auto_send_event_types: unknown }).auto_send_event_types
      : undefined;

  if (!Array.isArray(rawTypes)) {
    return NextResponse.json(
      { error: 'auto_send_event_types must be an array' },
      { status: 400 },
    );
  }

  const auto_send_event_types = parseAutoSendEventTypes(rawTypes);

  const { data, error } = await client
    .from('cadenza_customer_report_settings')
    .upsert(
      {
        company_id: profile.company_id,
        auto_send_event_types,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id' },
    )
    .select('company_id, auto_send_event_types, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    company_id: data.company_id,
    auto_send_event_types: parseAutoSendEventTypes(data.auto_send_event_types),
    updated_at: data.updated_at,
    available_event_types: [...ROUTINE_AUTO_SEND_EVENT_TYPES],
  });
}
