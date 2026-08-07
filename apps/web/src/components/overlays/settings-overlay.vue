<template>
  <div
    class="overlay-backdrop game-root"
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-overlay-title"
    tabindex="-1"
    @click.self="close"
  >
    <div class="overlay-card">
      <header class="overlay-header">
        <h2 id="settings-overlay-title">{{ t('settings.title') }}</h2>
        <button class="close-btn" data-testid="settings-close-button" type="button" @click="close">
          {{ t('settings.close') }}
        </button>
      </header>

      <label class="setting-row">
        <input
          data-testid="settings-move-trail-checkbox"
          :checked="uiSettings.showHeroMoveTrail"
          type="checkbox"
          @change="uiSettings.setHeroMoveTrail(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t('settings.showHeroMoveTrail') }}</span>
      </label>

      <label class="setting-row">
        <input
          data-testid="settings-vision-checkbox"
          :checked="uiSettings.showEnemyVisionArea"
          type="checkbox"
          @change="uiSettings.setEnemyVisionArea(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t('settings.showEnemyVisionArea') }}</span>
      </label>

      <label class="setting-row">
        <span>{{ t('settings.language') }}</span>
        <select
          data-testid="settings-locale-select"
          :value="uiSettings.locale"
          @change="uiSettings.setLocale(($event.target as HTMLSelectElement).value as TLocale)"
        >
          <option v-for="locale in SUPPORTED_LOCALES" :key="locale" :value="locale">
            {{ LOCALE_LABELS[locale] }}
          </option>
        </select>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useOverlayStore } from '@/stores/overlay-store';
import { useUiSettingsStore } from '@/stores/ui-settings-store';
import { SUPPORTED_LOCALES, type TLocale } from '@/i18n/locale';

const LOCALE_LABELS: Record<TLocale, string> = {
  uk: 'Українська',
  en: 'English',
};

const { t } = useI18n();
const overlayStore = useOverlayStore();
const uiSettings = useUiSettingsStore();

function close() {
  overlayStore.closeOverlay('settings');
}
</script>

<style scoped>
.overlay-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
}

.overlay-card {
  width: min(460px, 92vw);
  display: grid;
  gap: 18px;
  padding: 20px;
  border-radius: 18px;
  background: rgba(10, 13, 18, 0.96);
  border: 1px solid rgba(190, 220, 255, 0.16);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.48);
}

.overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.overlay-header h2 {
  margin: 0;
  color: rgba(240, 248, 255, 0.96);
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(190, 220, 255, 0.12);
  color: rgba(220, 235, 255, 0.92);
  cursor: pointer;
}

.setting-row input {
  width: 18px;
  height: 18px;
}

.setting-row select {
  margin-left: auto;
  border-radius: 8px;
  border: 1px solid rgba(190, 220, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(240, 248, 255, 0.95);
  padding: 6px 10px;
}

.close-btn {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(240, 248, 255, 0.95);
  cursor: pointer;
}
</style>
