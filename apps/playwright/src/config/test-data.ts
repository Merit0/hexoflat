import type { TestHexCoordinates } from '@web-test-api';

export const MapTokens = {
  starterAxe: { columnIndex: 11, rowIndex: 7 },
  stashChest: { columnIndex: 8, rowIndex: 9 },
} as const satisfies Record<string, TestHexCoordinates>;

export type MapToken = keyof typeof MapTokens;

export function tokenCoordinates(token: MapToken): TestHexCoordinates {
  return MapTokens[token];
}

/** Hexobject keys the tests assert on. Mirrors packages/engine's HEXOBJECT_KEYS. */
export const HexobjectKeys = {
  axe: 'axe',
  stashChest: 'stash-chest',
} as const;

/** Written by apps/web's ui-settings-store (`hexoflat:ui-settings:v1`). */
export const UI_SETTINGS_STORAGE_KEY = 'hexoflat:ui-settings:v1';

export const SUPPORTED_LOCALES = ['uk', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Translated label of the settings overlay's close button. Deliberately one
 * short, stable string per locale rather than a broad text sweep — the point
 * is to prove the ICU pipeline resolved *something* locale-specific at
 * runtime, not to re-test translation completeness (apps/web's vitest suite
 * already does that).
 */
export const SETTINGS_CLOSE_LABEL: Record<SupportedLocale, string> = {
  uk: 'Закрити',
  en: 'Close',
};

/** A fresh hero's starting HP — the regression guard against the 0/100 fallback. */
export const BASE_HERO_HEALTH = { current: 10, max: 10 };
