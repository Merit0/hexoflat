import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  detectBrowserLocale,
  isSupportedLocale,
  resolveInitialLocale,
  SUPPORTED_LOCALES,
} from './locale';

const UI_SETTINGS_KEY = 'hexoflat:ui-settings:v1';

function stubNavigatorLanguage(language: string) {
  Object.defineProperty(navigator, 'language', {
    value: language,
    configurable: true,
  });
}

describe('locale', () => {
  const originalLanguage = navigator.language;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    stubNavigatorLanguage(originalLanguage);
  });

  describe('SUPPORTED_LOCALES', () => {
    it('lists uk and en', () => {
      expect(SUPPORTED_LOCALES).toEqual(['uk', 'en']);
    });
  });

  describe('isSupportedLocale', () => {
    it('accepts "uk" and "en"', () => {
      expect(isSupportedLocale('uk')).toBe(true);
      expect(isSupportedLocale('en')).toBe(true);
    });

    it('rejects anything else, including undefined and other locale-like strings', () => {
      expect(isSupportedLocale('fr')).toBe(false);
      expect(isSupportedLocale('EN')).toBe(false);
      expect(isSupportedLocale(undefined)).toBe(false);
      expect(isSupportedLocale(null)).toBe(false);
      expect(isSupportedLocale(42)).toBe(false);
    });
  });

  describe('detectBrowserLocale', () => {
    it('returns "en" when navigator.language starts with "en"', () => {
      stubNavigatorLanguage('en-US');
      expect(detectBrowserLocale()).toBe('en');
    });

    it('returns "uk" for a uk browser locale', () => {
      stubNavigatorLanguage('uk-UA');
      expect(detectBrowserLocale()).toBe('uk');
    });

    it('defaults to "uk" for unrecognized/other locales', () => {
      stubNavigatorLanguage('fr-FR');
      expect(detectBrowserLocale()).toBe('uk');
    });
  });

  describe('resolveInitialLocale', () => {
    it('prefers a persisted locale over the browser-detected one', () => {
      stubNavigatorLanguage('en-US');
      localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify({ locale: 'uk' }));

      expect(resolveInitialLocale()).toBe('uk');
    });

    it('falls back to the browser-detected locale when nothing is persisted', () => {
      stubNavigatorLanguage('en-US');

      expect(resolveInitialLocale()).toBe('en');
    });

    it('falls back to the browser-detected locale when the persisted value is invalid', () => {
      stubNavigatorLanguage('en-US');
      localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify({ locale: 'fr' }));

      expect(resolveInitialLocale()).toBe('en');
    });

    it('falls back to the browser-detected locale when storage holds malformed JSON', () => {
      stubNavigatorLanguage('en-US');
      localStorage.setItem(UI_SETTINGS_KEY, '{not json');

      expect(resolveInitialLocale()).toBe('en');
    });
  });
});
