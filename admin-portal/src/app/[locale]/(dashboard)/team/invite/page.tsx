'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Copy, Check } from 'lucide-react';

type CreatedInvite = { code: string; role: string; expires_at: string };

export default function InviteTeamMemberPage() {
  const t = useTranslations();
  const [role, setRole] = useState<'technician' | 'admin' | 'operations'>('technician');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setLoading(true);
    try {
      const res = await fetch('/api/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, expires_in_days: expiresInDays }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText);
        setLoading(false);
        return;
      }
      setCreated(data);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
      setLoading(false);
    }
  }

  function copyInviteLink() {
    if (!created?.code) return;
    const url = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${url}/auth/register?invite=${created.code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyCode() {
    if (!created?.code) return;
    navigator.clipboard.writeText(created.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/technicians">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-700">{t('inviteTeamMember')}</h1>
          <p className="text-muted-foreground dark:text-gray-700">{t('teamDescription')}</p>
        </div>
      </div>

      {!created ? (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t('inviteTeamMember')}</CardTitle>
            <CardDescription>{t('inviteCodeDescription', { defaultValue: 'Create an invite link or code for a new team member.' })}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('role')}</Label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'technician' | 'admin' | 'operations')}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="technician">{t('roleTechnician')}</option>
                  <option value="operations">{t('roleOperations')}</option>
                  <option value="admin">{t('roleAdmin')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expires">{t('expiresInDays')}</Label>
                <Input
                  id="expires"
                  type="number"
                  min={1}
                  max={90}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value) || 7)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  {loading ? t('loading', { defaultValue: 'Loading…' }) : t('generateInviteCode')}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/technicians">{t('cancel')}</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t('inviteCodeCreated')}</CardTitle>
            <CardDescription>{t('shareInviteCodeOrLink')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('inviteCode')}</Label>
              <div className="flex gap-2">
                <Input readOnly value={created.code} className="font-mono" />
                <Button type="button" variant="outline" size="icon" onClick={copyCode} title={t('copyCode')}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('inviteLink')}</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/auth/register?invite=${created.code}` : created.code}
                  className="font-mono text-sm"
                />
                <Button type="button" variant="outline" size="icon" onClick={copyInviteLink} title={t('copyCode')}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('role')}: {created.role} · {t('expiresAt')}: {new Date(created.expires_at).toLocaleDateString()}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setCreated(null); }}>{t('createAnother')}</Button>
              <Button asChild>
                <Link href="/technicians">{t('backToTeam')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
