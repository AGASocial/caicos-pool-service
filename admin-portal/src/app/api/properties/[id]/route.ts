import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_properties')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error?.message || 'Not found' }, { status: 500 });
  }

  return NextResponse.json(data);
}
