<template>
  <div class="equip-root">
    <div class="equip-wrapper" :style="{ transform: `scale(${scale})` }">
      <div
        class="carry-weight-badge"
        data-testid="equip-carry-weight"
        :class="{ over: inventoryStore.isOverCapacity }"
      >
        <div class="weight-icon" aria-hidden="true">⚖</div>
        <div class="weight-text">{{ carried }} / {{ capacity }} kg</div>
      </div>
      <div class="equip-inner" :style="innerStyle">
        <div
          v-for="t in tiles"
          :key="t.id"
          class="hex"
          :class="[
            t.kind,
            t.kind === 'slot' ? 'equip-hex' : '',
            t.kind === 'slot' && isDropSlot(t.id) ? dragStateClass(t.id) : '',
            t.kind === 'slot' && isDropSlot(t.id) && getEquippedItem(t.id) ? 'is-occupied' : '',
          ]"
          :data-eqslot="t.kind === 'slot' ? t.id : undefined"
          :data-testid="t.kind === 'slot' ? `equip-slot-${t.id}` : 'equip-hero-slot'"
          :style="[tileStyle(t), { width: HEX_W + 'px', height: HEX_H + 'px' }]"
        >
          <div v-if="t.kind === 'hero'" class="hero-core-token">
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
import { computed, ref } from 'vue';
import { calcHexPixelPosition } from '@hexoflat/engine/utils/hex-utils';
import { useHeroInventoryStore, type TEquipSlot } from '@/stores/hero-inventory-store';
import { inventoryDragState } from '@/composables/use-inventory-drag';
import EquipToken from '@/a-game-scenes/inventory-scene/components/equip-token.vue';
import { resolveEquipCompatibility } from '@hexoflat/engine/utils/inventory/equip-compatibility';

const EQUIP_SLOTS: TEquipSlot[] = ['weapon', 'shield', 'armor', 'gloves', 'helm', 'boots'];

const inventoryStore = useHeroInventoryStore();

const BASE_HEX_SIZE = 110;
const HEX_SCALE = 1.3;
// Same hex box as the map (see --hex-tile-* in global.css): height is the
// vertex-to-vertex long axis, width the flat-to-flat short axis.
const HEX_H = computed(() => BASE_HEX_SIZE * HEX_SCALE);
const HEX_W = computed(() => HEX_H.value * 0.866);

type Coord = {
  rowIndex: number;
  columnIndex: number;
};

type PseudoTile = {
  id: string;
  kind: 'slot' | 'hero';
  coordinates: Coord;
};

const heroImagePath = computed(() => '/hex-assets/creators-hexes/frank-hex.png');

const heroImageStyle = computed(() => ({
  backgroundImage: `url("${heroImagePath.value}")`,
}));

// Positioned exactly like the map: calcHexPixelPosition fed the real hex box
// (flat-to-flat width, vertex-to-vertex height), so the six slots are the
// centre hex's six edge-sharing neighbours.
const spacingWidth = HEX_W;
const spacingHeight = HEX_H;
const center: Coord = { rowIndex: 0, columnIndex: 0 };

const tiles = computed<PseudoTile[]>(() => {
  const c = center;

  return [
    {
      id: 'hero',
      kind: 'hero',
      coordinates: c,
    },
    {
      id: 'helm',
      kind: 'slot',
      coordinates: { rowIndex: c.rowIndex - 1, columnIndex: c.columnIndex },
    },
    {
      id: 'armor',
      kind: 'slot',
      coordinates: { rowIndex: c.rowIndex - 1, columnIndex: c.columnIndex - 1 },
    },
    {
      id: 'gloves',
      kind: 'slot',
      coordinates: { rowIndex: c.rowIndex, columnIndex: c.columnIndex + 1 },
    },
    {
      id: 'boots',
      kind: 'slot',
      coordinates: { rowIndex: c.rowIndex + 1, columnIndex: c.columnIndex },
    },
    {
      id: 'shield',
      kind: 'slot',
      coordinates: { rowIndex: c.rowIndex + 1, columnIndex: c.columnIndex - 1 },
    },
    {
      id: 'weapon',
      kind: 'slot',
      coordinates: { rowIndex: c.rowIndex, columnIndex: c.columnIndex - 1 },
    },
  ];
});

function isDropSlot(id: string): id is TEquipSlot {
  return EQUIP_SLOTS.includes(id as TEquipSlot);
}

function dragStateClass(id: TEquipSlot) {
  if (!inventoryDragState.isDragging) return '';
  if (inventoryDragState.dragOverEquipSlot !== id) return '';

  const dragged = inventoryStore.items.find((i) => i.id === inventoryDragState.draggingId);
  if (!dragged) return '';

  const compatibility = resolveEquipCompatibility(dragged, id);

  return compatibility === 'effect' ? 'effect' : 'mismatch';
}

const equippedItems = computed(() => inventoryStore.equippedItems);

function getEquippedItem(slot: TEquipSlot) {
  return equippedItems.value[slot];
}

const bleed = 10;

const bounds = computed(() => {
  const w = HEX_W.value;
  const h = HEX_H.value;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const t of tiles.value) {
    const pos = calcHexPixelPosition(
      { coordinates: t.coordinates },
      spacingWidth.value,
      spacingHeight.value,
    );

    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + w);
    maxY = Math.max(maxY, pos.y + h);
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }

  return {
    width: maxX - minX + bleed * 2,
    height: maxY - minY + bleed * 2,
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
  };
});

const scale = ref(1);

function tileStyle(t: PseudoTile) {
  const pos = calcHexPixelPosition(
    { coordinates: t.coordinates },
    spacingWidth.value,
    spacingHeight.value,
  );

  return {
    transform: `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`,
  } as Record<string, string>;
}

const carried = computed(() => inventoryStore.carriedWeightKg.toFixed(2));

const capacity = computed(() => inventoryStore.carryCapacityKg.toFixed(2));
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
  clip-path: var(--hex-clip-path);
}

.hex.slot {
  background: rgba(120, 160, 170, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
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
  background: rgba(220, 90, 90, 0.2);
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
  filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.42));
}

.hex.hero {
  border: 2px solid rgba(20, 20, 20, 0.65);
  box-shadow:
    0 0 0 2px rgba(0, 0, 0, 0.25) inset,
    0 22px 60px rgba(0, 0, 0, 0.55),
    0 0 24px rgba(120, 255, 140, 0.18);
}

.carry-weight-badge {
  position: absolute;
  right: 0;
  bottom: -1rem;

  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;

  background: linear-gradient(180deg, rgba(43, 46, 52, 0.95), rgba(18, 12, 8, 0.96));

  border: 1px solid rgba(170, 252, 255, 0.35);

  color: rgba(255, 236, 186, 0.95);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.06em;

  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;

  backdrop-filter: blur(6px);
  z-index: 1;
}

.weight-icon {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  font-size: 14px;
  line-height: 1;

  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

.carry-weight-badge.over {
  border-color: rgba(255, 120, 120, 0.6);
  box-shadow:
    0 0 20px rgba(255, 80, 80, 0.4),
    0 8px 18px rgba(0, 0, 0, 0.45);
}

.carry-weight-badge:hover {
  transform: scale(1.05);
}
</style>
