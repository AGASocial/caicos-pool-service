/**
 * Offline-safe voice note upload queue (KAN-165).
 * Metadata in AsyncStorage; audio file on disk. Retries with backoff on reconnect / app start.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { getUploadBodyFromUri } from '@/lib/uploadPhoto';

export const VOICE_NOTES_BUCKET = 'job-voice-notes';
const QUEUE_KEY = 'cadenza.voiceNoteQueue.v1';
const MAX_ATTEMPTS = 8;

export type QueuedVoiceNote = {
  id: string;
  jobId: string;
  companyId: string;
  propertyId: string | null;
  localUri: string;
  durationMs: number;
  sizeBytes: number | null;
  mimeType: string;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
};

function adminApiBase(): string | null {
  const raw = process.env.EXPO_PUBLIC_ADMIN_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

async function loadQueue(): Promise<QueuedVoiceNote[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedVoiceNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(items: QueuedVoiceNote[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueVoiceNote(
  note: Omit<QueuedVoiceNote, 'attempts' | 'nextAttemptAt' | 'createdAt'> & {
    createdAt?: string;
  },
): Promise<void> {
  const queue = await loadQueue();
  if (queue.some((q) => q.id === note.id)) return;
  queue.push({
    ...note,
    createdAt: note.createdAt ?? new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: Date.now(),
  });
  await saveQueue(queue);
  void flushVoiceNoteQueue();
}

function backoffMs(attempts: number): number {
  const base = Math.min(60_000, 1000 * 2 ** attempts);
  return base + Math.floor(Math.random() * 500);
}

async function registerNote(note: QueuedVoiceNote, storagePath: string): Promise<void> {
  const base = adminApiBase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (base && session?.access_token) {
    const res = await fetch(`${base}/api/jobs/${note.jobId}/voice-notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        id: note.id,
        storage_path: storagePath,
        duration_ms: note.durationMs,
        size_bytes: note.sizeBytes,
        mime_type: note.mimeType,
      }),
    });
    if (!res.ok && res.status !== 200 && res.status !== 201) {
      const text = await res.text().catch(() => '');
      throw new Error(`Register failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return;
  }

  // Fallback: insert via Supabase RLS (same row the API would create).
  const { error } = await supabase.from('cadenza_job_voice_notes').upsert(
    {
      id: note.id,
      company_id: note.companyId,
      job_id: note.jobId,
      property_id: note.propertyId,
      created_by: session?.user?.id,
      storage_path: storagePath,
      duration_ms: note.durationMs,
      size_bytes: note.sizeBytes,
      mime_type: note.mimeType,
      status: 'uploaded',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

async function uploadOne(note: QueuedVoiceNote): Promise<void> {
  const storagePath = `${note.companyId}/${note.jobId}/${note.id}.m4a`;
  const body = await getUploadBodyFromUri(note.localUri);

  const { error: uploadErr } = await supabase.storage
    .from(VOICE_NOTES_BUCKET)
    .upload(storagePath, body, {
      contentType: note.mimeType || 'audio/mp4',
      upsert: true,
    });

  if (uploadErr) throw new Error(uploadErr.message);

  await registerNote(note, storagePath);

  try {
    await FileSystem.deleteAsync(note.localUri, { idempotent: true });
  } catch {
    // ignore cleanup errors
  }
}

let flushing = false;

export async function flushVoiceNoteQueue(): Promise<{ flushed: number; remaining: number }> {
  if (flushing) return { flushed: 0, remaining: -1 };
  flushing = true;
  try {
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      const q = await loadQueue();
      return { flushed: 0, remaining: q.length };
    }

    let queue = await loadQueue();
    const now = Date.now();
    let flushed = 0;
    const next: QueuedVoiceNote[] = [];

    for (const note of queue) {
      if (note.nextAttemptAt > now) {
        next.push(note);
        continue;
      }
      try {
        await uploadOne(note);
        flushed += 1;
      } catch (err) {
        const attempts = note.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          next.push({
            ...note,
            attempts,
            nextAttemptAt: now + backoffMs(attempts),
            lastError: err instanceof Error ? err.message : String(err),
          });
        } else {
          next.push({
            ...note,
            attempts,
            nextAttemptAt: now + backoffMs(attempts),
            lastError: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    await saveQueue(next);
    return { flushed, remaining: next.length };
  } finally {
    flushing = false;
  }
}

let unsubscribeNet: (() => void) | null = null;

/** Call once at app start to flush on launch and on reconnect. */
export function startVoiceNoteQueueSync(): () => void {
  void flushVoiceNoteQueue();
  if (unsubscribeNet) return unsubscribeNet;

  unsubscribeNet = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void flushVoiceNoteQueue();
    }
  });

  return () => {
    unsubscribeNet?.();
    unsubscribeNet = null;
  };
}

export async function getQueuedVoiceNotes(): Promise<QueuedVoiceNote[]> {
  return loadQueue();
}
