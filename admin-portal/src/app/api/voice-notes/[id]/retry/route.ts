import { NextRequest, NextResponse } from 'next/server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { createVoiceNotesRouteClient } from '@/lib/voice-notes/auth';
import { processVoiceNote } from '@/lib/voice-notes/process';
import {
  isVoiceNotesAiEnabled,
  isVoiceNotesFakeProvider,
} from '@/lib/voice-notes/models';
import type { VoiceNoteRow } from '@/lib/voice-notes/types';

const OFFICE_ROLES = new Set(['owner', 'admin', 'operations']);

/**
 * POST /api/voice-notes/[id]/retry — admin manual retry of transcription/classification.
 */
export async function POST(
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

  const { data: note, error } = await client
    .from('cadenza_job_voice_notes')
    .select('*')
    .eq('id', noteId)
    .maybeSingle();

  if (error || !note) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (String(note.company_id) !== String(profile.company_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!isVoiceNotesAiEnabled() && !isVoiceNotesFakeProvider()) {
    return NextResponse.json(
      { error: 'Voice notes AI is disabled', status: 'skipped_kill_switch' },
      { status: 409 },
    );
  }

  // Reset attempts so a manual retry can run even after prior failures.
  await client
    .from('cadenza_job_voice_notes')
    .update({ status: 'uploaded', attempts: 0, last_error: null })
    .eq('id', noteId);

  const refreshed = {
    ...(note as unknown as VoiceNoteRow),
    status: 'uploaded' as const,
    attempts: 0,
  };

  const result = await processVoiceNote(refreshed);
  return NextResponse.json({ ok: true, ...result });
}
