import { defineStore } from 'pinia';
import { i18n } from '@/i18n';
import { detectBrowserLocale, isSupportedLocale, type TLocale } from '@/i18n/locale';

type UiSettingsState = {
  showHeroMoveTrail: boolean;
  showEnemyVisionArea: boolean;
  locale: TLocale;
};

const UI_SETTINGS_KEY = 'hexoflat:ui-settings:v1';

function defaultState(): UiSettingsState {
  return {
    showHeroMoveTrail: true,
    showEnemyVisionArea: true,
    locale: detectBrowserLocale(),
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
      this.showEnemyVisionArea = parsed.showEnemyVisionArea ?? true;
      this.locale = isSupportedLocale(parsed.locale) ? parsed.locale : detectBrowserLocale();
      i18n.global.locale.value = this.locale;
    },

    saveToStorage() {
      localStorage.setItem(
        UI_SETTINGS_KEY,
        JSON.stringify({
          showHeroMoveTrail: this.showHeroMoveTrail,
          showEnemyVisionArea: this.showEnemyVisionArea,
          locale: this.locale,
        } satisfies UiSettingsState),
      );
    },

    toggleHeroMoveTrail() {
      this.showHeroMoveTrail = !this.showHeroMoveTrail;
      this.saveToStorage();
    },

    toggleEnemyVisionArea() {
      this.showEnemyVisionArea = !this.showEnemyVisionArea;
      this.saveToStorage();
    },

    setHeroMoveTrail(value: boolean) {
      this.showHeroMoveTrail = value;
      this.saveToStorage();
    },

    setEnemyVisionArea(value: boolean) {
      this.showEnemyVisionArea = value;
      this.saveToStorage();
    },

    setLocale(value: TLocale) {
      this.locale = value;
      i18n.global.locale.value = value;
      this.saveToStorage();
    },
  },
});
