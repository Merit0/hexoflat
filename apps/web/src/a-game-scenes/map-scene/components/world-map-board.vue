<template>
  <div class="world-board">
    <div ref="containerRef" class="hex-map" data-testid="hex-map">
      <canvas
        ref="boardCanvasRef"
        class="hex-board-canvas"
        data-testid="hex-board-canvas"
        :data-ready="isBoardReady && !lootFlying ? '1' : undefined"
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
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch, toRef } from 'vue';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useSquadViews } from '@/services/squads/squad-views';
import { lootFlightRequest, lootFlying } from '@/services/loot/loot-flight-state';
import { useHexBoard } from '@/render/use-hex-board';
import { useTileClick } from '@/composables/use-tile-click';
import { useMovePreview } from '@/composables/use-move-preview';
import { useBoardCamera } from '@/composables/use-board-camera';
import { useHexBoardInput } from '@/composables/use-hex-board-input';
import { useHexHoverInfo } from '@/composables/use-hex-hover-info';
import { useDevBoardPanelStore } from '@/stores/dev-board-panel-store';
import { useStaticBoardEditorStore } from '@/stores/static-board-editor-store';
import BoardOverlayLayer from '@/components/gui/board/board-overlay-layer.vue';
import ToolHexTile from './tool-hex-tile.vue';
import { resolveActions } from '@hexoflat/engine/game-resolvers/interactions-resolver';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import type { TilePointer } from '@/render/layers/tiles-layer';

const props = defineProps<{ stageElement: HTMLElement | null }>();
const worldStore = useWorldMapStore();
const heroStore = useHeroStore();
const heroToolStore = useHeroToolStore();
const { handleTileClick } = useTileClick();
const squadViews = useSquadViews();
const hoveredTileCoord = ref<IHexCoordinates | null>(null);
const healTickerNow = ref(Date.now());
let healTickerTimer: number | null = null;
const RULE_HIGHLIGHT_TINT = 0xffe66d;
const SHOW_DEV_TOOLS = import.meta.env.DEV && import.meta.env.VITE_E2E_HOOKS !== 'true';
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
const { containerRef, canvasSize, frameRect, camera, screenTileSize } = useBoardCamera(
  boardFrame,
  heroCoordinatesComputed,
  toRef(props, 'stageElement'),
);

function getTileByCoord(coord: IHexCoordinates) {
  const tiles = worldStore.map?.tiles as HexTileModel[] | undefined;
  return tiles?.find(
    (t: HexTileModel) =>
      t.coordinates.rowIndex === coord.rowIndex && t.coordinates.columnIndex === coord.columnIndex,
  );
}

watch(
  () => [heroToolStore.isDragging, heroToolStore.activeTool, heroToolStore.hover] as const,
  ([dragging, tool, hover]) => {
    const tile = hover ? getTileByCoord(hover) : null;
    heroToolStore.setResolvedActions(
      dragging && tool && tile?.hexobject?.isInteractable
        ? resolveActions(tool, tile.hexobject)
        : [],
    );
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
  lootFlight: lootFlightRequest,
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

function onHide() {
  if (heroToolStore.isLocked) heroToolStore.cancelLockedAction('HIDE');
  heroToolStore.stopTool();
}
useHexBoardInput({ hoveredTileCoord });
onMounted(() => {
  healTickerTimer = window.setInterval(() => {
    healTickerNow.value = Date.now();
  }, 250);
});
onBeforeUnmount(() => {
  hexHoverInfo.hide();
  if (healTickerTimer) window.clearInterval(healTickerTimer);
});
defineExpose({ camera, canvasSize, isBoardReady });
</script>
<style scoped>
.world-board {
  width: 100%;
  height: 100%;
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
</style>
