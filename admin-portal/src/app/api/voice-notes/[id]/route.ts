import { NextRequest, NextResponse } from 'next/server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { createVoiceNotesRouteClient } from '@/lib/voice-notes/auth';
import { markVoiceNoteProblemOpen } from '@/lib/voice-notes/open-problems';

const OFFICE_ROLES = new Set(['owner', 'admin', 'operations']);

/**
 * PATCH /api/voice-notes/[id] — admin correction of category/urgency.
 * Keeps model_* columns; sets corrected_by / corrected_at.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: noteId } = await params;
  const { supabase, user } = await createVoiceNotesRouteClient(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;

  const { data: profile } = await client
    .from('cadenza_profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.company_id || !OFFICE_ROLES.has(String(profile.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { category?: string; urgency?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const category = body.category?.trim();
  if (category !== 'problem' && category !== 'routine') {
    return NextResponse.json(
      { error: 'category must be problem or routine' },
      { status: 400 },
    );
  }

  let urgency: string | null = null;
  if (category === 'problem') {
    const u = body.urgency == null ? 'medium' : String(body.urgency);
    if (u !== 'low' && u !== 'medium' && u !== 'high') {
      return NextResponse.json(
        { error: 'urgency must be low, medium, or high' },
        { status: 400 },
      );
    }
    urgency = u;
  }

  const { data: existing, error: loadErr } = await client
    .from('cadenza_job_voice_notes')
    .select('id, company_id')
    .eq('id', noteId)
    .maybeSingle();

  if (loadErr || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (String(existing.company_id) !== String(profile.company_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: updated, error: updateErr } = await client
    .from('cadenza_job_voice_notes')
    .update({
      category,
      urgency,
      corrected_by: user.id,
      corrected_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select('*')
    .single();

  if (updateErr) {
    console.error('PATCH voice-notes error:', updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // KAN-153: a note corrected to "problem" joins the open-issue list; "routine" leaves it
  // through the category filter, so no status change is needed there.
  if (category === 'problem') {
    await markVoiceNoteProblemOpen(noteId, supabase);
    return NextResponse.json({
      ...(updated as Record<string, unknown>),
      follow_up_status:
        (updated as { follow_up_status?: string | null }).follow_up_status ?? 'open',
    });
  }

  return NextResponse.json(updated);
}
