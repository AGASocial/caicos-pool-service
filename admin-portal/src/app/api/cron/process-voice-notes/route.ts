import { NextRequest, NextResponse } from 'next/server';
import { processPendingVoiceNotes } from '@/lib/voice-notes/process';

/**
 * GET /api/cron/process-voice-notes
 * Secured with Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processPendingVoiceNotes(20);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('process-voice-notes failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Voice note processing failed',
      },
      { status: 500 },
    );
  }
}
