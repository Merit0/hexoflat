import type { TestHexCoordinates } from '@web-test-api';

export const MapTokens = {
  knowledgeBook: { columnIndex: 10, rowIndex: 10 },
  stashChest: { columnIndex: 8, rowIndex: 9 },
  formerSwordSpot: { columnIndex: 11, rowIndex: 6 },
  formerAxeSpot: { columnIndex: 11, rowIndex: 7 },
  formerShieldSpot: { columnIndex: 11, rowIndex: 8 },
  formerPickaxeSpot: { columnIndex: 10, rowIndex: 9 },
  formerCoinsSpot: { columnIndex: 8, rowIndex: 7 },
  caveEntrance: { columnIndex: 10, rowIndex: 3 },
  homelandGate: { columnIndex: 7, rowIndex: 4 },
} as const satisfies Record<string, TestHexCoordinates>;

export type MapToken = keyof typeof MapTokens;

export function tokenCoordinates(token: MapToken): TestHexCoordinates {
  return MapTokens[token];
}

/** Hexobject keys the tests assert on. Mirrors packages/engine's HEXOBJECT_KEYS. */
export const HexobjectKeys = {
  axe: 'axe',
  stashChest: 'stash-chest',
  returnScroll: 'return-scroll',
  coins: 'coins',
  healthBottle: 'health-bottle',
  sword: 'sword',
  pickaxe: 'pickaxe',
  shield: 'shield',
  fireplace: 'fireplace',
  traderStall: 'trader-stall',
  returnPortal: 'return-portal',
  skeletonPack: 'skeleton-pack',
  boneCourt: 'bone-court',
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
export const BASE_HERO_HEALTH = { current: 3, max: 3 };

export const AuthText = {
  nameRequired: 'Enter your username to continue.',
  passwordRequired: 'Enter your password.',
  badCredentials: "That username and password don't match.",
  pickHeroFirst: 'First choose who is playing.',
  weakPassword: 'Make the password a little stronger.',
  guardianRequired: "Add a grown-up's email so they can confirm.",
  notAvailable: "This sign-in method isn't available yet.",
  newNameRequired: 'Choose a username.',
} as const;

export const NEW_HERO_PASSWORD = 'Strong-pass-1';
export const GUARDIAN_EMAIL = 'grown-up@example.com';
