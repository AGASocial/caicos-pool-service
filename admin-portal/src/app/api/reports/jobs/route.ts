import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve company_id for the authenticated user
  const { data: profile, error: profileError } = await (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.company_id) {
    console.error('Error fetching profile for reports:', profileError);
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const { company_id } = profile;

  // Parse optional date range query params
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  let query = (supabase as unknown as CaicosSupabaseClient)
    .from('caicos_service_jobs')
    .select('id, status, technician_id, technician:caicos_profiles!technician_id(id, full_name)')
    .eq('company_id', company_id);

  if (dateFrom) {
    query = query.gte('scheduled_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('scheduled_date', dateTo);
  }

  const { data: jobs, error } = await query;

  if (error) {
    console.error('Error fetching jobs for report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = jobs.length;

  const byStatus: Record<string, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    skipped: 0,
    cancelled: 0,
  };

  for (const job of jobs) {
    const s = job.status as string;
    if (s in byStatus) {
      byStatus[s]++;
    }
  }

  const completionRate = total > 0 ? Number((byStatus.completed / total).toFixed(3)) : 0;

  // Aggregate by technician
  const techMap = new Map<string, { technicianId: string; fullName: string; total: number; completed: number }>();

  for (const job of jobs) {
    const techId = job.technician_id as string | null;
    if (!techId) continue;

    const rawTech = job.technician as
      | { id: string; full_name: string }
      | { id: string; full_name: string }[]
      | null
      | undefined;
    const tech = Array.isArray(rawTech) ? rawTech[0] : rawTech;
    const fullName = tech?.full_name ?? 'Unknown';

    if (!techMap.has(techId)) {
      techMap.set(techId, { technicianId: techId, fullName, total: 0, completed: 0 });
    }

    const entry = techMap.get(techId)!;
    entry.total++;
    if (job.status === 'completed') {
      entry.completed++;
    }
  }

  const byTechnician = Array.from(techMap.values());

  return NextResponse.json({ total, byStatus, completionRate, byTechnician });
}
