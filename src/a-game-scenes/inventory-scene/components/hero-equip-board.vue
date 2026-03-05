<template>
  <div class="equip-root">
    <!-- probe to read real DOM hex size (like you do on map) -->
    <div
        ref="probeRef"
        class="hex-probe"
        :style="{ width: HEX_SIZE + 'px', height: HEX_SIZE + 'px' }"
    />

    <!-- scaled wrapper (keep 1 for now; lens later) -->
    <div class="equip-wrapper" :style="{ transform: `scale(${scale})` }">
      <div class="equip-inner" :style="innerStyle">
        <div
            v-for="t in tiles"
            :key="t.id"
            class="hex"
            :class="t.kind"
            :data-slot="t.label"
            :style="[tileStyle(t), { width: HEX_SIZE + 'px', height: HEX_SIZE + 'px' }]"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from "vue";
import {calcHexPixelPosition} from "@/utils/hex-utils";

const BASE_HEX_SIZE = 110;
const HEX_SCALE = 1.3; // +30%

const HEX_SIZE = computed(() => BASE_HEX_SIZE * HEX_SCALE);

type Coord = { rowIndex: number; columnIndex: number };
type PseudoTile = { id: string; kind: "slot" | "hero"; label: string; coordinates: Coord };

const probeRef = ref<HTMLElement | null>(null);
const domHexW = ref(0);
const domHexH = ref(0);

function readDomHexSize() {
  const el = probeRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.width > 0) domHexW.value = r.width;
  if (r.height > 0) domHexH.value = r.height;
}

const tileWidth = computed(() => HEX_SIZE.value);

const center: Coord = {rowIndex: 0, columnIndex: 0};

const tiles = computed<PseudoTile[]>(() => {
  const c = center;

  const hero: PseudoTile = {
    id: "hero",
    kind: "hero",
    label: "",
    coordinates: c,
  };

  const helm: PseudoTile = {
    id: "helm",
    kind: "slot",
    label: "HELM",
    coordinates: {rowIndex: c.rowIndex - 1, columnIndex: c.columnIndex},
  };

  const boots: PseudoTile = {
    id: "boots",
    kind: "slot",
    label: "BOOTS",
    coordinates: {rowIndex: c.rowIndex + 1, columnIndex: c.columnIndex},
  };

  const armor: PseudoTile = {
    id: "armor",
    kind: "slot",
    label: "ARMOR",
    coordinates: {rowIndex: c.rowIndex - 1, columnIndex: c.columnIndex + 1},
  };

  const gloves: PseudoTile = {
    id: "gloves",
    kind: "slot",
    label: "GLOVES",
    coordinates: {rowIndex: c.rowIndex, columnIndex: c.columnIndex + 1},
  };

  const weapon: PseudoTile = {
    id: "weapon",
    kind: "slot",
    label: "WEAPON",
    coordinates: {rowIndex: c.rowIndex - 1, columnIndex: c.columnIndex - 1},
  };

  const shield: PseudoTile = {
    id: "shield",
    kind: "slot",
    label: "SHIELD",
    coordinates: {rowIndex: c.rowIndex, columnIndex: c.columnIndex - 1},
  };

  return [hero, helm, armor, gloves, boots, shield, weapon];
});

/**
 * ---------- HEX RING COMPRESSION ----------
 */
const RING_COMPRESS = 0.57;

/**
 * Optional additional inset in px (after compress). Can be 0.
 * Use 0..8 to micro-tune.
 */
const INSET_PX = computed(() => Math.round(HEX_SIZE.value * 0.015));

function compressAroundCenter(x: number, y: number) {
  // center is (0,0) in our micro-grid, so hero pixel is also the "origin".
  // But to be 100% safe, we compute hero position and compress around it.
  const heroPos = calcHexPixelPosition({coordinates: center} as any, tileWidth.value);
  const dx = x - heroPos.x;
  const dy = y - heroPos.y;

  const cx = heroPos.x + dx * RING_COMPRESS;
  const cy = heroPos.y + dy * RING_COMPRESS;

  // small radial inset to bring it a tiny bit closer (optional)
  if (INSET_PX.value !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    return {x: cx - nx * INSET_PX.value, y: cy - ny * INSET_PX.value};
  }

  return {x: cx, y: cy};
}

/**
 * ---------- bounds (use COMPRESSED positions so container fits perfectly) ----------
 */
const bleed = 10;

const bounds = computed(() => {
  const w = HEX_SIZE.value;
  const h = HEX_SIZE.value;

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const t of tiles.value) {
    const p = calcHexPixelPosition({coordinates: t.coordinates} as any, tileWidth.value);
    const pos = t.kind === "slot" ? compressAroundCenter(p.x, p.y) : p;

    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + w);
    maxY = Math.max(maxY, pos.y + h);
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return {width: 0, height: 0, offsetX: 0, offsetY: 0};
  }

  return {
    width: (maxX - minX) + bleed * 2,
    height: (maxY - minY) + bleed * 2,
    offsetX: minX - bleed,
    offsetY: minY - bleed,
  };
});

const innerStyle = computed(() => {
  const b = bounds.value;
  return {
    width: `${b.width}px`,
    height: `${b.height}px`,
    paddingLeft: `${Math.round(-b.offsetX)}px`,
    paddingTop: `${Math.round(-b.offsetY)}px`,
  } as Record<string, string>;
});

/**
 * Scale (keep 1 now; lens later)
 */
const scale = ref(1);

function tileStyle(t: PseudoTile) {
  const p = calcHexPixelPosition({coordinates: t.coordinates} as any, tileWidth.value);
  const pos = t.kind === "slot" ? compressAroundCenter(p.x, p.y) : p;

  return {
    transform: `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`,
  } as Record<string, string>;
}

function onResize() {
  readDomHexSize();
}

onMounted(() => {
  requestAnimationFrame(() => {
    readDomHexSize();
  });
  window.addEventListener("resize", onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
});
</script>

<style scoped>
.equip-root {
  position: relative;
  display: grid;
  place-items: center;
  pointer-events: auto;
}

/* probe must match your hex shape sizing */
.hex-probe {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
}

/* scale wrapper */
.equip-wrapper {
  width: max-content;
  height: max-content;
  transform-origin: center center;
}

.equip-inner {
  position: relative;
}

/* base hex element */
.hex {
  position: absolute;
  clip-path: polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%);
}

.hex.hero {
  background: radial-gradient(circle at 35% 25%, rgba(120, 220, 120, 0.92), rgba(20, 80, 30, 0.96));
  border: 2px solid rgba(20, 20, 20, 0.65);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25) inset, 0 22px 60px rgba(0, 0, 0, 0.55);
}

.hex.slot {
  background: linear-gradient(145deg, rgba(190, 140, 70, 0.95), rgba(120, 70, 25, 0.95));
  border: 2px solid rgba(20, 20, 20, 0.6);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25) inset, 0 18px 40px rgba(0, 0, 0, 0.55);
  opacity: 0.96;
}

.hex.slot::after {
  content: attr(data-slot);
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.70);
  pointer-events: none;
}
</style>