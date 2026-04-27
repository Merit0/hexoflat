<template>
  <div class="scene-root game-root">
    <hero-details-top-bar/>
    <combat-hud />
    <div class="hex-map">
      <div class="hex-map-wrapper" :style="{ transform: `scale(${scale})` }">
        <div ref="probeRef" class="hex-probe" aria-hidden="true"></div>

        <div
            class="hex-map-inner"
            :style="{
            width: mapBounds.width + 'px',
            height: mapBounds.height + 'px',
            transform: `translate(${Math.round(-mapBounds.offsetX)}px, ${Math.round(-mapBounds.offsetY)}px)`,
          }"
        >
          <enemy-vision-overlay
              :cells="enemyVisionCells"
              :in-combat="worldStore.combatActive"
          />

          <combat-marker-overlay :markers="combatMarkers" />

          <move-preview-overlay
              :segments="movePreviewSegments"
              :marker-style="movePreviewMarkerStyle"
              :reachable="movePreviewReachable"
          />

          <hero-hex-tile :coord="worldStore.heroCoordinates" :tileWidth="tileWidth" />

          <tool-hex-tile
              v-if="heroToolStore.isDragging && activeTool"
              :tileWidth="tileWidth"
              :tool="activeTool"
              @hide="onHide"
          />

          <hex-tile
              v-for="tile in tiles"
              :key="tile.tileId"
              :hex-tile="tile"
              @tile-click="handleTileClick"
              @tile-hover="handleTileHover"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useWorldMapStore } from "@/stores/world-map-store";
import HexTile from "@/a-game-scenes/map-scene/components/hex-tile.vue";
import HeroHexTile from "@/a-game-scenes/map-scene/components/hero-hex-tile.vue";
import { calcHexPixelPosition } from "@/utils/hex-utils";
import { useTileClick } from "@/composables/use-tile-click";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import {resolveActions, ResolvedAction} from "@/game-resolvers/interactions-resolver";
import HeroDetailsTopBar from "@/a-game-scenes/map-scene/components/hero-details-top-bar.vue";
import ToolHexTile from "@/a-game-scenes/map-scene/components/tool-hex-tile.vue";
import MovePreviewOverlay from "@/a-game-scenes/map-scene/components/move-preview-overlay.vue";
import EnemyVisionOverlay from "@/a-game-scenes/map-scene/components/enemy-vision-overlay.vue";
import CombatHud from "@/a-game-scenes/map-scene/components/combat-hud.vue";
import CombatMarkerOverlay from "@/a-game-scenes/map-scene/components/combat-marker-overlay.vue";
import {LocationKey} from "@/registry/world-map-registry";
import type { IHexTile } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import type { IHexCoordinates } from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import { findShortestPath } from "@/services/hero-movement/pathfinding-service";
import { getScoutMoveStepsForSteps } from "@/services/hero-movement/scout-progression";
import { coordinateKey, hexDistance } from "@/utils/hex-utils";
import { EHexCollision, EHexobjectGroup } from "@/abstraction/hexobject-abstraction";
import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import { useHeroStore } from "@/stores/hero-store";

const props = defineProps<{
  locationKey: LocationKey;
}>();

const { handleTileClick } = useTileClick();
const worldStore = useWorldMapStore();
const heroToolStore = useHeroToolStore();
const worldMapStore = useWorldMapStore();
const heroStore = useHeroStore();
const hoveredTileCoord = ref<IHexCoordinates | null>(null);

watch(
    () => props.locationKey,
    (locationKey) => {
      worldStore.goToLocation(locationKey);
    },
    { immediate: true }
);

onMounted(() => worldStore.bootstrapWorld());
onBeforeUnmount(() => worldStore.stopWorldLoop());

const tiles = computed(() => worldStore.map?.tiles ?? []);
const activeTool = computed(() => heroToolStore.activeTool);

const GRID_COLUMNS = 42;
const tileWidth = window.innerWidth / GRID_COLUMNS;

function handleTileHover(tile: IHexTile) {
  hoveredTileCoord.value = tile.coordinates;
}

/* ---------- probe for dom tile size ---------- */
const probeRef = ref<HTMLElement | null>(null);
const domTileW = ref(0);
const domTileH = ref(0);

function readDomTileSize() {
  const el = probeRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.width > 0) domTileW.value = r.width;
  if (r.height > 0) domTileH.value = r.height;
}

/* ---------- tool resolver ---------- */
function getTileByCoord(coord: any) {
  return worldMapStore.map.tiles.find((t: any) =>
      t.coordinates.rowIndex === coord.rowIndex &&
      t.coordinates.columnIndex === coord.columnIndex
  );
}

function getTileCenter(coord: IHexCoordinates) {
  const pseudoTile = { coordinates: coord } as any;
  const { x, y } = calcHexPixelPosition(pseudoTile, tileWidth);

  return {
    x: x + ((domTileW.value || 0) / 2),
    y: y + ((domTileH.value || 0) / 2),
  };
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
    { immediate: true }
);

const movePreview = computed(() => {
  if (!worldStore.map || !worldStore.heroCoordinates || !hoveredTileCoord.value) return null;
  if (heroToolStore.isDragging || worldStore.isHeroMoving) return null;
  if (worldStore.combatActive && worldStore.combatTurnSide !== "hero") return null;

  const heroKey = coordinateKey(worldStore.heroCoordinates);
  const targetKey = coordinateKey(hoveredTileCoord.value);
  if (heroKey === targetKey) return null;

  const targetTile = getTileByCoord(hoveredTileCoord.value);
  if (!targetTile) return null;

  const moveSteps = worldStore.combatActive
      ? worldStore.combatStepsLeft
      : getScoutMoveStepsForSteps(heroStore.hero?.heroSteps ?? 0);
  const path = findShortestPath(worldStore.map, worldStore.heroCoordinates, hoveredTileCoord.value, null);

  const isTraversableTarget = Boolean(
      targetTile.isRevealed &&
      targetTile.hexobject?.collision !== EHexCollision.SOLID &&
      targetTile.hexobject?.hexobjectKey !== HEXOBJECT_KEYS.CAMPING_ENTRANCE
  );

  const route = path?.slice(1) ?? [];
  const reachable = isTraversableTarget && route.length > 0 && route.length <= moveSteps;

  return {
    path,
    reachable,
    markerCoord: hoveredTileCoord.value,
  };
});

const movePreviewSegments = computed(() => {
  const path = movePreview.value?.path;
  if (!path || path.length < 2) return [];

  return path.slice(0, -1).map((fromCoord, index) => {
    const from = getTileCenter(fromCoord);
    const to = getTileCenter(path[index + 1]);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    return {
      style: {
        width: `${Math.round(length)}px`,
        transform: `translate(${Math.round(from.x)}px, ${Math.round(from.y)}px) rotate(${angle}deg)`,
      } as Record<string, string>,
    };
  });
});

const movePreviewMarkerStyle = computed(() => {
  const coord = movePreview.value?.markerCoord;
  if (!coord) return null;

  const center = getTileCenter(coord);

  return {
    transform: `translate(${Math.round(center.x)}px, ${Math.round(center.y)}px)`,
  } as Record<string, string>;
});

const movePreviewReachable = computed(() => movePreview.value?.reachable ?? false);

const enemyVisionCells = computed(() => {
  if (!worldStore.map) return [];

  const cells = new Map<string, { key: string; style: Record<string, string> }>();

  for (const enemyTile of worldStore.map.tiles) {
    const hexobject = enemyTile.hexobject;
    if (!hexobject || hexobject.groupType !== EHexobjectGroup.CREATURE) continue;
    if (hexobject.creature?.faction !== "enemy") continue;
    if (!enemyTile.isRevealed) continue;

    const visionRange = hexobject.creature.visionRange ?? 3;
    for (const tile of worldStore.map.tiles) {
      if (!tile.isRevealed) continue;
      if (hexDistance(enemyTile.coordinates, tile.coordinates) > visionRange) continue;

      const { x, y } = calcHexPixelPosition(tile, tileWidth);
      cells.set(coordinateKey(tile.coordinates), {
        key: coordinateKey(tile.coordinates),
        style: {
          transform: `translate(${x}px, ${y}px)`,
        },
      });
    }
  }

  return [...cells.values()];
});

const isHeroInEnemyVision = computed(() => {
  return worldStore.getEnemyTilesSeeingHero().length > 0;
});

const combatMarkers = computed(() => {
  return worldStore.combatMarkers.map((marker) => {
    const center = getTileCenter(marker.coord);
    return {
      key: `${marker.owner}:${coordinateKey(marker.coord)}`,
      owner: marker.owner,
      style: {
        transform: `translate(${Math.round(center.x)}px, ${Math.round(center.y)}px)`,
      } as Record<string, string>,
    };
  });
});

watch(
    isHeroInEnemyVision,
    (inVision) => {
      if (inVision && !worldStore.combatActive) {
        worldStore.startCombat();
      }
    },
    { immediate: true }
);

/* ---------- bounds ---------- */
const bleed = 2;

const mapBounds = computed(() => {
  const w = domTileW.value || 0;
  const h = domTileH.value || 0;

  if (!w || !h) {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const t of tiles.value) {
    const { x, y } = calcHexPixelPosition(t as any, tileWidth);

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }

  return {
    width: (maxX - minX) + bleed * 2,
    height: (maxY - minY) + bleed * 2,
    offsetX: minX - bleed,
    offsetY: minY - bleed,
  };
});

/* ---------- scale ---------- */
const scale = ref(1);

function updateScale() {
  const b = mapBounds.value;
  if (!b.width || !b.height) return;

  const padding = 40;
  const topbar = 64; // keep some space; map container already padded, this just helps scale
  const sx = (window.innerWidth - padding) / b.width;
  const sy = (window.innerHeight - padding - topbar) / b.height;

  scale.value = Math.min(sx, sy, 1.1);
}

function onHide() {
  if (heroToolStore.isLocked) {
    heroToolStore.cancelLockedAction("HIDE");
    worldMapStore.saveToStorage();
  }
  heroToolStore.stopTool();
}

function onResize() {
  readDomTileSize();
  updateScale();
}

watch(mapBounds, updateScale, { immediate: true });

onMounted(() => {
  requestAnimationFrame(() => {
    readDomTileSize();
    updateScale();
  });

  window.addEventListener("resize", onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
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

  background-image: url("/board-assets/dark-board-stones.png");
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
</style>
