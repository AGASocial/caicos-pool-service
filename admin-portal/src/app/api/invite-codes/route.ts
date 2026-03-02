import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';
import { getBillingService } from '@/lib/billing/server';

const DEFAULT_EXPIRES_DAYS = 7;
const CODE_LENGTH = 12;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

/**
 * List invite codes for the current user's company.
 */
export async function GET() {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_invite_codes')
    .select('code, role, expires_at, used_at, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase error fetching invite codes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

/**
 * Create an invite code. Role must be 'technician', 'admin', or 'operations'.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.company_id) {
    return NextResponse.json(
      { error: 'User profile or company not found.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const roleInput = body.role;
    const role = (roleInput === 'admin' || roleInput === 'operations') ? roleInput : 'technician';

    // Only owners can create invite codes for new admins; admins cannot create other admins.
    if (role === 'admin' && profile.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only company owners can invite new admins.' },
        { status: 403 }
      );
    }

    // Enforce technician limit from plan when inviting a technician
    if (role === 'technician') {
      const billingService = await getBillingService();
      const subscription = await billingService.getUserSubscription(user.id);
      const isExpired = subscription?.currentPeriodEnd && subscription.currentPeriodEnd < new Date();
      const plan = subscription && !isExpired
        ? await billingService.getPlan(subscription.planId)
        : await billingService.getPlan('plan_free');
      const maxTechnicians = (plan.features as { max_technicians?: number; max_users?: number })?.max_technicians
        ?? (plan.features as { max_technicians?: number; max_users?: number })?.max_users
        ?? 0;
      if (maxTechnicians !== -1) {
        const { count, error: countError } = await (supabase as unknown as CaicosSupabaseClient)
          .from('caicos_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', profile.company_id)
          .eq('role', 'technician');
        if (!countError && (count ?? 0) >= maxTechnicians) {
          return NextResponse.json(
            { error: 'Technician limit reached.', code: 'TECHNICIAN_LIMIT_REACHED', max: maxTechnicians },
            { status: 403 }
          );
        }
      }
    }

    const expiresInDays = Math.min(90, Math.max(1, Number(body.expires_in_days) || DEFAULT_EXPIRES_DAYS));

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await (supabase as unknown as CaicosSupabaseClient)
      .from('caicos_invite_codes')
      .insert({
        code,
        company_id: profile.company_id,
        role,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select('code, role, expires_at, created_at')
      .single();

    if (!error) {
      return NextResponse.json(data);
    }
    if (error.code === '23505') {
      code = generateCode();
      continue;
    }
    console.error('Supabase error creating invite code:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });
  } catch (e) {
    console.error('POST /api/invite-codes error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
