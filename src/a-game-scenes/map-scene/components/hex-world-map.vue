<template>
  <div class="scene-root game-root">
    <!-- TOP BAR -->
    <header class="topbar">
      <div class="topbar__left">
        <div class="hero-badge">
          <div class="hero-badge__name">{{ heroName }}</div>
          <div class="hero-badge__sub">
            <span class="chip">Steps: <b>{{ heroSteps }}</b></span>
            <span class="chip">Pos: <b>q{{ heroQ }}</b> · <b>r{{ heroR }}</b></span>
          </div>
        </div>
      </div>

      <div class="topbar__center">
        <div class="stat">
          <div class="stat__label">HP</div>
          <div class="stat__bar">
            <div class="stat__fill" :style="{ width: hpPercent + '%' }"></div>
          </div>
          <div class="stat__value">{{ heroHp }}/{{ heroHpMax }}</div>
        </div>
      </div>

      <div class="topbar__right">
        <span class="chip" v-if="toolLabel">Tool: <b>{{ toolLabel }}</b></span>
        <span class="chip" v-if="heroToolStore.isLocked">Status: <b>LOCKED</b></span>
        <span class="chip muted" v-else>Status: <b>READY</b></span>
      </div>
    </header>

    <!-- MAP -->
    <div class="hex-map">
      <div class="hex-map-wrapper" :style="{ transform: `scale(${scale})` }">
        <!-- Probe to measure REAL DOM hex size in px -->
        <div ref="probeRef" class="hex-probe" aria-hidden="true"></div>

        <div
            class="hex-map-inner"
            :style="{
            width: mapBounds.width + 'px',
            height: mapBounds.height + 'px',
            transform: `translate(${Math.round(-mapBounds.offsetX)}px, ${Math.round(-mapBounds.offsetY)}px)`,
          }"
        >
          <hero-hex-tile :coord="worldStore.heroCoordinates" :tileWidth="tileWidth" />

          <tool-hex-tile
              v-if="heroToolStore.isDragging && activeTool"
              :coord="heroToolStore.hover"
              :tileWidth="tileWidth"
              :tool="activeTool"
              :actionHint="heroToolStore.hintLabel || undefined"
              @hide="onHide"
          />

          <hex-tile
              v-for="tile in tiles"
              :key="tile.tileId"
              :hex-tile="tile"
              @tile-click="handleTileClick"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { HexTileModel } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import { useWorldMapStore } from "@/stores/world-map-store";
import HexTile from "@/a-game-scenes/map-scene/components/hex-tile.vue";
import HeroHexTile from "@/a-game-scenes/map-scene/components/hero-hex-tile.vue";
import ToolHexTile from "@/a-game-scenes/map-scene/components/tool-hex-tile.vue";
import { calcHexPixelPosition } from "@/utils/hex-utils";
import { useTileClick } from "@/composables/use-tile-click";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import { resolveActions } from "@/game-resolvers/interactions-resolver";
import {useHeroStore} from "@/stores/hero-store";

const { handleTileClick } = useTileClick();
const heroStore = useHeroStore();
const worldStore = useWorldMapStore();
const heroToolStore = useHeroToolStore();
const worldMapStore = useWorldMapStore();

worldStore.loadFromStorage();
worldStore.generateIfEmpty();

const tiles = computed(() => worldStore.map?.tiles ?? []);
const activeTool = computed(() => heroToolStore.activeTool);

const GRID_COLUMNS = 42;
const tileWidth = window.innerWidth / GRID_COLUMNS;

/* ---------- TOP BAR SAFE DATA (fallback-friendly) ---------- */
const heroName = computed(() => heroStore.hero?.name ?? "Hero");
const heroSteps = computed(() => heroStore.hero?.heroSteps ?? 0);

const heroQ = computed(() => worldStore.heroCoordinates?.columnIndex ?? 0);
const heroR = computed(() => worldStore.heroCoordinates?.rowIndex ?? 0);

const heroHp = computed(() => (heroStore as any)?.heroHp ?? (worldStore as any)?.hero?.hp ?? 100);
const heroHpMax = computed(() => (heroStore as any)?.heroHpMax ?? (worldStore as any)?.hero?.hpMax ?? 100);

const hpPercent = computed(() => {
  const max = Math.max(1, Number(heroHpMax.value) || 1);
  const val = Math.max(0, Math.min(max, Number(heroHp.value) || 0));
  return Math.round((val / max) * 100);
});

const toolLabel = computed(() => {
  const t = activeTool.value;
  if (!t) return "";
  return String(t).toUpperCase();
});

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

      const actions = resolveActions(tool, tile.hexobject);
      heroToolStore.setResolvedActions(actions);
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

.topbar {
  position: fixed;
  inset: 0 0 auto 0;
  height: 64px;
  z-index: 5000;

  display: grid;
  grid-template-columns: 1fr minmax(260px, 420px) 1fr;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;

  background:
      linear-gradient(180deg, rgba(10, 12, 16, 0.92), rgba(10, 12, 16, 0.72));
  border-bottom: 1px solid rgba(220, 237, 255, 0.1);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
}

.topbar__left,
.topbar__center,
.topbar__right {
  display: flex;
  align-items: center;
}

.topbar__left { justify-content: flex-start; }
.topbar__center { justify-content: center; }
.topbar__right { justify-content: flex-end; gap: 8px; }

.hero-badge__name {
  font-family: var(--font-main, serif);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgba(232, 242, 255, 0.92);
  text-shadow: 0 2px 10px rgba(0,0,0,0.6);
}

.hero-badge__sub {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  height: 28px;
  padding: 0 10px;
  border-radius: 999px;

  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(190, 220, 255, 0.14);
  color: rgba(220, 235, 255, 0.90);

  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.chip b {
  font-weight: 800;
  color: rgba(240, 248, 255, 0.95);
}

.chip.muted {
  opacity: 0.75;
}

/* HP block */
.stat {
  display: grid;
  grid-template-columns: 34px 1fr auto;
  align-items: center;
  gap: 10px;
  width: min(420px, 50vw);
}

.stat__label {
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(190, 220, 255, 0.75);
}

.stat__bar {
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(190, 220, 255, 0.12);
  overflow: hidden;
}

.stat__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(150, 200, 255, 0.55), rgba(230, 245, 255, 0.85));
  box-shadow: 0 0 18px rgba(140, 185, 255, 0.25);
}

.stat__value {
  font-size: 12px;
  letter-spacing: 0.06em;
  color: rgba(230, 245, 255, 0.88);
}

/* --- map container under top bar --- */
.hex-map {
  display: grid;
  place-items: center;
  width: 100vw;
  height: 100vh;
  padding-top: 64px; /* reserve space for top bar */

  background-image: url("@/assets/board-assets/dark-board-stones.png");
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

/* probe matches your CSS token sizing */
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