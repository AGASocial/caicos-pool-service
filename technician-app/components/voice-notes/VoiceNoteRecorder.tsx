/**
 * Hold-to-record voice note (WhatsApp-style). AAC/m4a mono ~48 kbps, 120 s hard stop.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useI18n } from '@/lib/i18n';
import { useAppColors } from '@/lib/theme';
import { setPlaybackAudioMode, setRecordingAudioMode } from '@/lib/voiceNoteAudioMode';
import { enqueueVoiceNote } from '@/lib/voiceNoteQueue';

const MAX_MS = 120_000;
const SLIDE_CANCEL_PX = 80;

export const VOICE_NOTE_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 48000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 48000,
  },
};

type Props = {
  jobId: string;
  companyId: string;
  propertyId: string | null;
  createdBy: string;
  onQueued?: (noteId: string) => void;
};

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function newNoteId(): string {
  // RFC4122-ish UUID without pulling crypto polyfills
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function VoiceNoteRecorder({
  jobId,
  companyId,
  propertyId,
  createdBy,
  onQueued,
}: Props) {
  const { t } = useI18n();
  const { colors } = useAppColors();
  const recorder = useAudioRecorder(VOICE_NOTE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 250);

  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewDurationMs, setPreviewDurationMs] = useState(0);
  const [recording, setRecording] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [slideHint, setSlideHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startX = useRef(0);
  const hardStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const player = useAudioPlayer(previewUri);
  const playerStatus = useAudioPlayerStatus(player);

  const clearHardStop = () => {
    if (hardStopTimer.current) {
      clearTimeout(hardStopTimer.current);
      hardStopTimer.current = null;
    }
  };

  const stopAndFinalize = useCallback(
    async (wasCancelled: boolean) => {
      clearHardStop();
      setRecording(false);
      try {
        await recorder.stop();
        const uri = recorder.uri;
        const duration = recorderState.durationMillis ?? 0;
        if (wasCancelled || cancelledRef.current || !uri) {
          if (uri) {
            try {
              await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch {
              /* ignore */
            }
          }
          setPreviewUri(null);
          setPreviewDurationMs(0);
          return;
        }
        setPreviewUri(uri);
        setPreviewDurationMs(duration);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('voiceNotes.recordFailed'));
      } finally {
        try {
          await setPlaybackAudioMode();
        } catch {
          /* ignore */
        }
      }
    },
    [recorder, recorderState.durationMillis, t],
  );

  const startRecording = useCallback(async () => {
    setError(null);
    setCancelled(false);
    cancelledRef.current = false;
    setSlideHint(false);
    setPreviewUri(null);

    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError(t('voiceNotes.micPermission'));
      return;
    }

    try {
      await setRecordingAudioMode();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      hardStopTimer.current = setTimeout(() => {
        void stopAndFinalize(false);
      }, MAX_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('voiceNotes.recordFailed'));
      setRecording(false);
      try {
        await setPlaybackAudioMode();
      } catch {
        /* ignore */
      }
    }
  }, [recorder, stopAndFinalize, t]);

  useEffect(() => {
    return () => {
      clearHardStop();
      void setPlaybackAudioMode().catch(() => {
        /* ignore */
      });
    };
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          startX.current = e.nativeEvent.pageX;
          void startRecording();
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const dx = startX.current - e.nativeEvent.pageX;
          const sliding = dx > SLIDE_CANCEL_PX / 2;
          setSlideHint(sliding);
          if (dx > SLIDE_CANCEL_PX) {
            cancelledRef.current = true;
            setCancelled(true);
          }
        },
        onPanResponderRelease: () => {
          const wasCancelled = cancelledRef.current;
          void stopAndFinalize(wasCancelled);
          setSlideHint(false);
        },
        onPanResponderTerminate: () => {
          cancelledRef.current = true;
          void stopAndFinalize(true);
          setSlideHint(false);
        },
      }),
    [startRecording, stopAndFinalize],
  );

  const discardPreview = async () => {
    try {
      if (playerStatus.playing) player.pause();
    } catch {
      /* ignore */
    }
    if (previewUri) {
      try {
        await FileSystem.deleteAsync(previewUri, { idempotent: true });
      } catch {
        /* ignore */
      }
    }
    setPreviewUri(null);
    setPreviewDurationMs(0);
  };

  const saveNote = async () => {
    if (!previewUri || busy) return;
    setBusy(true);
    setError(null);
    try {
      const noteId = newNoteId();
      const destDir = `${FileSystem.documentDirectory}voice-notes/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const dest = `${destDir}${noteId}.m4a`;
      await FileSystem.copyAsync({ from: previewUri, to: dest });

      let sizeBytes: number | null = null;
      try {
        const info = await FileSystem.getInfoAsync(dest);
        if (info.exists && 'size' in info) sizeBytes = info.size ?? null;
      } catch {
        /* ignore */
      }

      await enqueueVoiceNote({
        id: noteId,
        jobId,
        companyId,
        propertyId,
        localUri: dest,
        durationMs: previewDurationMs,
        sizeBytes,
        mimeType: 'audio/mp4',
      });
      void createdBy; // reserved for register payload / RLS created_by via session
      onQueued?.(noteId);
      await discardPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('voiceNotes.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const elapsedSec = Math.min(
    120,
    Math.floor((recorderState.durationMillis ?? 0) / 1000),
  );

  const isPlaying = playerStatus.playing;
  const clipSeconds =
    playerStatus.duration > 0 ? playerStatus.duration : previewDurationMs / 1000;
  const displaySeconds = isPlaying ? playerStatus.currentTime : clipSeconds;

  const togglePreviewPlayback = async () => {
    try {
      if (playerStatus.playing) {
        player.pause();
        return;
      }
      await setPlaybackAudioMode();
      const atEnd =
        playerStatus.didJustFinish ||
        (clipSeconds > 0 && playerStatus.currentTime >= clipSeconds - 0.1);
      if (atEnd) {
        await player.seekTo(0);
      }
      player.play();
    } catch {
      /* ignore */
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID="voice-note-recorder">
      <Text style={[styles.title, { color: colors.text }]}>{t('voiceNotes.title')}</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>{t('voiceNotes.hint')}</Text>

      {error ? (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      ) : null}

      {previewUri ? (
        <View style={styles.preview}>
          <View style={styles.previewActions}>
            <Pressable
              style={[styles.playBtn, { backgroundColor: colors.photoButtonBg }]}
              onPress={() => void togglePreviewPlayback()}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? t('voiceNotes.pause') : t('voiceNotes.play')}
              testID="voice-note-play-preview"
            >
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={colors.text} />
              <Text style={[styles.playTime, { color: colors.text }]}>
                {formatClock(displaySeconds)}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: colors.photoButtonBg }]}
              onPress={() => void discardPreview()}
              accessibilityRole="button"
              accessibilityLabel={t('voiceNotes.discard')}
              testID="voice-note-discard"
            >
              <Ionicons name="trash-outline" size={22} color={colors.text} />
            </Pressable>
            <Pressable
              style={[styles.btnPrimary, { backgroundColor: colors.buttonPrimary }]}
              onPress={() => void saveNote()}
              disabled={busy}
              accessibilityRole="button"
              testID="voice-note-save"
            >
              <Text style={[styles.btnPrimaryText, { color: colors.buttonPrimaryText }]}>
                {t('voiceNotes.save')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.recordRow}>
          <View style={styles.recordMeta}>
            {recording ? (
              <>
                <Text style={[styles.recordingText, { color: colors.text }]}>
                  {slideHint || cancelled
                    ? t('voiceNotes.releaseToCancel')
                    : t('voiceNotes.recording', { seconds: elapsedSec })}
                </Text>
                <Text style={[styles.slideHint, { color: colors.muted }]}>
                  {t('voiceNotes.slideToCancel')}
                </Text>
              </>
            ) : (
              <Text style={[styles.holdHint, { color: colors.muted }]}>
                {t('voiceNotes.holdToRecord')}
              </Text>
            )}
          </View>
          <View
            {...panResponder.panHandlers}
            style={[
              styles.micHit,
              {
                backgroundColor: recording
                  ? cancelled
                    ? colors.mutedSecondary
                    : colors.buttonDanger
                  : colors.buttonPrimary,
              },
            ]}
            testID="voice-note-hold"
            accessibilityRole="button"
            accessibilityLabel={recording ? t('voiceNotes.stopRecording') : t('voiceNotes.holdToRecord')}
          >
            <Ionicons
              name={recording ? 'stop' : 'mic'}
              size={26}
              color={recording ? colors.buttonDangerText : colors.buttonPrimaryText}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18 },
  error: { fontSize: 13 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  micHit: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordMeta: { flex: 1 },
  recordingText: { fontSize: 15, fontWeight: '600' },
  slideHint: { fontSize: 12, marginTop: 2 },
  holdHint: { fontSize: 13 },
  preview: { gap: 10 },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 22,
  },
  playTime: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimaryText: { fontSize: 13, fontWeight: '700' },
});
