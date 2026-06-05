import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_REFRESH_TOKEN_KEY = 'biometric_refresh_token';
const BIOMETRIC_EMAIL_KEY = 'biometric_email';

export type BiometricCapability = {
  available: boolean;
  label: string;
};

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    return { available: false, label: 'Biometrics' };
  }

  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return { available: true, label: Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock' };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return { available: true, label: Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint' };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return { available: true, label: 'Iris' };
  }

  return { available: true, label: 'Biometrics' };
}

export async function isBiometricLoginEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return value === 'true';
}

export async function hasStoredBiometricCredentials(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
  return Boolean(token);
}

export async function getStoredBiometricEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
}

export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  const { available } = await getBiometricCapability();
  if (!available) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    fallbackLabel: 'Use passcode',
  });

  return result.success;
}

export async function enableBiometricLogin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { available, label } = await getBiometricCapability();
  if (!available) {
    return { ok: false, error: `${label} is not available on this device.` };
  }

  const authenticated = await authenticateWithBiometrics(`Enable ${label} sign-in`);
  if (!authenticated) {
    return { ok: false, error: `${label} verification was cancelled.` };
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.refresh_token) {
    return { ok: false, error: 'No active session found. Sign in with your password first.' };
  }

  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
  await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, session.refresh_token);
  if (session.user.email) {
    await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, session.user.email);
  }

  return { ok: true };
}

export async function disableBiometricLogin(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
}

export async function signInWithBiometrics(): Promise<{ ok: true } | { ok: false; error: string }> {
  const enabled = await isBiometricLoginEnabled();
  const hasCredentials = await hasStoredBiometricCredentials();

  if (!enabled || !hasCredentials) {
    return { ok: false, error: 'Biometric sign-in is not set up. Sign in with your password first.' };
  }

  const { label } = await getBiometricCapability();
  const authenticated = await authenticateWithBiometrics(`Sign in with ${label}`);
  if (!authenticated) {
    return { ok: false, error: `${label} verification was cancelled.` };
  }

  const refreshToken = await SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    await disableBiometricLogin();
    return { ok: false, error: 'Stored sign-in expired. Use your password to sign in again.' };
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    await disableBiometricLogin();
    return { ok: false, error: 'Biometric sign-in failed. Use your password to sign in again.' };
  }

  await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, data.session.refresh_token);

  return { ok: true };
}
