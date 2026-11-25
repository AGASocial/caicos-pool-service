'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type VoiceNoteDto = {
  id: string;
  status: string;
  transcript: string | null;
  language: string | null;
  category: string | null;
  urgency: string | null;
  model_reason: string | null;
  model_explanation: string | null;
  signed_url: string | null;
  last_error: string | null;
  created_at: string;
  corrected_at: string | null;
};

type Props = {
  jobId: string;
  className?: string;
  /** When set, fetch notes for this property (history) via job filter on client. */
  propertyId?: string;
};

function statusLabel(
  t: ReturnType<typeof useTranslations>,
  status: string,
): string {
  switch (status) {
    case 'uploaded':
    case 'transcribing':
    case 'classifying':
      return t('voiceNote_status_processing');
    case 'done':
      return t('voiceNote_status_done');
    case 'failed':
      return t('voiceNote_status_unavailable');
    case 'skipped_cap':
      return t('voiceNote_status_cap');
    default:
      return status;
  }
}

export function VoiceNotes({ jobId, className }: Props) {
  const t = useTranslations();
  const [notes, setNotes] = useState<VoiceNoteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = search ? `?q=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/jobs/${jobId}/voice-notes${qs}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as VoiceNoteDto[];
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voice notes');
    } finally {
      setLoading(false);
    }
  }, [jobId, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const correct = async (
    noteId: string,
    category: 'problem' | 'routine',
    urgency: 'low' | 'medium' | 'high' | null,
  ) => {
    const res = await fetch(`/api/voice-notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, urgency }),
    });
    if (!res.ok) {
      setError(t('voiceNote_correctFailed'));
      return;
    }
    await load();
  };

  const retry = async (noteId: string) => {
    const res = await fetch(`/api/voice-notes/${noteId}/retry`, { method: 'POST' });
    if (!res.ok) {
      setError(t('voiceNote_retryFailed'));
      return;
    }
    await load();
  };

  const filtered = useMemo(() => notes, [notes]);

  return (
    <Card className={className} data-testid="voice-notes">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>{t('voiceNotes')}</CardTitle>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('voiceNote_searchPlaceholder')}
            className="h-9 w-48 sm:w-64"
            data-testid="voice-notes-search"
            aria-label={t('voiceNote_searchPlaceholder')}
          />
          <Button type="submit" size="sm" variant="secondary">
            {t('voiceNote_search')}
          </Button>
        </form>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <p className="text-sm text-muted-foreground">{t('voiceNote_loading')}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('voiceNote_empty')}</p>
        )}
        {filtered.map((note) => (
          <div
            key={note.id}
            className="space-y-2 rounded-md border border-border p-3"
            data-testid="voice-note-item"
            data-note-id={note.id}
            data-category={note.category ?? ''}
            data-status={note.status}
          >
            <div className="flex flex-wrap items-center gap-2">
              {note.category === 'problem' ? (
                <Badge variant="destructive" data-testid="voice-note-badge-problem">
                  {t('voiceNote_category_problem')}
                  {note.urgency ? ` · ${t(`voiceNote_urgency_${note.urgency}`)}` : ''}
                </Badge>
              ) : note.category === 'routine' ? (
                <Badge variant="secondary" data-testid="voice-note-badge-routine">
                  {t('voiceNote_category_routine')}
                </Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {statusLabel(t, note.status)}
              </span>
              {note.language && (
                <span className="text-xs text-muted-foreground">
                  {t('voiceNote_language')}: {note.language}
                </span>
              )}
              {note.status === 'done' || note.status === 'failed' || note.status === 'skipped_cap' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-8"
                      data-testid="voice-note-correct-menu"
                    >
                      {t('voiceNote_correct')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{t('voiceNote_correct')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => void correct(note.id, 'routine', null)}
                    >
                      {t('voiceNote_markRoutine')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void correct(note.id, 'problem', 'low')}
                    >
                      {t('voiceNote_markProblemLow')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void correct(note.id, 'problem', 'medium')}
                    >
                      {t('voiceNote_markProblemMedium')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void correct(note.id, 'problem', 'high')}
                    >
                      {t('voiceNote_markProblemHigh')}
                    </DropdownMenuItem>
                    {(note.status === 'failed' || note.status === 'skipped_cap') && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => void retry(note.id)}>
                          {t('voiceNote_retry')}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>

            {note.signed_url ? (
              <audio
                controls
                preload="metadata"
                src={note.signed_url}
                className="w-full"
                data-testid="voice-note-player"
              >
                <track kind="captions" />
              </audio>
            ) : (
              <p className="text-xs text-muted-foreground">{t('voiceNote_noAudio')}</p>
            )}

            {note.transcript ? (
              <p className="text-sm whitespace-pre-wrap" data-testid="voice-note-transcript">
                {note.transcript}
              </p>
            ) : note.status === 'failed' ? (
              <p className="text-sm text-muted-foreground">
                {t('voiceNote_status_unavailable')}
              </p>
            ) : note.status === 'skipped_cap' ? (
              <p className="text-sm text-muted-foreground">{t('voiceNote_status_cap')}</p>
            ) : null}

            {note.model_reason && (
              <p className="text-xs text-muted-foreground">{note.model_reason}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
