import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    const { data: profile } = await supabase
      .from('caicos_profiles')
      .select('company_id, role, full_name, is_active')
      .eq('id', user.id)
      .maybeSingle();

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
        profile: profile ?? null,
      },
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
