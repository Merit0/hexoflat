export type TLocale = 'uk' | 'en';

export const SUPPORTED_LOCALES: TLocale[] = ['uk', 'en'];

const UI_SETTINGS_KEY = 'hexoflat:ui-settings:v1';

export function isSupportedLocale(value: unknown): value is TLocale {
  return value === 'uk' || value === 'en';
}

export function detectBrowserLocale(): TLocale {
  const lang = typeof navigator !== 'undefined' ? navigator.language : '';
  return lang.toLowerCase().startsWith('en') ? 'en' : 'uk';
}

function readPersistedLocale(): TLocale | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const raw = localStorage.getItem(UI_SETTINGS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { locale?: unknown };
    return isSupportedLocale(parsed.locale) ? parsed.locale : null;
  } catch {
    return null;
  }
}

// Used at i18n bootstrap time (module init, before Pinia/ui-settings-store
// hydrates on hex-world-map's onMounted) so the first render already uses a
// previously chosen locale instead of flashing the browser-detected default.
export function resolveInitialLocale(): TLocale {
  return readPersistedLocale() ?? detectBrowserLocale();
}
