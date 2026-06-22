import AsyncStorage from '@react-native-async-storage/async-storage';

export type Locale = 'en' | 'es';

const STORAGE_KEY = '@cadenza/locale';

export async function getStoredLocale(): Promise<Locale | null> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    if (value === 'en' || value === 'es') return value;
  } catch {
    // ignore read errors — fall back to device locale
  }
  return null;
}

export async function setStoredLocale(locale: Locale): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, locale);
}
