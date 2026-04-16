'use client';

import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useTeam } from '@/lib/team';

const STATUSES = ['pending', 'in_progress', 'completed', 'skipped', 'cancelled'] as const;

type PropertyRef = { id: string; customer_name: string; address?: string; customer_phone?: string; city?: string };
type TechnicianRef = { id: string; full_name: string };
type RouteRef = { id: string; name: string } | null;
type VisitKindRef = { id: string; slug: string; label: string } | null;
type ReportPhoto = {
  id: string;
  storage_path: string;
  caption: string | null;
  photo_type: string | null;
  created_at: string;
  url: string | null;
};
type JobDetail = {
  id: string;
  property_id: string;
  technician_id: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  route_order: number | null;
  estimated_duration_min: number | null;
  notes: string | null;
  job_source?: string;
  visit_kind_id?: string | null;
  created_at: string;
  updated_at: string;
  property?: PropertyRef;
  technician?: TechnicianRef | null;
  route?: RouteRef;
  visit_kind?: VisitKindRef;
  report_photos?: ReportPhoto[];
};

export default function JobDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [job, setJob] = useState<JobDetail | null>(null);
  const [properties, setProperties] = useState<{ id: string; customer_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: teamMembers = [] } = useTeam();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ReportPhoto | null>(null);
  const [edit, setEdit] = useState({
    property_id: '',
    technician_id: '',
    scheduled_date: '',
    scheduled_time: '',
    status: 'pending',
    notes: '',
    estimated_duration_min: 30,
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || res.statusText);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setJob(data);
          setEdit({
            property_id: data.property_id,
            technician_id: data.technician_id ?? '',
            scheduled_date: data.scheduled_date?.slice(0, 10) ?? '',
            scheduled_time: data.scheduled_time ?? '',
            status: data.status ?? 'pending',
            notes: data.notes ?? '',
            estimated_duration_min: data.estimated_duration_min ?? 30,
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/properties');
        if (!cancelled && res.ok) {
          const data = await res.json();
          setProperties(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: edit.property_id,
          technician_id: edit.technician_id || null,
          scheduled_date: edit.scheduled_date,
          scheduled_time: edit.scheduled_time || null,
          status: edit.status,
          notes: edit.notes || null,
          estimated_duration_min: edit.estimated_duration_min,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText);
        setSaving(false);
        return;
      }
      setJob((prev) => (prev ? { ...prev, ...data } : null));
      setSaving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || res.statusText);
        setDeleting(false);
        setDeleteDialogOpen(false);
        return;
      }
      router.push('/jobs');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">{t('loading', { defaultValue: 'Loading…' })}</p>;
  if (error && !job) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/jobs"><ArrowLeft className="mr-2 h-4 w-4" />{t('back')}</Link>
        </Button>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }
  if (!job) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/jobs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">{t('jobDetails')}</h1>
            <p className="text-muted-foreground dark:text-gray-700">
              {job.property?.customer_name ?? job.property_id} · {job.scheduled_date}
              {job.job_source === 'ad_hoc' && (
                <> · {t('jobSource_ad_hoc')}</>
              )}
              {job.job_source === 'route' && (
                <> · {t('jobSource_route')}</>
              )}
              {job.route?.name && <> · {job.route.name}</>}
              {job.visit_kind?.label && <> · {job.visit_kind.label}</>}
            </p>
          </div>
        </div>
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              {t('deleteJob')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('deleteJob')}</DialogTitle>
              <DialogDescription>{t('confirmDeleteJob')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                {t('cancel')}
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? t('loading', { defaultValue: 'Loading…' }) : t('delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}



      <Card>
        <CardHeader>
          <CardTitle>{t('jobDetails')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {job.property?.address && (
            <p><span className="text-muted-foreground">{t('address')}:</span> {job.property.address}</p>
          )}
          {job.property?.customer_phone && (
            <p><span className="text-muted-foreground">{t('customerPhone')}:</span> {job.property.customer_phone}</p>
          )}
          <p><span className="text-muted-foreground">{t('status')}:</span> {t(`status_${job.status}`)}</p>
          {job.notes && <p><span className="text-muted-foreground">{t('notes')}:</span> {job.notes}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('photos', { defaultValue: 'Photos' })}</CardTitle>
        </CardHeader>
        <CardContent>
          {job.report_photos?.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {job.report_photos
                .filter((photo) => photo.url)
                .map((photo) => (
                  <button
                    type="button"
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="group block overflow-hidden rounded-md border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url ?? ''}
                      alt={photo.caption || t('jobPhoto', { defaultValue: 'Job photo' })}
                      className="h-44 w-full object-cover transition-transform group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                    <div className="space-y-1 p-2 text-xs">
                      {photo.caption ? <p className="text-foreground">{photo.caption}</p> : null}
                      {photo.photo_type ? (
                        <p className="text-muted-foreground">
                          {t('type', { defaultValue: 'Type' })}: {photo.photo_type}
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('noPhotosAvailable', { defaultValue: 'No photos available for this job yet.' })}
            </p>
          )}
        </CardContent>
      </Card>
            <Card>
        <CardHeader>
          <CardTitle>{t('editJob')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('properties')}</Label>
            <select
              value={edit.property_id}
              onChange={(e) => setEdit((p) => ({ ...p, property_id: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.customer_name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t('technician')}</Label>
            <select
              value={edit.technician_id}
              onChange={(e) => setEdit((p) => ({ ...p, technician_id: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">—</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>{member.full_name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('scheduledDate')}</Label>
              <Input
                type="date"
                value={edit.scheduled_date}
                onChange={(e) => setEdit((p) => ({ ...p, scheduled_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('scheduledTime')}</Label>
              <Input
                type="time"
                value={edit.scheduled_time}
                onChange={(e) => setEdit((p) => ({ ...p, scheduled_time: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('status')}</Label>
              <select
                value={edit.status}
                onChange={(e) => setEdit((p) => ({ ...p, status: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{t(`status_${s}`)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('estimatedDuration')}</Label>
              <Input
                type="number"
                min={1}
                value={edit.estimated_duration_min}
                onChange={(e) => setEdit((p) => ({ ...p, estimated_duration_min: Number(e.target.value) || 30 }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={edit.notes}
              onChange={(e) => setEdit((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('loading', { defaultValue: 'Loading…' }) : t('save')}
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedPhoto)}
        onOpenChange={(open) => {
          if (!open) setSelectedPhoto(null);
        }}
      >
        <DialogContent className="max-w-5xl p-4 sm:p-6">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-medium">
            {selectedPhoto?.url ? (
              <Button asChild size="sm">
                <a href={selectedPhoto.url} download target="_blank" rel="noreferrer">
                  {t('download', { defaultValue: 'Download' })}
                </a>
              </Button>
            ) : null}
            </DialogTitle>
          </DialogHeader>
          {selectedPhoto?.url ? (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.caption || t('jobPhoto', { defaultValue: 'Job photo' })}
                className="h-auto max-h-[80vh] w-full rounded-md object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
