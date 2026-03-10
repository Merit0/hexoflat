<template>
  <div class="equip-root">
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
            :data-eqslot="t.kind === 'slot' ? t.id : undefined"
            :style="[tileStyle(t), { width: HEX_SIZE + 'px', height: HEX_SIZE + 'px' }]"
        >
          <div
              v-if="t.kind === 'hero'"
              class="hero-core-token"
          >
            <div class="hero-core-image" :style="heroImageStyle"></div>
          </div>
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
import { computed, ref } from "vue";
import { calcHexPixelPosition } from "@/utils/hex-utils";
import { useHeroInventoryStore, type TEquipSlot } from "@/stores/hero-inventory-store";
import EquipToken from "@/a-game-scenes/inventory-scene/components/equip-token.vue";
import { resolveEquipCompatibility } from "@/utils/inventory/equip-compatibility";

const EQUIP_SLOTS: TEquipSlot[] = ["weapon", "shield", "armor", "gloves", "helm", "boots"];

const inventoryStore = useHeroInventoryStore();

const BASE_HEX_SIZE = 110;
const HEX_SCALE = 1.3;
const HEX_SIZE = computed(() => BASE_HEX_SIZE * HEX_SCALE);

type Coord = {
  rowIndex: number;
  columnIndex: number;
};

type PseudoTile = {
  id: string;
  kind: "slot" | "hero";
  coordinates: Coord;
};

const heroImagePath = computed(() => "/hero-asssets/spirit-hex-image.png");

const heroImageStyle = computed(() => ({
  backgroundImage: `url("${heroImagePath.value}")`,
}));

const tileWidth = computed(() => HEX_SIZE.value);
const center: Coord = { rowIndex: 0, columnIndex: 0 };

const tiles = computed<PseudoTile[]>(() => {
  const c = center;

  return [
    {
      id: "hero",
      kind: "hero",
      coordinates: c,
    },
    {
      id: "helm",
      kind: "slot",
      coordinates: { rowIndex: c.rowIndex - 1, columnIndex: c.columnIndex },
    },
    {
      id: "armor",
      kind: "slot",
      coordinates: { rowIndex: c.rowIndex - 1, columnIndex: c.columnIndex + 1 },
    },
    {
      id: "gloves",
      kind: "slot",
      coordinates: { rowIndex: c.rowIndex, columnIndex: c.columnIndex + 1 },
    },
    {
      id: "boots",
      kind: "slot",
      coordinates: { rowIndex: c.rowIndex + 1, columnIndex: c.columnIndex },
    },
    {
      id: "shield",
      kind: "slot",
      coordinates: { rowIndex: c.rowIndex, columnIndex: c.columnIndex - 1 },
    },
    {
      id: "weapon",
      kind: "slot",
      coordinates: { rowIndex: c.rowIndex - 1, columnIndex: c.columnIndex - 1 },
    },
  ];
});

function isDropSlot(id: string): id is TEquipSlot {
  return EQUIP_SLOTS.includes(id as TEquipSlot);
}

function dragStateClass(id: TEquipSlot) {
  if (!inventoryStore.isDragging) return "";
  if (inventoryStore.dragOverEquipSlot !== id) return "";

  const dragged = inventoryStore.items.find(i => i.id === inventoryStore.draggingId);
  if (!dragged) return "";

  const compatibility = resolveEquipCompatibility(dragged, id);

  return compatibility === "effect" ? "effect" : "mismatch";
}

const equippedItems = computed(() => inventoryStore.equippedItems);

function getEquippedItem(slot: TEquipSlot) {
  return equippedItems.value[slot];
}

/* ---------- HEX RING COMPRESSION ---------- */
const RING_COMPRESS = 0.57;
const INSET_PX = computed(() => Math.round(HEX_SIZE.value * 0.015));

function compressAroundCenter(x: number, y: number) {
  const heroPos = calcHexPixelPosition({ coordinates: center } as any, tileWidth.value);
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

  return { x: cx, y: cy };
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
    const p = calcHexPixelPosition({ coordinates: t.coordinates } as any, tileWidth.value);
    const pos = t.kind === "slot" ? compressAroundCenter(p.x, p.y) : p;

    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + w);
    maxY = Math.max(maxY, pos.y + h);
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
  const p = calcHexPixelPosition({ coordinates: t.coordinates } as any, tileWidth.value);
  const pos = t.kind === "slot" ? compressAroundCenter(p.x, p.y) : p;

  return {
    transform: `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`,
  } as Record<string, string>;
}
</script>

<style scoped>
.equip-root {
  position: relative;
  display: grid;
  place-items: center;
  pointer-events: auto;
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

.hex.slot {
  background: rgba(120, 160, 170, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.30);
  opacity: 0.96;
  overflow: hidden;
  cursor: default;
}

.equip-hex {
  transition:
      box-shadow 0.12s ease,
      filter 0.12s ease,
      background 0.12s ease,
      border-color 0.12s ease;
}

.equip-hex.effect {
  background: rgba(120, 200, 120, 0.25);
  box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.25) inset,
      0 0 24px rgba(120, 255, 140, 0.62),
      0 18px 40px rgba(0, 0, 0, 0.55);
  filter: brightness(1.1) saturate(1.08);
}

.equip-hex.mismatch {
  background: rgba(220, 90, 90, 0.20);
  box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.25) inset,
      0 0 22px rgba(255, 110, 110, 0.48),
      0 18px 40px rgba(0, 0, 0, 0.55);
  filter: brightness(1.03) saturate(1.06);
}

.hex.slot.is-occupied {
  background: rgba(140, 155, 168, 0.22);
}

.hero-core-token {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 2;
}

.hero-core-image {
  width: 110%;
  height: 110%;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  filter:
      drop-shadow(0 10px 18px rgba(0, 0, 0, 0.42));
}

.hex.hero {
  border: 2px solid rgba(20, 20, 20, 0.65);
  box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.25) inset,
      0 22px 60px rgba(0, 0, 0, 0.55),
      0 0 24px rgba(120, 255, 140, 0.18);
}
</style>