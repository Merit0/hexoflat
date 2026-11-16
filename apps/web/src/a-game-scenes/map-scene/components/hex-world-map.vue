<template>
  <div
    ref="stageRef"
    class="scene-root game-root"
    :class="{ 'is-knowledge': !!knowledgePanelMode }"
    data-testid="map-scene-root"
    :style="sceneLayoutStyle"
  >
    <div class="map-pane">
      <component :is="DevBoardPanel" v-if="DevBoardPanel" />
      <quest-tracker-button v-else />
      <action-alert-banner />
      <div class="map-session-controls">
        <button
          class="icon-btn"
          type="button"
          aria-label="Settings"
          data-testid="topbar-settings-button"
          @click="openSettings"
        >
          ⚙
        </button>
        <button
          class="icon-btn icon-btn--logout"
          type="button"
          aria-label="Logout"
          data-testid="topbar-logout-button"
          @click="userStore.logout()"
        >
          ⏻
        </button>
      </div>
      <gameplay-board-host ref="boardHost" :stage-element="stageRef" />
    </div>
    <hero-board-panel />
    <hex-info-tooltip />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { devBoardPanelEnabled } from '@/composables/dev-board-panel-flag';
import { closeKnowledgePanel, knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useKnowledgeChallenge } from '@/composables/use-knowledge-challenge';
import { useGameLayout } from '@/composables/use-game-layout';
import { useQuestMapRoute } from '@/composables/use-quest-map-route';
import { useStopToolWhenUnequipped } from '@/composables/use-stop-tool-when-unequipped';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useUiSettingsStore } from '@/stores/ui-settings-store';
import { useUserStore } from '@/stores/user-store';
import { useOverlayStore } from '@/stores/overlay-store';
import { useSquadFlow } from '@/services/squads/squad-flow';
import { installTestHooks, uninstallTestHooks } from '@/e2e/test-hooks';
import { createTestApi } from '@/e2e/create-test-api';
import { usePresenceRoute } from '@/composables/use-presence-route';
import { IDENTITY_CAMERA } from '@/render/board-camera';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import GameplayBoardHost from './gameplay-board-host.vue';
import HeroBoardPanel from './hero-board-panel.vue';
import QuestTrackerButton from './quests/quest-tracker-button.vue';
import ActionAlertBanner from './action-alert-banner.vue';
import HexInfoTooltip from '@/components/gui/hex-info/hex-info-tooltip.vue';

const props = defineProps<{ locationKey?: LocationKey }>();
const stageRef = ref<HTMLElement | null>(null);
const boardHost = ref<InstanceType<typeof GameplayBoardHost> | null>(null);
const worldStore = useWorldMapStore();
const heroToolStore = useHeroToolStore();
const userStore = useUserStore();
const overlayStore = useOverlayStore();
const SHOW_DEV_TOOLS = import.meta.env.DEV && import.meta.env.VITE_E2E_HOOKS !== 'true';
const DevBoardPanel =
  SHOW_DEV_TOOLS && devBoardPanelEnabled()
    ? defineAsyncComponent(() => import('./dev-board-panel.vue'))
    : null;
const { sceneLayoutStyle } = useGameLayout();
useQuestMapRoute(() => worldStore.currentLocationKey);
useSquadFlow();
useKnowledgeChallenge();
usePresenceRoute(() => props.locationKey);
onMounted(() => {
  worldStore.bootstrapWorld();
  boardHost.value?.syncSimulation();
  useUiSettingsStore().hydrateFromStorage();
  useHeroInventoryStore().hydrate();
  window.addEventListener('keydown', onKeyDown);
  if (import.meta.env.VITE_E2E_HOOKS === 'true') {
    installTestHooks(
      createTestApi({
        getCamera: () => boardHost.value?.worldCamera ?? IDENTITY_CAMERA,
        getCanvasSize: () => boardHost.value?.worldCanvasSize ?? { width: 0, height: 0 },
        isBoardReady: () => boardHost.value?.worldReady ?? false,
      }),
    );
  }
});
function openSettings() {
  overlayStore.openOverlay('settings');
}
function onHide() {
  if (heroToolStore.isLocked) heroToolStore.cancelLockedAction('HIDE');
  heroToolStore.stopTool();
}
function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  if (knowledgePanelMode.value) {
    event.preventDefault();
    void closeKnowledgePanel(false);
    return;
  }
  if (heroToolStore.isDragging || heroToolStore.activeTool) {
    event.preventDefault();
    onHide();
  }
}
useStopToolWhenUnequipped(onHide);
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
  worldStore.stopWorldLoop();
  if (import.meta.env.VITE_E2E_HOOKS === 'true') uninstallTestHooks();
});
</script>
<style scoped>
@media (max-width: 760px) {
  .scene-root.is-knowledge .map-pane {
    pointer-events: none;
  }
}
.scene-root {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0b0d11;
  position: relative;

  display: grid;
  grid-template-columns: minmax(0, var(--map-pane-width)) minmax(0, var(--hero-board-panel-width));
  transition: grid-template-columns 260ms ease;
}

.map-pane {
  position: relative;
  height: 100vh;
  min-width: 0;
  contain: inline-size;
  overflow: hidden;
}

.map-session-controls {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 150;
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(190, 220, 255, 0.16);
  background: rgba(10, 12, 16, 0.75);
  color: rgba(240, 248, 255, 0.9);
  font-size: 15px;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.45);
  cursor: pointer;
  display: grid;
  place-items: center;
  backdrop-filter: blur(4px);
}

.icon-btn:hover {
  border-color: rgba(230, 245, 255, 0.4);
  background: rgba(20, 24, 30, 0.9);
}

.icon-btn--logout {
  color: rgb(255, 197, 197);
  border-color: rgba(255, 197, 197, 0.3);
}

.icon-btn--logout:hover {
  border-color: rgba(255, 197, 197, 0.6);
  background: rgba(255, 197, 197, 0.1);
}
</style>
