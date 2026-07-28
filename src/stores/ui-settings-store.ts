import { defineStore } from 'pinia';

type UiSettingsState = {
  showHeroMoveTrail: boolean;
  showEnemyVisionArea: boolean;
};

const UI_SETTINGS_KEY = 'hexoflat:ui-settings:v1';

function defaultState(): UiSettingsState {
  return {
    showHeroMoveTrail: true,
    showEnemyVisionArea: true,
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
    },

    saveToStorage() {
      localStorage.setItem(
        UI_SETTINGS_KEY,
        JSON.stringify({
          showHeroMoveTrail: this.showHeroMoveTrail,
          showEnemyVisionArea: this.showEnemyVisionArea,
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
  },
});
