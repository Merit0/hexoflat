<template>
  <div class="scene-root game-root" data-testid="map-scene-root">
    <hero-details-top-bar />
    <combat-hud />
    <div class="hex-map" data-testid="hex-map">
      <div class="hex-map-wrapper" :style="{ transform: `scale(${scale})` }">
        <div ref="probeRef" class="hex-probe" aria-hidden="true"></div>

        <div
          class="hex-map-inner"
          data-testid="hex-map-inner"
          :style="{
            width: mapBounds.width + 'px',
            height: mapBounds.height + 'px',
            transform: `translate(${Math.round(-mapBounds.offsetX)}px, ${Math.round(-mapBounds.offsetY)}px)`,
          }"
        >
          <div v-if="combatStore.combatActive" class="combat-alert-overlay"></div>

          <canvas
            ref="boardCanvasRef"
            class="hex-board-canvas"
            data-testid="hex-board-canvas"
            :data-ready="isBoardReady ? '1' : undefined"
          />

          <tool-hex-tile
            v-if="heroToolStore.isDragging && activeTool"
            :tile-width="domTileW"
            :tile-height="domTileH"
            :tool="activeTool"
            @hide="onHide"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useCombatStore } from '@/stores/combat-store';
import { useHexBoard } from '@/render/use-hex-board';
import { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import { useTileClick } from '@/composables/use-tile-click';
import { useMovePreview } from '@/composables/use-move-preview';
import { useHexBoardSizing } from '@/composables/use-hex-board-sizing';
import { useHexBoardInput } from '@/composables/use-hex-board-input';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import {
  resolveActions,
  ResolvedAction,
} from '@hexoflat/engine/game-resolvers/interactions-resolver';
import HeroDetailsTopBar from '@/a-game-scenes/map-scene/components/hero-details-top-bar.vue';
import ToolHexTile from '@/a-game-scenes/map-scene/components/tool-hex-tile.vue';
import CombatHud from '@/a-game-scenes/map-scene/components/combat-hud.vue';
import { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { coordinateKey, getOddQNeighbors, hexDistance } from '@hexoflat/engine/utils/hex-utils';
import { EHexCollision, EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroStore } from '@/stores/hero-store';
import { useUiSettingsStore } from '@/stores/ui-settings-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
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
const hoveredTileCoord = ref<IHexCoordinates | null>(null);
const healTickerNow = ref(Date.now());
let healTickerTimer: number | null = null;

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
      getMapBounds: () => mapBounds.value,
      getTileSize: () => ({ w: domTileW.value, h: domTileH.value }),
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

const tiles = computed(() => worldStore.map?.tiles ?? []);
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

const { probeRef, domTileW, domTileH, domTileSize, mapBounds, scale } = useHexBoardSizing(tiles);

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
    getOddQNeighbors(heroStore.heroCoordinates)
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

const heroCoordinatesComputed = computed(() => heroStore.heroCoordinates);

useHexBoard({
  canvasRef: boardCanvasRef,
  mapBounds,
  domTileSize,
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
    void handleTileClick(tile);
  },
  onOpenHeroInventory: () => useOverlayStore().openOverlay('hero-inventory'),
  onBoardReady: () => {
    isBoardReady.value = true;
  },
});

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
}

.hex-map {
  display: grid;
  place-items: center;
  width: 100vw;
  height: 100vh;
  padding-top: 5%;

  background-image: url('/board-assets/dark-board-stones.png');
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;

  overflow: hidden;
}

.hex-map-wrapper {
  width: max-content;
  height: max-content;
  transform-origin: center center;
  position: relative;
}

.hex-probe {
  position: absolute;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  visibility: hidden;
  pointer-events: none;
}

.hex-map-inner {
  position: relative;
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
