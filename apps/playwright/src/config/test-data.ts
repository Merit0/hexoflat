import type { TestHexCoordinates } from '@web-test-api';

/**
 * Named landmarks on the 'camping' map, so specs and Features talk about
 * `'starterAxe'` instead of `{ columnIndex: 7, rowIndex: 2 }`. When the map
 * layout moves, exactly one line here changes.
 *
 * Coordinates come from packages/engine's `campingMapConfig`
 * (map-tiles-schema-provider.ts). That map is generated as a fixed rectangle
 * with a deterministic layout — no RNG, no fog (fogPolicy: 'ALL_REVEALED') —
 * which is what makes fixed landmarks safe to rely on at all.
 */
export const MapTokens = {
  /** A starter AXE (TOOL, pickable by hand) sitting in the safe camping zone. */
  starterAxe: { columnIndex: 7, rowIndex: 2 },
} as const satisfies Record<string, TestHexCoordinates>;

export type MapToken = keyof typeof MapTokens;

export function tokenCoordinates(token: MapToken): TestHexCoordinates {
  return MapTokens[token];
}

/** Hexobject keys the tests assert on. Mirrors packages/engine's HEXOBJECT_KEYS. */
export const HexobjectKeys = {
  axe: 'axe',
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
export const BASE_HERO_HEALTH = '10/10';
