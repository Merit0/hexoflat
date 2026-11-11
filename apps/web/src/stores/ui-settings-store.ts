import { defineStore } from 'pinia';
import { i18n } from '@/i18n';
import { detectBrowserLocale, isSupportedLocale, type TLocale } from '@/i18n/locale';

type UiSettingsState = {
  showHeroMoveTrail: boolean;
  locale: TLocale;
  freeShopRefresh: boolean;
};

const UI_SETTINGS_KEY = 'hexoflat:ui-settings:v1';

function defaultState(): UiSettingsState {
  return {
    showHeroMoveTrail: true,
    locale: detectBrowserLocale(),
    freeShopRefresh: false,
  };
}

export const useUiSettingsStore = defineStore('ui-settings-store', {
  state: (): UiSettingsState => defaultState(),

  actions: {
    hydrateFromStorage() {
      const raw = localStorage.getItem(UI_SETTINGS_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<UiSettingsState>;
      this.showHeroMoveTrail = parsed.showHeroMoveTrail ?? true;
      this.freeShopRefresh = parsed.freeShopRefresh === true;
      this.locale = isSupportedLocale(parsed.locale) ? parsed.locale : detectBrowserLocale();
      i18n.global.locale.value = this.locale;
    },

    saveToStorage() {
      localStorage.setItem(
        UI_SETTINGS_KEY,
        JSON.stringify({
          showHeroMoveTrail: this.showHeroMoveTrail,
          locale: this.locale,
          freeShopRefresh: this.freeShopRefresh,
        } satisfies UiSettingsState),
      );
    },

    toggleHeroMoveTrail() {
      this.showHeroMoveTrail = !this.showHeroMoveTrail;
      this.saveToStorage();
    },

    setHeroMoveTrail(value: boolean) {
      this.showHeroMoveTrail = value;
      this.saveToStorage();
    },

    setFreeShopRefresh(value: boolean) {
      this.freeShopRefresh = value;
      this.saveToStorage();
    },

    setLocale(value: TLocale) {
      this.locale = value;
      i18n.global.locale.value = value;
      this.saveToStorage();
    },
  },
});
