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
      <battle-board-area
        v-if="battleStore.isOpen"
        class="battle-pane"
        :reference-frame="boardFrame"
      />
      <div
        v-if="worldStore.worldLoadFailed"
        class="world-load-error"
        role="alert"
        data-testid="world-load-error"
      >
        <p>{{ t('world.loadError') }}</p>
        <button type="button" data-testid="world-load-retry" @click="worldStore.retryWorldLoad()">
          {{ t('world.retry') }}
        </button>
      </div>
      <div ref="containerRef" class="hex-map" data-testid="hex-map">
        <canvas
          ref="boardCanvasRef"
          class="hex-board-canvas"
          data-testid="hex-board-canvas"
          :data-ready="isBoardReady ? '1' : undefined"
        />

        <board-overlay-layer data-testid="hex-map-inner" :camera="camera" :frame-rect="frameRect">
          <tool-hex-tile
            v-if="heroToolStore.isDragging && activeTool"
            :tile-width="screenTileSize.w"
            :tile-height="screenTileSize.h"
            :tool="activeTool"
            @hide="onHide"
          />

          <component
            :is="StaticBoardCoordinatesOverlay"
            v-if="StaticBoardCoordinatesOverlay && staticBoardEditorStore?.isEditing"
            :tiles="tiles"
            :tile-width="screenTileSize.w"
            :tile-height="screenTileSize.h"
          />
        </board-overlay-layer>
      </div>
      <component
        :is="StaticBoardEditorPanel"
        v-if="StaticBoardEditorPanel && staticBoardEditorStore?.isEditing"
      />
    </div>
    <hero-board-panel />
    <hex-info-tooltip />
  </div>
</template>

<script setup lang="ts">
import { closeKnowledgePanel, knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useKnowledgeChallenge } from '@/composables/use-knowledge-challenge';
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useBattleStore } from '@/stores/battle-store';
import { useSquadFlow } from '@/services/squads/squad-flow';
import { useSquadViews } from '@/services/squads/squad-views';
import { useHexBoard } from '@/render/use-hex-board';
import { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import { useTileClick } from '@/composables/use-tile-click';
import { useMovePreview } from '@/composables/use-move-preview';
import { useBoardCamera } from '@/composables/use-board-camera';
import { useStopToolWhenUnequipped } from '@/composables/use-stop-tool-when-unequipped';
import { useHexBoardInput } from '@/composables/use-hex-board-input';
import { useGameLayout } from '@/composables/use-game-layout';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import {
  resolveActions,
  ResolvedAction,
} from '@hexoflat/engine/game-resolvers/interactions-resolver';
import HeroBoardPanel from '@/a-game-scenes/map-scene/components/hero-board-panel.vue';
import { useDevBoardPanelStore } from '@/stores/dev-board-panel-store';
import { useStaticBoardEditorStore } from '@/stores/static-board-editor-store';
import BoardOverlayLayer from '@/components/gui/board/board-overlay-layer.vue';
import ToolHexTile from '@/a-game-scenes/map-scene/components/tool-hex-tile.vue';
import BattleBoardArea from '@/a-game-scenes/map-scene/components/battle/battle-board-area.vue';
import HexInfoTooltip from '@/components/gui/hex-info/hex-info-tooltip.vue';
import { useHexHoverInfo } from '@/composables/use-hex-hover-info';
import type { TilePointer } from '@/render/layers/tiles-layer';
import ActionAlertBanner from '@/a-game-scenes/map-scene/components/action-alert-banner.vue';
import { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { useHeroStore } from '@/stores/hero-store';
import { useUiSettingsStore } from '@/stores/ui-settings-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useUserStore } from '@/stores/user-store';
import { useOverlayStore } from '@/stores/overlay-store';
import { installTestHooks, uninstallTestHooks } from '@/e2e/test-hooks';
import { createTestApi } from '@/e2e/create-test-api';

const props = defineProps<{
  locationKey: LocationKey;
}>();

const { handleTileClick } = useTileClick();
const { t } = useI18n();
const worldStore = useWorldMapStore();
const battleStore = useBattleStore();
useSquadFlow();
const squadViews = useSquadViews();
const heroToolStore = useHeroToolStore();
const worldMapStore = useWorldMapStore();
const heroStore = useHeroStore();
const uiSettingsStore = useUiSettingsStore();
const heroInventoryStore = useHeroInventoryStore();
const userStore = useUserStore();
const overlayStore = useOverlayStore();
const hoveredTileCoord = ref<IHexCoordinates | null>(null);
const healTickerNow = ref(Date.now());
let healTickerTimer: number | null = null;

const RULE_HIGHLIGHT_TINT = 0xffe66d;
const SHOW_DEV_TOOLS = import.meta.env.DEV && import.meta.env.VITE_E2E_HOOKS !== 'true';
const DevBoardPanel = SHOW_DEV_TOOLS
  ? defineAsyncComponent(() => import('./dev-board-panel.vue'))
  : null;
const StaticBoardEditorPanel = SHOW_DEV_TOOLS
  ? defineAsyncComponent(() => import('./static-board-editor-panel.vue'))
  : null;
const StaticBoardCoordinatesOverlay = SHOW_DEV_TOOLS
  ? defineAsyncComponent(() => import('./static-board-coordinates-overlay.vue'))
  : null;
const devBoardPanelStore = SHOW_DEV_TOOLS ? useDevBoardPanelStore() : null;
const staticBoardEditorStore = SHOW_DEV_TOOLS ? useStaticBoardEditorStore() : null;
const devPanelOptions = SHOW_DEV_TOOLS
  ? {
      showWholeBoard: computed(
        () => staticBoardEditorStore?.isEditing || (devBoardPanelStore?.showWholeBoard ?? false),
      ),
      zoneTintByCoordinateKey: computed(
        () =>
          new Map<string, number>(
            (devBoardPanelStore?.highlightedCellKeys ?? []).map((key) => [
              key,
              RULE_HIGHLIGHT_TINT,
            ]),
          ),
      ),
    }
  : undefined;

watch(
  () => props.locationKey,
  (locationKey) => {
    worldStore.goToLocation(locationKey);
  },
  { immediate: true },
);

useKnowledgeChallenge();
onMounted(() => worldStore.bootstrapWorld());
// The condition is inlined (rather than read from a helper) so Vite can
// statically fold it away: in any build without VITE_E2E_HOOKS=true this
// whole branch is dead code, both imports go unused, and the e2e hook
// modules never make it into the bundle at all.
onMounted(() => {
  if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
  installTestHooks(
    createTestApi({
      getCamera: () => camera.value,
      getCanvasSize: () => canvasSize.value,
      isBoardReady: () => isBoardReady.value,
    }),
  );
});
onBeforeUnmount(() => {
  if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
  uninstallTestHooks();
});
onMounted(() => uiSettingsStore.hydrateFromStorage());
onMounted(() => heroInventoryStore.hydrate());
onBeforeUnmount(() => worldStore.stopWorldLoop());

const tiles = computed(() => {
  if (staticBoardEditorStore?.isEditing && staticBoardEditorStore.draftMap) {
    return staticBoardEditorStore.draftMap.tiles;
  }
  return worldStore.map?.tiles ?? [];
});
const boardFrame = computed(() =>
  worldStore.map ? { width: worldStore.map.width, height: worldStore.map.height } : null,
);
const tilesDirtyTick = computed(() => worldStore.dirtyTick);
const boardKey = computed(() =>
  worldStore.currentMapId ? `${worldStore.currentLocationKey}:${worldStore.currentMapId}` : null,
);
const activeTool = computed(() => heroToolStore.activeTool);

const hexHoverInfo = useHexHoverInfo();

function handleTileHover(tile: IHexTile, point: TilePointer) {
  hoveredTileCoord.value = tile.coordinates;
  hexHoverInfo.show(tile.coordinates, point.anchor);
  if (heroToolStore.isDragging) {
    heroToolStore.updateHover(tile.coordinates);
  }
}

const boardCanvasRef = ref<HTMLCanvasElement | null>(null);
const isBoardReady = ref(false);

const heroCoordinatesComputed = computed(() => heroStore.heroCoordinates);
const { containerRef, stageRef, canvasSize, frameRect, camera, screenTileSize } = useBoardCamera(
  boardFrame,
  heroCoordinatesComputed,
);
const { sceneLayoutStyle } = useGameLayout();

function getTileByCoord(coord: IHexCoordinates) {
  const tiles = worldMapStore.map?.tiles as HexTileModel[] | undefined;
  return tiles?.find(
    (t: HexTileModel) =>
      t.coordinates.rowIndex === coord.rowIndex && t.coordinates.columnIndex === coord.columnIndex,
  );
}

watch(
  () => [heroToolStore.isDragging, heroToolStore.activeTool, heroToolStore.hover] as const,
  ([isDragging, tool, hover]) => {
    if (!isDragging || !tool || !hover) {
      heroToolStore.clearResolvedActions();
      return;
    }

    const tile = getTileByCoord(hover);
    if (!tile?.hexobject || !tile.hexobject.isInteractable) {
      heroToolStore.clearResolvedActions();
      return;
    }

    const actions: ResolvedAction[] = resolveActions(tool, tile.hexobject);
    heroToolStore.setResolvedActions(actions);
  },
  { immediate: true },
);

const movePreview = useMovePreview({ hoveredTileCoord, getTileByCoord });

useHexBoard({
  canvasRef: boardCanvasRef,
  canvasSize,
  camera,
  tiles,
  tilesDirtyTick,
  boardKey,
  heroCoordinates: heroCoordinatesComputed,
  healTickerNow,
  movePreview,
  squadWatched: squadViews.watched,
  onTileHover: handleTileHover,
  onTileMove: (_tile, point) => hexHoverInfo.move(point.anchor),
  onTileLeave: () => hexHoverInfo.hide(),
  onTileClick: (tile) => {
    hexHoverInfo.hide();
    if (devBoardPanelStore?.inspectMode) {
      devBoardPanelStore.inspect(tile.coordinates);
      return;
    }
    if (staticBoardEditorStore?.isEditing) {
      staticBoardEditorStore.selectHex(tile.coordinates);
      return;
    }
    void handleTileClick(tile);
  },
  onBoardReady: () => {
    isBoardReady.value = true;
  },
  devPanel: devPanelOptions,
});

function openSettings() {
  overlayStore.openOverlay('settings');
}

function onHide() {
  if (heroToolStore.isLocked) {
    heroToolStore.cancelLockedAction('HIDE');
  }
  heroToolStore.stopTool();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  if (knowledgePanelMode.value) {
    event.preventDefault();
    void closeKnowledgePanel(false);
    return;
  }
  if (!heroToolStore.isDragging && !heroToolStore.activeTool) return;

  event.preventDefault();
  onHide();
}

useHexBoardInput({ hoveredTileCoord });
useStopToolWhenUnequipped(onHide);

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  healTickerTimer = window.setInterval(() => {
    healTickerNow.value = Date.now();
  }, 250);
});

onBeforeUnmount(() => {
  hexHoverInfo.hide();
  window.removeEventListener('keydown', onKeyDown);
  if (healTickerTimer) {
    window.clearInterval(healTickerTimer);
    healTickerTimer = null;
  }
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

.world-load-error {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  text-align: center;
  background: rgba(10, 8, 6, 0.85);
  color: #f2e6cf;
}

.hex-map {
  position: relative;
  width: 100%;
  height: 100%;

  background-image: url('/board-assets/dark-board-stones.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-attachment: fixed;

  overflow: hidden;
}

.hex-board-canvas {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
}

.battle-pane {
  position: absolute;
  inset: 0;
  z-index: 140;
  background: #0b0d11;
}
</style>
