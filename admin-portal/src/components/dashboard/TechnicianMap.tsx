'use client';

/**
 * Live technician map for the admin dashboard.
 * - Client-only: the WebGL map is loaded with next/dynamic({ ssr: false }).
 * - MapLibre + OpenFreeMap by default; Mapbox when NEXT_PUBLIC_MAPBOX_TOKEN (pk.*) is set.
 * - One dot per technician (latest row in cadenza_technician_locations) colored by
 *   their jobs today, plus today's job pins (properties with lat/lng).
 * - Live via Supabase Realtime, filtered by company_id (RLS also scopes rows).
 */
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Map as MapIcon } from 'lucide-react';
import {
  STATUS_COLORS, applyJobUpdate, isStale, localToday, one, removeLocation, resolveMapProvider,
  technicianStatus, upsertLocation, type MapJob, type TechMapStatus, type TechnicianLocation,
} from '@/lib/technician-map';
import type { CanvasJob, CanvasTech, TechnicianMapCanvasProps } from './TechnicianMapCanvas';

type CanvasProps = Omit<TechnicianMapCanvasProps, 'lib'>;
const MapLoading = () => (
  <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
);
const MaplibreCanvas = dynamic<CanvasProps>(() => import('./TechnicianMapMaplibre'), { ssr: false, loading: MapLoading });
const MapboxCanvas = dynamic<CanvasProps>(() => import('./TechnicianMapMapbox'), { ssr: false, loading: MapLoading });

const LOCATION_COLUMNS = 'technician_id, company_id, lat, lng, heading, speed_mps, current_job_id, is_simulated, updated_at';

type RawLocation = Omit<TechnicianLocation, 'technician_name'> & { technician?: { full_name: string } | { full_name: string }[] | null };
type RawJob = Omit<MapJob, 'property'> & {
  property?: MapJob['property'] | MapJob['property'][];
  technician?: { id: string; full_name: string } | { id: string; full_name: string }[] | null;
};

export function TechnicianMap({ client }: { client?: SupabaseClient } = {}) {
  const t = useTranslations();
  const supabase = useMemo<SupabaseClient>(
    () => client ?? (createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!) as unknown as SupabaseClient),
    [client]
  );
  const provider = useMemo(() => resolveMapProvider(process.env.NEXT_PUBLIC_MAPBOX_TOKEN), []);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [locations, setLocations] = useState<TechnicianLocation[]>([]);
  const [jobs, setJobs] = useState<MapJob[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Company of the signed-in user (needed for the realtime filter).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { if (!cancelled) setLoading(false); return; }
      const { data } = await supabase.from('cadenza_profiles').select('company_id').eq('id', auth.user.id).maybeSingle();
      if (!cancelled) { setCompanyId((data?.company_id as string) ?? null); if (!data) setLoading(false); }
    })().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    async function load() {
      const [locRes, jobRes] = await Promise.all([
        supabase.from('cadenza_technician_locations')
          .select(`${LOCATION_COLUMNS}, technician:cadenza_profiles!cadenza_technician_locations_technician_id_fkey(full_name)`)
          .eq('company_id', companyId!),
        supabase.from('cadenza_service_jobs')
          .select(`id, status, technician_id, route_order,
            technician:cadenza_profiles!cadenza_service_jobs_technician_id_fkey(id, full_name),
            property:cadenza_properties!cadenza_service_jobs_property_id_fkey(id, customer_name, address, lat, lng)`)
          .eq('company_id', companyId!).eq('scheduled_date', localToday()).eq('is_deleted', false)
          .order('route_order', { ascending: true }),
      ]);
      if (cancelled) return;
      const n: Record<string, string> = {};
      const locs = ((locRes.data ?? []) as unknown as RawLocation[]).map(({ technician, ...l }) => {
        const name = one(technician)?.full_name ?? null; if (name) n[l.technician_id] = name;
        return { ...l, technician_name: name };
      });
      const js = ((jobRes.data ?? []) as unknown as RawJob[]).map(({ technician, property, ...j }) => {
        const tech = one(technician); if (tech?.full_name && j.technician_id) n[j.technician_id] = tech.full_name;
        return { ...j, property: one(property ?? null) };
      });
      if (locRes.error) console.error('technician map: locations', locRes.error.message);
      if (jobRes.error) console.error('technician map: jobs', jobRes.error.message);
      setLocations(locs); setJobs(js); setNames((p) => ({ ...p, ...n })); setLoading(false);
    }
    load();

    const filter = `company_id=eq.${companyId}`;
    const channel = supabase
      .channel(`technician-map:${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadenza_technician_locations', filter }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { technician_id?: string }).technician_id;
          if (id) setLocations((prev) => removeLocation(prev, id));
        } else {
          setLocations((prev) => upsertLocation(prev, payload.new as TechnicianLocation));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadenza_service_jobs', filter }, (payload) => {
        if (payload.eventType === 'UPDATE') setJobs((prev) => applyJobUpdate(prev, payload.new as MapJob));
        else load();
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [supabase, companyId]);

  // Re-evaluate staleness every 30s.
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

  const statusLabel = (s: string) => ({
    en_route: t('statusOnTheWay'), in_progress: t('statusOnSite'), completed: t('statusDone'),
    pending: t('statusPending'), skipped: t('statusSkipped'), cancelled: t('statusSkipped'), idle: t('techMapIdle'),
  } as Record<string, string>)[s] ?? s;

  const canvasTechs = useMemo<CanvasTech[]>(() => locations.map((l) => {
    const status = technicianStatus(jobs.filter((j) => j.technician_id === l.technician_id));
    return { id: l.technician_id, name: l.technician_name ?? names[l.technician_id] ?? t('techMapUnknownTech'),
      lat: l.lat, lng: l.lng, status, stale: isStale(l.updated_at, now), statusLabel: statusLabel(status) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [locations, jobs, names, now]);

  const canvasJobs = useMemo<CanvasJob[]>(() => jobs.flatMap((j) => {
    const p = j.property; if (p?.lat == null || p?.lng == null) return [];
    return [{ id: j.id, lat: p.lat, lng: p.lng, status: j.status, label: p.customer_name, statusLabel: statusLabel(j.status) }];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [jobs]);

  const legend: TechMapStatus[] = ['en_route', 'in_progress', 'completed', 'pending'];
  const Canvas = provider.kind === 'mapbox' ? MapboxCanvas : MaplibreCanvas;

  return (
    <Card data-testid="technician-map" data-provider={provider.kind}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-primary" />
              {t('techMapTitle')}
              {live && (
                <span data-testid="tech-map-live" className="ml-1 inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />{t('techMapLive')}
                </span>
              )}
            </CardTitle>
            <CardDescription>{t('techMapDescription')}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" data-testid="tech-map-legend">
            {legend.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />{statusLabel(s)}
              </span>
            ))}
            <span data-testid="tech-map-count">{t('techMapCount', { techs: canvasTechs.length, jobs: canvasJobs.length })}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-[420px] w-full overflow-hidden rounded-lg border bg-muted/30">
          {loading ? <MapLoading /> : (
            <Canvas
              mapStyle={provider.style}
              mapboxAccessToken={provider.kind === 'mapbox' ? provider.token : undefined}
              technicians={canvasTechs}
              jobs={canvasJobs}
            />
          )}
          {!loading && canvasTechs.length === 0 && (
            <div data-testid="tech-map-empty" className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-md bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow">
              {t('techMapNoLocations')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
