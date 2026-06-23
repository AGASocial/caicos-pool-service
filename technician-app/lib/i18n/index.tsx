import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './messages/en';
import { es } from './messages/es';
import { getStoredLocale, setStoredLocale, type Locale } from './locale-storage';

export type { Locale };

const messages = { en, es } as const;

function getDeviceLocale(): Locale {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale ?? 'es';
    return tag.toLowerCase().startsWith('es') ? 'es' : 'en';
  } catch {
    return 'es';
  }
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export type TranslateParams = Record<string, string | number>;

export function translate(
  locale: Locale,
  key: string,
  params?: TranslateParams
): string {
  const raw =
    getNested(messages[locale] as unknown as Record<string, unknown>, key) ??
    getNested(messages.en as unknown as Record<string, unknown>, key);

  if (typeof raw !== 'string') return key;

  if (!params) return raw;

  return Object.entries(params).reduce(
    (text, [name, value]) => text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value)),
    raw
  );
}

export function formatDate(
  locale: Locale,
  date: Date | string,
  options: Intl.DateTimeFormatOptions
): string {
  const d =
    typeof date === 'string'
      ? new Date(`${date.slice(0, 10)}T00:00:00`)
      : date;
  const tag = locale === 'es' ? 'es-ES' : 'en-US';
  return d.toLocaleDateString(tag, options);
}

export function cantServiceReasonLabel(
  locale: Locale,
  slug: string,
  dbLabel: string
): string {
  const key = `cantService.reasonsCatalog.${slug}`;
  const translated = translate(locale, key);
  if (translated !== key) return translated;
  return dbLabel;
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: TranslateParams) => string;
  formatDate: (date: Date | string, options: Intl.DateTimeFormatOptions) => string;
  cantServiceReasonLabel: (slug: string, dbLabel: string) => string;
  dayLabels: readonly string[];
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getDeviceLocale);

  useEffect(() => {
    void getStoredLocale().then((stored) => {
      if (stored) setLocaleState(stored);
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void setStoredLocale(next);
  }, []);

  const t = useCallback(
    (key: string, params?: TranslateParams) => translate(locale, key, params),
    [locale]
  );

  const formatDateLocalized = useCallback(
    (date: Date | string, options: Intl.DateTimeFormatOptions) =>
      formatDate(locale, date, options),
    [locale]
  );

  const reasonLabel = useCallback(
    (slug: string, dbLabel: string) => cantServiceReasonLabel(locale, slug, dbLabel),
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      formatDate: formatDateLocalized,
      cantServiceReasonLabel: reasonLabel,
      dayLabels: messages[locale].jobs.dayLabels,
    }),
    [locale, setLocale, t, formatDateLocalized, reasonLabel]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}
