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

/**
 * Update a property. Caller must belong to the same company (enforced by RLS).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.company_id) {
    return NextResponse.json(
      { error: 'User profile or company not found.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      customer_name,
      address,
      customer_email,
      customer_phone,
      city,
      state,
      zip,
      gate_code,
      pool_type,
      pool_surface,
      equipment_notes,
      notes,
      is_active,
    } = body;

    if (!customer_name || !address) {
      return NextResponse.json(
        { error: 'customer_name and address are required' },
        { status: 400 }
      );
    }

    const client = supabase as unknown as CaicosSupabaseClient;
    const { data, error } = await client
      .from('caicos_properties')
      .update({
        customer_name: String(customer_name).trim(),
        address: String(address).trim(),
        customer_email: customer_email ? String(customer_email).trim() : null,
        customer_phone: customer_phone ? String(customer_phone).trim() : null,
        city: city ? String(city).trim() : null,
        state: state ? String(state).trim() : null,
        zip: zip ? String(zip).trim() : null,
        gate_code: gate_code ? String(gate_code).trim() : null,
        pool_type: ['residential', 'commercial', 'spa', 'other'].includes(pool_type) ? pool_type : null,
        pool_surface: ['plaster', 'pebble', 'tile', 'vinyl', 'fiberglass', 'other'].includes(pool_surface) ? pool_surface : null,
        equipment_notes: equipment_notes ? String(equipment_notes).trim() : null,
        notes: notes ? String(notes).trim() : null,
        is_active: is_active !== false,
      })
      .eq('id', id)
      .eq('company_id', profile.company_id)
      .select('id, customer_name, address, city, is_active, updated_at')
      .single();

    if (error) {
      console.error('Supabase error updating property:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('PUT /api/properties/[id] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
