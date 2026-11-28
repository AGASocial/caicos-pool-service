/**
 * Audio mode helpers for voice notes (expo-audio).
 * On iOS, `allowsRecording: true` routes output to the earpiece, so recording mode
 * must only be active during a take; playback uses the loudspeaker.
 */
import { setAudioModeAsync } from 'expo-audio';

export const PLAYBACK_AUDIO_MODE = {
  allowsRecording: false,
  playsInSilentMode: true,
  shouldRouteThroughEarpiece: false,
} as const;

export const RECORDING_AUDIO_MODE = {
  allowsRecording: true,
  playsInSilentMode: true,
} as const;

export async function setPlaybackAudioMode(): Promise<void> {
  await setAudioModeAsync({ ...PLAYBACK_AUDIO_MODE });
}

export async function setRecordingAudioMode(): Promise<void> {
  await setAudioModeAsync({ ...RECORDING_AUDIO_MODE });
}
