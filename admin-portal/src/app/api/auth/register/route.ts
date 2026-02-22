import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function getAppOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  if (origin) return origin;

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';

  if (!host) {
    throw new Error('Cannot resolve host for auth redirect');
  }

  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body. Send JSON with email, password, and optionally fullName, locale, invite.' },
        { status: 400 }
      );
    }
    const { email, password, fullName, locale, invite: inviteCode } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const safeLocale = typeof locale === 'string' && locale ? locale : 'en';
    const origin = getAppOrigin(request);
    const emailRedirectTo = `${origin}/api/auth/callback?next=${encodeURIComponent(`/${safeLocale}`)}`;

    const userMetadata: Record<string, string> = {
      full_name: typeof fullName === 'string' ? fullName : '',
    };

    if (inviteCode && typeof inviteCode === 'string' && inviteCode.trim()) {
      const code = inviteCode.trim();
      const { data: invite, error: inviteError } = await supabaseAdmin
        .from('caicos_invite_codes')
        .select('company_id, role')
        .eq('code', code)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (inviteError || !invite) {
        if (inviteError) {
          console.error('Invite code lookup failed:', inviteError.code, inviteError.message);
        }
        return NextResponse.json(
          { error: 'Invalid or expired invite code. Ask your admin for a new link.' },
          { status: 400 }
        );
      }

      const companyId = invite.company_id != null ? String(invite.company_id) : '';
      const role = (invite.role === 'admin' ? 'admin' : 'technician') as string;
      if (companyId && /^[0-9a-f-]{36}$/i.test(companyId)) {
        userMetadata.company_id = companyId;
        userMetadata.role = role;
      }
    }

    const supabase = await createRouteClient();
    const { error } = await supabase.auth.signUp({
      email: String(email),
      password: String(password),
      options: {
        data: userMetadata,
        emailRedirectTo,
      },
    });

    if (error) {
      console.error('Supabase signUp error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (inviteCode && typeof inviteCode === 'string' && inviteCode.trim()) {
      await supabaseAdmin
        .from('caicos_invite_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('code', inviteCode.trim());
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
