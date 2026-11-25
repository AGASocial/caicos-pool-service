import { NextRequest, NextResponse } from 'next/server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { createVoiceNotesRouteClient } from '@/lib/voice-notes/auth';
import { VOICE_NOTES_BUCKET } from '@/lib/voice-notes/types';

const OFFICE_ROLES = new Set(['owner', 'admin', 'operations']);

function mapNote(
  row: Record<string, unknown>,
  signedUrl: string | null,
) {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    job_id: String(row.job_id),
    property_id: row.property_id != null ? String(row.property_id) : null,
    created_by: String(row.created_by),
    storage_path: String(row.storage_path),
    duration_ms: row.duration_ms != null ? Number(row.duration_ms) : null,
    size_bytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    mime_type: row.mime_type != null ? String(row.mime_type) : null,
    status: String(row.status),
    transcript: row.transcript != null ? String(row.transcript) : null,
    language: row.language != null ? String(row.language) : null,
    transcribed_at: row.transcribed_at != null ? String(row.transcribed_at) : null,
    model_category: row.model_category != null ? String(row.model_category) : null,
    model_urgency: row.model_urgency != null ? String(row.model_urgency) : null,
    model_reason: row.model_reason != null ? String(row.model_reason) : null,
    model_explanation:
      row.model_explanation != null ? String(row.model_explanation) : null,
    category: row.category != null ? String(row.category) : null,
    urgency: row.urgency != null ? String(row.urgency) : null,
    corrected_by: row.corrected_by != null ? String(row.corrected_by) : null,
    corrected_at: row.corrected_at != null ? String(row.corrected_at) : null,
    cost_usd: row.cost_usd != null ? Number(row.cost_usd) : null,
    attempts: Number(row.attempts ?? 0),
    last_error: row.last_error != null ? String(row.last_error) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    signed_url: signedUrl,
  };
}

/**
 * GET /api/jobs/[id]/voice-notes — list notes with signed playback URLs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const { supabase, user } = await createVoiceNotesRouteClient(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;
  const q = request.nextUrl.searchParams.get('q')?.trim();

  let query = client
    .from('cadenza_job_voice_notes')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (q) {
    // Prefer full-text when available; fall back to ilike on transcript.
    query = query.ilike('transcript', `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('GET voice-notes error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const paths = rows
    .map((r) => String(r.storage_path ?? ''))
    .filter(Boolean);

  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error: signErr } = await supabase.storage
      .from(VOICE_NOTES_BUCKET)
      .createSignedUrls(paths, 3600);
    if (signErr) {
      console.error('voice-notes signed urls error:', signErr.message);
    } else {
      for (const item of signed ?? []) {
        if (item.path && item.signedUrl) {
          urlByPath.set(item.path, item.signedUrl);
        }
      }
    }
  }

  return NextResponse.json(
    rows.map((row) =>
      mapNote(row, urlByPath.get(String(row.storage_path)) ?? null),
    ),
  );
}

/**
 * POST /api/jobs/[id]/voice-notes — register an uploaded note (idempotent on id).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
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

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: job, error: jobErr } = await client
    .from('cadenza_service_jobs')
    .select('id, company_id, property_id, technician_id')
    .eq('id', jobId)
    .maybeSingle();

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (String(job.company_id) !== String(profile.company_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const isOffice = OFFICE_ROLES.has(String(profile.role));
  const isTech = String(job.technician_id) === user.id;
  if (!isOffice && !isTech) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: {
    id?: string;
    storage_path?: string;
    duration_ms?: number;
    size_bytes?: number;
    mime_type?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const noteId = body.id?.trim();
  const storagePath = body.storage_path?.trim();
  if (!noteId || !storagePath) {
    return NextResponse.json(
      { error: 'id and storage_path are required' },
      { status: 400 },
    );
  }

  const expectedPrefix = `${profile.company_id}/${jobId}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'Invalid storage_path' }, { status: 400 });
  }

  // Idempotent: if already registered, return existing.
  const { data: existing } = await client
    .from('cadenza_job_voice_notes')
    .select('*')
    .eq('id', noteId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(mapNote(existing as Record<string, unknown>, null), {
      status: 200,
    });
  }

  const insertRow = {
    id: noteId,
    company_id: profile.company_id,
    job_id: jobId,
    property_id: job.property_id ?? null,
    created_by: user.id,
    storage_path: storagePath,
    duration_ms: body.duration_ms ?? null,
    size_bytes: body.size_bytes ?? null,
    mime_type: body.mime_type ?? 'audio/mp4',
    status: 'uploaded',
  };

  const { data: inserted, error: insertErr } = await client
    .from('cadenza_job_voice_notes')
    .insert(insertRow)
    .select('*')
    .single();

  if (insertErr) {
    // Race: another request inserted the same id
    if (insertErr.code === '23505') {
      const { data: again } = await client
        .from('cadenza_job_voice_notes')
        .select('*')
        .eq('id', noteId)
        .maybeSingle();
      if (again) {
        return NextResponse.json(mapNote(again as Record<string, unknown>, null));
      }
    }
    console.error('POST voice-notes error:', insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json(mapNote(inserted as Record<string, unknown>, null), {
    status: 201,
  });
}
