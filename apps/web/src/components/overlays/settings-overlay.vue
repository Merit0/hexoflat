<template>
  <div class="overlay-backdrop game-root" @click.self="close">
    <div class="overlay-card">
      <header class="overlay-header">
        <h2>Settings</h2>
        <button class="close-btn" data-testid="settings-close-button" type="button" @click="close">
          Close
        </button>
      </header>

      <label class="setting-row">
        <input
          data-testid="settings-move-trail-checkbox"
          :checked="uiSettings.showHeroMoveTrail"
          type="checkbox"
          @change="uiSettings.setHeroMoveTrail(($event.target as HTMLInputElement).checked)"
        />
        <span>Show hero move trail</span>
      </label>

      <label class="setting-row">
        <input
          data-testid="settings-vision-checkbox"
          :checked="uiSettings.showEnemyVisionArea"
          type="checkbox"
          @change="uiSettings.setEnemyVisionArea(($event.target as HTMLInputElement).checked)"
        />
        <span>Show enemy vision area</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useOverlayStore } from '@/stores/overlay-store';
import { useUiSettingsStore } from '@/stores/ui-settings-store';

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

.close-btn {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(240, 248, 255, 0.95);
  cursor: pointer;
}
</style>
