<template>
  <div class="equip-root">
    <div
        ref="probeRef"
        class="hex-probe"
        :style="{ width: HEX_SIZE + 'px', height: HEX_SIZE + 'px' }"
    />

    <div class="equip-wrapper" :style="{ transform: `scale(${scale})` }">
      <div class="equip-inner" :style="innerStyle">
        <div
            v-for="t in tiles"
            :key="t.id"
            class="hex"
            :class="[
  t.kind,
  t.kind === 'slot' ? 'equip-hex' : '',
  t.kind === 'slot' && isDropSlot(t.id) ? dragStateClass(t.id) : '',
  t.kind === 'slot' && isDropSlot(t.id) && getEquippedItem(t.id) ? 'is-occupied' : ''
]"
            :data-slot="t.label"
            :data-eqslot="t.kind === 'slot' ? t.id : undefined"
            :style="[tileStyle(t), { width: HEX_SIZE + 'px', height: HEX_SIZE + 'px' }]"
        >
          <equip-token
              v-if="t.kind === 'slot' && isDropSlot(t.id) && getEquippedItem(t.id)"
              :item="getEquippedItem(t.id)!"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from "vue";
import {calcHexPixelPosition} from "@/utils/hex-utils";
import {useHeroInventoryStore, type TEquipSlot} from "@/stores/hero-inventory-store";
import EquipToken from "@/a-game-scenes/inventory-scene/components/equip-token.vue";

const inventoryStore = useHeroInventoryStore();

const BASE_HEX_SIZE = 110;
const HEX_SCALE = 1.3;

const HEX_SIZE = computed(() => BASE_HEX_SIZE * HEX_SCALE);

type Coord = { rowIndex: number; columnIndex: number };
type PseudoTile = { id: string; kind: "slot" | "hero"; label: string; coordinates: Coord };

const probeRef = ref<HTMLElement | null>(null);

function readDomHexSize() {
  const el = probeRef.value;
  if (!el) return;
  el.getBoundingClientRect();
}

const tileWidth = computed(() => HEX_SIZE.value);
const center: Coord = {rowIndex: 0, columnIndex: 0};

const tiles = computed<PseudoTile[]>(() => {
  const c = center;

  return [
    {
      id: "hero",
      kind: "hero",
      label: "",
      coordinates: c,
    },
    {
      id: "helm",
      kind: "slot",
      label: "HELM",
      coordinates: {rowIndex: c.rowIndex - 1, columnIndex: c.columnIndex},
    },
    {
      id: "armor",
      kind: "slot",
      label: "ARMOR",
      coordinates: {rowIndex: c.rowIndex - 1, columnIndex: c.columnIndex + 1},
    },
    {
      id: "gloves",
      kind: "slot",
      label: "GLOVES",
      coordinates: {rowIndex: c.rowIndex, columnIndex: c.columnIndex + 1},
    },
    {
      id: "boots",
      kind: "slot",
      label: "BOOTS",
      coordinates: {rowIndex: c.rowIndex + 1, columnIndex: c.columnIndex},
    },
    {
      id: "shield",
      kind: "slot",
      label: "SHIELD",
      coordinates: {rowIndex: c.rowIndex, columnIndex: c.columnIndex - 1},
    },
    {
      id: "weapon",
      kind: "slot",
      label: "WEAPON",
      coordinates: {rowIndex: c.rowIndex - 1, columnIndex: c.columnIndex - 1},
    },
  ];
});

function isDropSlot(id: string): id is TEquipSlot {
  return (
      id === "weapon" ||
      id === "shield" ||
      id === "armor" ||
      id === "gloves" ||
      id === "helm" ||
      id === "boots"
  );
}

function dragStateClass(id: TEquipSlot) {
  if (!inventoryStore.isDragging) return "";

  if (inventoryStore.dragOverEquipSlot !== id) return "";

  const dragged = inventoryStore.items.find(i => i.id === inventoryStore.draggingId);
  if (!dragged) return "";

  // sandbox mode: під час наведення просто підсвічуємо активний слот
  return "hover";
}

/* ---------- HEX RING COMPRESSION ---------- */
const RING_COMPRESS = 0.57;
const INSET_PX = computed(() => Math.round(HEX_SIZE.value * 0.015));

function compressAroundCenter(x: number, y: number) {
  const heroPos = calcHexPixelPosition({coordinates: center} as any, tileWidth.value);
  const dx = x - heroPos.x;
  const dy = y - heroPos.y;

  const cx = heroPos.x + dx * RING_COMPRESS;
  const cy = heroPos.y + dy * RING_COMPRESS;

  if (INSET_PX.value !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    return {
      x: cx - nx * INSET_PX.value,
      y: cy - ny * INSET_PX.value,
    };
  }

  return {x: cx, y: cy};
}

/* ---------- BOUNDS ---------- */
const bleed = 10;

const bounds = computed(() => {
  const w = HEX_SIZE.value;
  const h = HEX_SIZE.value;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

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

const scale = ref(1);

function tileStyle(t: PseudoTile) {
  const p = calcHexPixelPosition({coordinates: t.coordinates} as any, tileWidth.value);
  const pos = t.kind === "slot" ? compressAroundCenter(p.x, p.y) : p;

  return {
    transform: `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`,
  } as Record<string, string>;
}

function getEquippedItem(slot: TEquipSlot) {
  return inventoryStore.items.find(i => i.slotKey === `eq:${slot}`) ?? null;
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

.hex-probe {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
}

.equip-wrapper {
  width: max-content;
  height: max-content;
  transform-origin: center center;
}

.equip-inner {
  position: relative;
}

.hex {
  position: absolute;
  clip-path: polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%);
}

.hex.hero {
  background: radial-gradient(circle at 35% 25%, rgba(120, 220, 120, 0.92), rgba(20, 80, 30, 0.96));
  border: 2px solid rgba(20, 20, 20, 0.65);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25) inset,
  0 22px 60px rgba(0, 0, 0, 0.55);
}

.hex.slot {
  background: rgba(120, 160, 170, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.30);
  opacity: 0.96;
  overflow: hidden;
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
  color: rgba(0, 0, 0, 0.7);
  opacity: 0.55;
  pointer-events: none;
  z-index: 1;
}

.equip-hex {
  transition: box-shadow 0.14s ease,
  filter 0.14s ease;
}

.equip-hex.match {
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25) inset,
  0 0 22px rgba(120, 255, 140, 0.55),
  0 18px 40px rgba(0, 0, 0, 0.55);
  filter: brightness(1.08);
}

.equip-hex.neutral {
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25) inset,
  0 0 18px rgba(120, 180, 255, 0.45),
  0 18px 40px rgba(0, 0, 0, 0.55);
  filter: brightness(1.04);
}

.hex.slot.is-occupied::after {
  display: none;
}

.equip-hex.hover {
  box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.25) inset,
      0 0 26px rgba(255, 220, 120, 0.7),
      0 18px 40px rgba(0, 0, 0, 0.55);
  filter: brightness(1.1);
}
</style>