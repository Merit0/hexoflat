import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUiSettingsStore } from './ui-settings-store';
import { i18n } from '@/i18n';

const UI_SETTINGS_KEY = 'hexoflat:ui-settings:v1';

type PersistedUiSettings = {
  showHeroMoveTrail: boolean;
  locale: string;
};

function readPersisted(): PersistedUiSettings {
  return JSON.parse(localStorage.getItem(UI_SETTINGS_KEY)!) as PersistedUiSettings;
}

describe('useUiSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    i18n.global.locale.value = 'en';
  });

  describe('defaults', () => {
    it('defaults showHeroMoveTrail to true', () => {
      const store = useUiSettingsStore();
      expect(store.showHeroMoveTrail).toBe(true);
    });

    it('defaults locale to a supported locale', () => {
      const store = useUiSettingsStore();
      expect(['uk', 'en']).toContain(store.locale);
    });
  });

  describe('toggles and setters', () => {
    it('toggleHeroMoveTrail flips the flag and persists it', () => {
      const store = useUiSettingsStore();
      store.toggleHeroMoveTrail();
      expect(store.showHeroMoveTrail).toBe(false);

      const persisted = readPersisted();
      expect(persisted.showHeroMoveTrail).toBe(false);
    });

    it('setHeroMoveTrail sets the flag explicitly and persists it', () => {
      const store = useUiSettingsStore();
      store.setHeroMoveTrail(false);
      expect(store.showHeroMoveTrail).toBe(false);
      store.setHeroMoveTrail(true);
      expect(store.showHeroMoveTrail).toBe(true);
    });
  });

  describe('setLocale', () => {
    it('updates store state, the global i18n locale, and persists the choice', () => {
      const store = useUiSettingsStore();

      store.setLocale('uk');

      expect(store.locale).toBe('uk');
      expect(i18n.global.locale.value).toBe('uk');

      const persisted = readPersisted();
      expect(persisted.locale).toBe('uk');
    });
  });

  describe('hydrateFromStorage', () => {
    it('does nothing when there is nothing persisted yet', () => {
      const store = useUiSettingsStore();
      const before = { ...store.$state };

      store.hydrateFromStorage();

      expect(store.$state).toEqual(before);
    });

    it('restores persisted flags and locale, and syncs the global i18n locale', () => {
      localStorage.setItem(
        UI_SETTINGS_KEY,
        JSON.stringify({
          showHeroMoveTrail: false,
          locale: 'uk',
        }),
      );

      const store = useUiSettingsStore();
      store.hydrateFromStorage();

      expect(store.showHeroMoveTrail).toBe(false);
      expect(store.locale).toBe('uk');
      expect(i18n.global.locale.value).toBe('uk');
    });

    it('falls back to a browser-detected locale when the persisted locale is invalid', () => {
      localStorage.setItem(
        UI_SETTINGS_KEY,
        JSON.stringify({ showHeroMoveTrail: true, locale: 'fr' }),
      );

      const store = useUiSettingsStore();
      store.hydrateFromStorage();

      expect(['uk', 'en']).toContain(store.locale);
      expect(i18n.global.locale.value).toBe(store.locale);
    });

    it('falls back to defaults for flags missing from an older persisted payload', () => {
      localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify({ locale: 'uk' }));

      const store = useUiSettingsStore();
      store.hydrateFromStorage();

      expect(store.showHeroMoveTrail).toBe(true);
      expect(store.locale).toBe('uk');
    });
  });
});
