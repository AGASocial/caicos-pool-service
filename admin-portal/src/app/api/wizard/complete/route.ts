import { NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';

/**
 * Placeholder onboarding completion endpoint.
 * Extend this route when the wizard collects Cadenza setup data (company, properties, team, etc.).
 */
export async function POST() {
  const { user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
