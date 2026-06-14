import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import {
  buildPaginatedResponse,
  decodeCursor,
  parsePaginationParams,
} from '@/lib/pagination';

/** Local YYYY-MM-DD without UTC drift. */
function localDateParts(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Dates in [from, to] matching JS getDay() (0=Sun … 6=Sat), pushed to SQL via IN filter.
 * Equivalent to EXTRACT(DOW FROM scheduled_date) = dow within the bounded range.
 */
function datesMatchingDayOfWeek(from: string, to: string, dow: number): string[] {
  const fromParts = from.split('-').map(Number);
  const toParts = to.split('-').map(Number);
  if (fromParts.length !== 3 || toParts.length !== 3) return [];
  const start = new Date(fromParts[0], fromParts[1] - 1, fromParts[2]);
  const end = new Date(toParts[0], toParts[1] - 1, toParts[2]);
  const dates: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === dow) dates.push(localDateParts(d));
  }
  return dates;
}

type JobRow = {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
};

function jobSortKey(row: JobRow): string {
  return `${row.scheduled_date}|${row.scheduled_time ?? ''}|${row.id}`;
}

const JOB_LIST_SELECT = `
  id, property_id, technician_id, route_id, scheduled_date, scheduled_time, status,
  job_source, visit_kind_id,
  property:cadenza_properties!property_id(id, customer_name, address),
  technician:cadenza_profiles!technician_id(id, full_name),
  route:cadenza_routes!route_id(id, name),
  visit_kind:cadenza_visit_reasons!visit_kind_id(id, slug, label)
`;

const JOB_DETAIL_SELECT = `
  id, property_id, technician_id, route_id, scheduled_date, scheduled_time, status,
  route_order, notes, job_source, visit_kind_id, created_at, estimated_duration_min,
  property:cadenza_properties!property_id(id, customer_name, address),
  technician:cadenza_profiles!technician_id(id, full_name),
  route:cadenza_routes!route_id(id, name),
  visit_kind:cadenza_visit_reasons!visit_kind_id(id, slug, label)
`;

/**
 * List jobs for the current user's company.
 * Query: date_from, date_to, technician_id, status, day_of_week, limit, cursor
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const technicianId = searchParams.get('technician_id');
  const status = searchParams.get('status');
  const jobSource = searchParams.get('job_source');
  const routeId = searchParams.get('route_id');
  const dayOfWeekParam = searchParams.get('day_of_week');
  const fieldsParam = searchParams.get('fields');
  const { limit, cursor } = parsePaginationParams(searchParams);

  const client = supabase as unknown as CadenzaSupabaseClient;
  const useDetailFields = fieldsParam === 'detail';

  let query = useDetailFields
    ? client.from('cadenza_service_jobs').select(JOB_DETAIL_SELECT)
    : client.from('cadenza_service_jobs').select(JOB_LIST_SELECT);

  query = query
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true });

  if (dateFrom) query = query.gte('scheduled_date', dateFrom);
  if (dateTo) query = query.lte('scheduled_date', dateTo);
  if (technicianId) query = query.eq('technician_id', technicianId);
  if (status) query = query.eq('status', status);
  if (jobSource === 'route' || jobSource === 'ad_hoc') query = query.eq('job_source', jobSource);
  if (routeId) query = query.eq('route_id', routeId);

  if (dayOfWeekParam !== null && dayOfWeekParam !== '') {
    const dow = Number(dayOfWeekParam);
    if (!Number.isNaN(dow) && dow >= 0 && dow <= 6) {
      if (dateFrom && dateTo) {
        const matchingDates = datesMatchingDayOfWeek(dateFrom, dateTo, dow);
        if (matchingDates.length === 0) {
          return NextResponse.json(
            buildPaginatedResponse([], limit, jobSortKey),
          );
        }
        query = query.in('scheduled_date', matchingDates);
      }
    }
  }

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      const [cursorDate, , cursorId] = decoded.sortKey.split('|');
      const id = cursorId || decoded.id;
      query = query.or(
        `scheduled_date.gt.${cursorDate},and(scheduled_date.eq.${cursorDate},id.gt.${id})`,
      );
    }
  }

  query = query.limit(limit + 1);

  const { data, error } = await query;

  if (error) {
    console.error('Supabase error fetching jobs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as JobRow[];
  return NextResponse.json(buildPaginatedResponse(rows, limit, jobSortKey));
}

/**
 * Create a job. Requires company_id from profile, property_id, technician_id, scheduled_date.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await (supabase as unknown as CadenzaSupabaseClient)
    .from('cadenza_profiles')
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
      property_id,
      technician_id,
      scheduled_date,
      scheduled_time,
      status,
      notes,
      estimated_duration_min,
      route_id,
      route_order,
      job_source: rawJobSource,
      visit_kind_id,
    } = body;

    if (!property_id || !scheduled_date) {
      return NextResponse.json(
        { error: 'property_id and scheduled_date are required' },
        { status: 400 }
      );
    }

    const jobSource =
      rawJobSource === 'route' ? 'route' : rawJobSource === 'ad_hoc' ? 'ad_hoc' : 'ad_hoc';

    const visitKindId: string | null =
      typeof visit_kind_id === 'string' && visit_kind_id.trim() ? visit_kind_id.trim() : null;
    if (visitKindId) {
      const { data: kindRow, error: kindErr } = await (supabase as unknown as CadenzaSupabaseClient)
        .from('cadenza_visit_reasons')
        .select('id')
        .eq('id', visitKindId)
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .maybeSingle();
      if (kindErr || !kindRow) {
        return NextResponse.json(
          { error: 'visit_kind_id must be an active reason in your company' },
          { status: 400 }
        );
      }
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped', 'cancelled'];
    const jobStatus = validStatuses.includes(status) ? status : 'pending';

    const { data: stopRow, error: stopErr } = await (supabase as unknown as CadenzaSupabaseClient)
      .from('cadenza_route_stops')
      .select('route_id')
      .eq('property_id', property_id)
      .maybeSingle();

    if (stopErr) {
      console.error('Supabase error resolving route for property:', stopErr);
    }

    const routeFromStop =
      stopRow &&
      typeof (stopRow as { route_id: unknown }).route_id === 'string' &&
      (stopRow as { route_id: string }).route_id.trim() !== ''
        ? (stopRow as { route_id: string }).route_id
        : null;

    const routeIdResolved =
      routeFromStop ?? (typeof route_id === 'string' && route_id.trim() ? route_id.trim() : null);

    const row = {
      company_id: profile.company_id,
      property_id,
      technician_id: technician_id || null,
      scheduled_date: String(scheduled_date).slice(0, 10),
      scheduled_time: scheduled_time || null,
      status: jobStatus,
      notes: notes ? String(notes).trim() : null,
      estimated_duration_min: typeof estimated_duration_min === 'number' ? estimated_duration_min : 30,
      route_id: routeIdResolved,
      route_order: typeof route_order === 'number' ? route_order : null,
      job_source: jobSource,
      visit_kind_id: visitKindId,
    };

    const { data, error } = await (supabase as unknown as CadenzaSupabaseClient)
      .from('cadenza_service_jobs')
      .insert(row)
      .select(
        'id, property_id, technician_id, route_id, scheduled_date, scheduled_time, status, job_source, visit_kind_id, created_at'
      )
      .single();

    if (error) {
      console.error('Supabase error creating job:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('POST /api/jobs error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
