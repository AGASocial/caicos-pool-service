import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { getBillingService } from '@/lib/billing/server';
import { entitlementError, hasEntitlement } from '@/lib/entitlements';

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

  const client = supabase as unknown as CadenzaSupabaseClient;
  const { data: profile } = await client
    .from('cadenza_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!hasEntitlement(profile?.role as string | undefined, 'team', 'view')) {
    return NextResponse.json(entitlementError('team', 'view'), { status: 403 });
  }

  const { data, error } = await client
    .from('cadenza_invite_codes')
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

  const { data: profile, error: profileError } = await (supabase as unknown as CadenzaSupabaseClient)
    .from('cadenza_profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.company_id) {
    return NextResponse.json(
      { error: 'User profile or company not found.' },
      { status: 403 }
    );
  }

  if (!hasEntitlement(profile.role as string | undefined, 'team', 'create')) {
    return NextResponse.json(entitlementError('team', 'create'), { status: 403 });
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
      
      // For free plan, check max_technicians feature limit
      // For paid plans (per_technician pricing), check subscription.quantity
      let maxTechnicians = 3; // Free plan default
      let isPerSeatPlan = false;
      
      if (subscription) {
        const plan = await billingService.getPlan(subscription.planId);
        const pricingModel = (plan as unknown as { pricing_model?: string }).pricing_model;
        
        if (pricingModel === 'per_technician') {
          // Per-seat plan: limit is subscription.quantity
          maxTechnicians = subscription.quantity || 1;
          isPerSeatPlan = true;
        } else {
          // Flat plan: limit is from plan features
          maxTechnicians = (plan.features as { max_technicians?: number })?.max_technicians ?? 3;
        }
      }

      // Count active technicians in company
      const { count, error: countError } = await (supabase as unknown as CadenzaSupabaseClient)
        .from('cadenza_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('role', 'technician')
        .eq('is_active', true);

      if (!countError && maxTechnicians !== -1 && (count ?? 0) >= maxTechnicians) {
        return NextResponse.json(
          {
            error: isPerSeatPlan
              ? `Technician seat limit reached. You have ${maxTechnicians} seat(s). Please upgrade to add more technicians.`
              : `Technician limit reached for your plan (${maxTechnicians} max).`,
            code: 'TECHNICIAN_LIMIT_REACHED',
            max: maxTechnicians,
            isPerSeat: isPerSeatPlan,
          },
          { status: 403 }
        );
      }
    }

    const expiresInDays = Math.min(90, Math.max(1, Number(body.expires_in_days) || DEFAULT_EXPIRES_DAYS));

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await (supabase as unknown as CadenzaSupabaseClient)
      .from('cadenza_invite_codes')
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
