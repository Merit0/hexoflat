<template>
  <div class="scene-root game-root" data-testid="map-scene-root" :style="sceneLayoutStyle">
    <div class="map-pane">
      <component :is="DevBoardPanel" v-if="DevBoardPanel" />
      <combat-hud />
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
      <div ref="containerRef" class="hex-map" data-testid="hex-map">
        <canvas
          ref="boardCanvasRef"
          class="hex-board-canvas"
          data-testid="hex-board-canvas"
          :data-ready="isBoardReady ? '1' : undefined"
        />

        <div class="hex-board-overlays" data-testid="hex-map-inner" :style="overlayStyle">
          <div v-if="combatStore.combatActive" class="combat-alert-overlay"></div>

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
        </div>
      </div>
      <component
        :is="StaticBoardEditorPanel"
        v-if="StaticBoardEditorPanel && staticBoardEditorStore?.isEditing"
      />
    </div>
    <hero-board-panel />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useCombatStore } from '@/stores/combat-store';
import { useHexBoard } from '@/render/use-hex-board';
import { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import { useTileClick } from '@/composables/use-tile-click';
import { useMovePreview } from '@/composables/use-move-preview';
import { useBoardCamera } from '@/composables/use-board-camera';
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
import { computeZoneTints } from '@/services/world/zone-tint';
import ToolHexTile from '@/a-game-scenes/map-scene/components/tool-hex-tile.vue';
import CombatHud from '@/a-game-scenes/map-scene/components/combat-hud.vue';
import ActionAlertBanner from '@/a-game-scenes/map-scene/components/action-alert-banner.vue';
import { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { coordinateKey, getHexNeighbors, hexDistance } from '@hexoflat/engine/utils/hex-utils';
import { EHexCollision, EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
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
const worldStore = useWorldMapStore();
const combatStore = useCombatStore();
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

const DevBoardPanel = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./dev-board-panel.vue'))
  : null;
const StaticBoardEditorPanel = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./static-board-editor-panel.vue'))
  : null;
const StaticBoardCoordinatesOverlay = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./static-board-coordinates-overlay.vue'))
  : null;
const devBoardPanelStore = import.meta.env.DEV ? useDevBoardPanelStore() : null;
const staticBoardEditorStore = import.meta.env.DEV ? useStaticBoardEditorStore() : null;
const devPanelOptions = import.meta.env.DEV
  ? {
      showWholeBoard: computed(
        () => staticBoardEditorStore?.isEditing || (devBoardPanelStore?.showWholeBoard ?? false),
      ),
      zoneTintByCoordinateKey: computed(() =>
        devBoardPanelStore?.showZoneOutlines
          ? computeZoneTints(worldStore.descriptor)
          : new Map<string, number>(),
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
      getPaneSize: () => paneSize.value,
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
const activeTool = computed(() => heroToolStore.activeTool);

function handleTileHover(tile: IHexTile) {
  hoveredTileCoord.value = tile.coordinates;
  if (heroToolStore.isDragging) {
    heroToolStore.updateHover(tile.coordinates);
  }
}

const boardCanvasRef = ref<HTMLCanvasElement | null>(null);
const isBoardReady = ref(false);

const heroCoordinatesComputed = computed(() => heroStore.heroCoordinates);
const { containerRef, paneSize, frameRect, camera, screenTileSize } = useBoardCamera(
  boardFrame,
  heroCoordinatesComputed,
);
const overlayStyle = computed(() => ({
  width: `${(frameRect.value?.width ?? 0) * camera.value.zoom}px`,
  height: `${(frameRect.value?.height ?? 0) * camera.value.zoom}px`,
  transform: `translate(${camera.value.x}px, ${camera.value.y}px)`,
  '--hex-tile-width': `${screenTileSize.value.w}px`,
  '--hex-tile-height': `${screenTileSize.value.h}px`,
}));
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

const enemyVisionCells = computed(() => {
  if (!uiSettingsStore.showEnemyVisionArea) return [];
  if (!worldStore.map) return [];

  const cells = new Map<string, { key: string; coord: IHexCoordinates }>();

  for (const enemyTile of worldStore.map.tiles) {
    const hexobject = enemyTile.hexobject;
    if (!hexobject || hexobject.groupType !== EHexobjectGroup.CREATURE) continue;
    if (hexobject.creature?.faction !== 'enemy') continue;
    if (!enemyTile.isRevealed) continue;

    const visionRange = hexobject.creature.visionRange ?? 3;
    for (const tile of worldStore.map.tiles) {
      if (!tile.isRevealed) continue;
      if (hexDistance(enemyTile.coordinates, tile.coordinates) > visionRange) continue;

      cells.set(coordinateKey(tile.coordinates), {
        key: coordinateKey(tile.coordinates),
        coord: tile.coordinates,
      });
    }
  }

  return [...cells.values()];
});

const isHeroInEnemyVision = computed(() => {
  return combatStore.getEnemyTilesSeeingHero().length > 0;
});

const combatMarkers = computed(() => {
  return combatStore.combatMarkers
    .filter((marker) => marker.kind !== 'defend')
    .filter((marker) => marker.visible)
    .map((marker) => ({
      key: `${marker.owner}:${marker.kind}:${coordinateKey(marker.coord)}`,
      owner: marker.owner,
      coord: marker.coord,
    }));
});

const activeCampfireActionTile = computed(() => {
  if (!worldStore.map) return null;

  return (
    worldStore.map.tiles.find(
      (tile) =>
        tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.FIREPLACE &&
        tile.pendingAction?.type === EHexActionType.USE &&
        (tile.pendingAction.endsAt ?? 0) > healTickerNow.value,
    ) ?? null
  );
});

const isCampfireHealActive = computed(() => Boolean(activeCampfireActionTile.value?.pendingAction));

const campHealEffectCoord = computed(() => {
  if (!isCampfireHealActive.value || !heroStore.heroCoordinates) return null;

  const neighborTiles = (
    getHexNeighbors(heroStore.heroCoordinates)
      .map((coord) => getTileByCoord(coord))
      .filter(Boolean) as IHexTile[]
  )
    .filter((tile) => tile.isRevealed)
    .filter((tile) => tile.hexobject?.collision !== EHexCollision.SOLID);

  const emptyTile = neighborTiles.find((tile) => !tile.hexobject);
  if (emptyTile) return emptyTile.coordinates;

  const nonFireplaceTile = neighborTiles.find(
    (tile) => tile.hexobject?.hexobjectKey !== HEXOBJECT_KEYS.FIREPLACE,
  );
  return nonFireplaceTile?.coordinates ?? null;
});

const campHealInfoLabel = computed(() => {
  const maxHp = Math.max(1, Number(heroStore.hero.maxHealth ?? 1));
  const percentPerTick = Math.round((1 / maxHp) * 100);
  return `${percentPerTick}%/10с`;
});

watch(
  isHeroInEnemyVision,
  (inVision) => {
    if (inVision && !combatStore.combatActive) {
      combatStore.startCombat();
    }
  },
  { immediate: true },
);

useHexBoard({
  canvasRef: boardCanvasRef,
  paneSize,
  camera,
  tiles,
  tilesDirtyTick,
  heroCoordinates: heroCoordinatesComputed,
  healTickerNow,
  movePreview,
  enemyVisionCells,
  combatMarkers,
  campHeal: {
    coord: campHealEffectCoord,
    active: isCampfireHealActive,
    label: campHealInfoLabel,
  },
  onTileHover: handleTileHover,
  onTileClick: (tile) => {
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
    worldMapStore.saveToStorage();
  }
  heroToolStore.stopTool();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  if (!heroToolStore.isDragging && !heroToolStore.activeTool) return;

  event.preventDefault();
  onHide();
}

useHexBoardInput({ hoveredTileCoord });

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  healTickerTimer = window.setInterval(() => {
    healTickerNow.value = Date.now();
  }, 250);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
  if (healTickerTimer) {
    window.clearInterval(healTickerTimer);
    healTickerTimer = null;
  }
});
</script>

<style scoped>
.scene-root {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #0b0d11;
  position: relative;

  display: grid;
  grid-template-columns: var(--map-pane-width) var(--hero-board-panel-width);
  transition: grid-template-columns 260ms ease;
}

.map-pane {
  position: relative;
  height: 100vh;
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

.hex-map {
  position: relative;
  width: 100%;
  height: 100%;

  background-image: url('/board-assets/dark-board-stones.png');
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;

  overflow: hidden;
}

.hex-board-overlays {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.hex-board-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.combat-alert-overlay {
  position: absolute;
  inset: -18px;
  pointer-events: none;
  z-index: 120;
  border: 2px solid rgba(255, 92, 92, 0.82);
  box-shadow:
    inset 0 0 0 1px rgba(255, 160, 160, 0.35),
    inset 0 0 64px rgba(120, 0, 0, 0.18),
    0 0 28px rgba(255, 70, 70, 0.2);
  background: radial-gradient(circle at center, rgba(255, 0, 0, 0) 54%, rgba(120, 0, 0, 0.1) 100%);
  animation: combatPulse 1.2s ease-in-out infinite;
}

@keyframes combatPulse {
  0%,
  100% {
    opacity: 0.75;
  }

  50% {
    opacity: 1;
  }
}
</style>
