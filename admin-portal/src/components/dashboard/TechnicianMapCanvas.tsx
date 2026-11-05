'use client';

/**
 * Provider-agnostic map body. Receives the react-map-gl components for either
 * MapLibre (`react-map-gl/maplibre`) or Mapbox (`react-map-gl/mapbox`) so both
 * share the same markers. Never import this from a server component.
 */
import { useEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { DEFAULT_CENTER, STATUS_COLORS, boundsOf, type TechMapStatus, type MapJobStatus } from '@/lib/technician-map';

export type CanvasTech = { id: string; name: string; lat: number; lng: number; status: TechMapStatus; stale: boolean; statusLabel: string };
export type CanvasJob = { id: string; lat: number; lng: number; status: MapJobStatus; label: string; statusLabel: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
export type MapLib = {
  Map: ComponentType<any>;
  Marker: ComponentType<any>;
  NavigationControl: ComponentType<any>;
};

export type TechnicianMapCanvasProps = {
  lib: MapLib;
  mapStyle: string;
  mapboxAccessToken?: string;
  technicians: CanvasTech[];
  jobs: CanvasJob[];
  children?: ReactNode;
};

export function TechnicianMapCanvas({ lib, mapStyle, mapboxAccessToken, technicians, jobs }: TechnicianMapCanvasProps) {
  const { Map, Marker, NavigationControl } = lib;
  const mapRef = useRef<any>(null);
  const fittedKey = useRef('');
  // Re-fit only when the set of stops/technicians changes (not on every position tick).
  const key = [...jobs.map((j) => j.id), ...technicians.map((t) => t.id)].sort().join(',');
  const fit = (force = false) => {
    const map = mapRef.current;
    if (!map || (!force && fittedKey.current === key)) return;
    const b = boundsOf([...jobs, ...technicians]);
    if (!b) {
      try { map.resize?.(); } catch { /* map not ready */ }
      return;
    }
    fittedKey.current = key;
    try { map.resize?.(); map.fitBounds(b, { padding: 48, maxZoom: 14, duration: 0 }); } catch { /* map not ready */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fit(); }, [key]);

  return (
    <Map
      ref={mapRef}
      mapStyle={mapStyle}
      {...(mapboxAccessToken ? { mapboxAccessToken } : {})}
      initialViewState={{ longitude: DEFAULT_CENTER.lng, latitude: DEFAULT_CENTER.lat, zoom: 11 }}
      style={{ width: '100%', height: '100%' }}
      onLoad={() => fit(true)}
      attributionControl={{ compact: true }}
    >
      <NavigationControl position="top-right" showCompass={false} />
      {jobs.map((j) => (
        <Marker key={`job-${j.id}`} longitude={j.lng} latitude={j.lat} anchor="center">
          <div
            data-testid="tech-map-job-pin"
            data-status={j.status}
            title={`${j.label} · ${j.statusLabel}`}
            aria-label={`${j.label} · ${j.statusLabel}`}
            className="h-2.5 w-2.5 rotate-45 border border-white shadow-sm"
            style={{ backgroundColor: STATUS_COLORS[j.status], opacity: 0.85 }}
          />
        </Marker>
      ))}
      {technicians.map((t) => (
        <Marker key={`tech-${t.id}`} longitude={t.lng} latitude={t.lat} anchor="center" style={{ zIndex: 2 }}>
          <div
            data-testid="tech-map-tech-dot"
            data-tech-id={t.id}
            data-status={t.status}
            data-lat={t.lat.toFixed(6)}
            data-lng={t.lng.toFixed(6)}
            className="group relative"
            aria-label={`${t.name} · ${t.statusLabel}`}
          >
            <span
              className="block h-4 w-4 rounded-full border-2 border-white shadow-md transition-transform group-hover:scale-125"
              style={{ backgroundColor: STATUS_COLORS[t.status], opacity: t.stale ? 0.45 : 1 }}
            />
            <span
              role="tooltip"
              data-testid="tech-map-tooltip"
              className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
            >
              {t.name} · {t.statusLabel}
            </span>
          </div>
        </Marker>
      ))}
    </Map>
  );
}
