<template>
  <div class="grid-wrap">
    <div class="grid" :style="gridStyle">
      <div
        v-for="cell in cells"
        :key="cell.key"
        class="cell"
        :data-slotkey="cell.key === willSlotKey ? undefined : cell.key"
        :data-testid="`inventory-cell-${cell.key}`"
        :style="{ gridColumn: cell.r + 1, gridRow: cell.c + 1 }"
        :class="{
          blocked: cell.blocked,
          selected: !cell.blocked && itemsBySlot[cell.key]?.id === selectedId,
          'is-drop': !cell.blocked && cell.key === dragState.dragOverSlot,
          magnet: !cell.blocked && cell.key === dragState.dragOverSlot,
          'is-will': cell.key === willSlotKey,
        }"
        :tabindex="cell.key === willSlotKey ? 0 : undefined"
        @click.self="onCellClick(cell.key)"
      >
        <inventory-token
          v-if="!cell.blocked && itemsBySlot[cell.key]"
          :item="itemsBySlot[cell.key]"
        />

        <div
          v-if="cell.key === willSlotKey && hero.knowledge"
          class="will-token"
          data-testid="inventory-will-token"
          role="img"
          :aria-label="t('knowledge.will', hero.knowledge)"
        >
          <img src="/board-assets/will-icon-image.png" alt="" draggable="false" />
          <span class="amount" data-testid="inventory-will-amount">{{
            hero.knowledge.current
          }}</span>
          <span
            v-if="willDelta !== 0"
            :key="willDeltaKey"
            class="will-delta"
            :class="{ gain: willDelta > 0 }"
          >
            {{ willDelta > 0 ? `+${willDelta}` : `−${-willDelta}` }}
          </span>
        </div>

        <div
          v-if="cell.key === willSlotKey && hero.knowledge"
          class="will-tip"
          role="tooltip"
          data-testid="inventory-will-tooltip"
        >
          <b
            >{{ t('knowledge.tooltipTitle') }}: {{ hero.knowledge.current }}/{{
              hero.knowledge.capacity
            }}</b
          >
          <span>
            {{ t('knowledge.tooltipBody') }} {{ t('knowledge.tooltipRefillPre') }}
            <span class="legend-text">{{ t('knowledge.title') }}</span>
            {{ t('knowledge.tooltipRefillPost') }}
          </span>
        </div>

        <span v-if="!cell.blocked && itemsBySlot[cell.key]?.isNew" class="badge"> </span>

        <span v-if="!cell.blocked && (itemsBySlot[cell.key]?.amount ?? 1) > 1" class="amount">
          {{ itemsBySlot[cell.key]!.amount }}
        </span>
      </div>
    </div>

    <div class="center-hole" :style="centerHoleStyle"><slot /></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHeroInventoryStore, WILL_SLOT_KEY as willSlotKey } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';
import { inventoryDragState as dragState } from '@/composables/use-inventory-drag';
import InventoryToken from '@/a-game-scenes/inventory-scene/components/inventory-token.vue';

const inv = useHeroInventoryStore();
const hero = useHeroStore();
const { t } = useI18n();
const willDelta = ref(0);
const willDeltaKey = ref(0);

watch(
  () => hero.knowledge?.current,
  (next, previous) => {
    if (next === undefined || previous === undefined || next === previous) return;
    willDelta.value = next - previous;
    willDeltaKey.value += 1;
  },
);

const itemsBySlot = computed(() => inv.itemsBySlot);
const selectedId = computed(() => inv.selectedItemId);

function onCellClick(slotKey: string) {
  const item = itemsBySlot.value[slotKey];

  if (!item) {
    inv.clearSelection();
  }
}

const cells = computed(() => {
  const out: Array<{ key: string; r: number; c: number; blocked: boolean }> = [];

  for (let r = 0; r < inv.grid.rows; r++) {
    for (let c = 0; c < inv.grid.cols; c++) {
      const key = `r${r}c${c}`;
      out.push({
        key,
        r,
        c,
        blocked: inv.isCellBlocked(r, c),
      });
    }
  }

  return out;
});

// The store's grid is landscape (12 cols x 7 rows) — built for the old wide
// modal. The hero-board panel is a tall, narrow column, so this renders the
// exact same 84 slots transposed (column <-> row) into a portrait shape:
// the two free side strips end up as free bands above and below the hole
// instead of beside it. Purely a rendering transform — `cell.r`/`cell.c` and
// every store lookup (isCellBlocked, itemsBySlot, slot keys) stay untouched.
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${inv.grid.rows}, var(--cell))`,
  gridTemplateRows: `repeat(${inv.grid.cols}, var(--cell))`,
}));

const centerHoleStyle = computed(() => {
  const { x, y, w, h } = inv.grid.blockedRect;

  return {
    left: `calc(12px + ${y} * (var(--cell) + var(--gap)))`,
    top: `calc(12px + ${x} * (var(--cell) + var(--gap)))`,
    width: `calc(${h} * var(--cell) + ${h - 1} * var(--gap))`,
    height: `calc(${w} * var(--cell) + ${w - 1} * var(--gap))`,
  };
});
</script>

<style scoped>
.grid-wrap {
  --cell: 76px;
  --gap: 4px;
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}

.grid {
  display: grid;

  gap: var(--gap);
  padding: 12px;

  border: none;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
}

@media (max-width: 1100px) {
  .grid-wrap {
    --cell: 64px;
    --gap: 5px;
  }
}

@media (max-width: 900px) {
  .grid-wrap {
    --cell: 56px;
    --gap: 4px;
  }
}

.cell {
  border-radius: 5px;
  background: rgba(120, 160, 170, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);

  display: grid;
  place-items: center;
  position: relative;

  transition:
    transform 0.08s ease,
    box-shadow 0.12s ease,
    background 0.12s ease,
    border-color 0.12s ease;
}

.grid {
  --cell-active-border: rgba(255, 220, 150, 0.55);
  --cell-active-shadow:
    0 0 0 2px rgba(255, 200, 120, 0.5) inset, 0 0 16px rgba(255, 200, 120, 0.45),
    0 0 30px rgba(255, 200, 120, 0.25), 0 10px 24px rgba(0, 0, 0, 0.3);
}

.cell.selected,
.cell.magnet {
  border-color: var(--cell-active-border);
  box-shadow: var(--cell-active-shadow);
}

.cell.blocked {
  background: transparent;
  box-shadow: none;
  opacity: 0;
}

.cell:not(.blocked):hover {
  background: rgba(138, 173, 180, 0.3);
}

.cell.is-drop {
}
.center-hole {
  position: absolute;
  pointer-events: none;
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
}

.center-hole > * {
  pointer-events: auto;
}

.will-token {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.will-token img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.legend-text {
  font-weight: 900;
  color: #e8720c;
  text-shadow:
    0 0 6px rgba(232, 114, 12, 0.55),
    0 1px 1px rgba(0, 0, 0, 0.8);
  letter-spacing: 0.02em;
}

.will-tip {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 30;
  width: 230px;
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(124, 196, 255, 0.5);
  background: rgba(10, 16, 28, 0.96);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.6);
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  line-height: 1.35;
  text-align: left;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.12s ease,
    visibility 0.12s ease;
}

.cell.is-will:hover .will-tip,
.cell.is-will:focus-visible .will-tip {
  opacity: 1;
  visibility: visible;
}

.will-delta {
  position: absolute;
  top: 0;
  left: 50%;
  font-weight: 900;
  font-size: 12px;
  color: #ff9d9d;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  animation: will-delta-float 900ms ease-out forwards;
}

.will-delta.gain {
  color: #8dffb0;
}

@keyframes will-delta-float {
  from {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -16px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .will-delta {
    animation: none;
    opacity: 0.9;
    transform: translate(-50%, -8px);
  }
}

.badge,
.amount {
  pointer-events: none;
}

.badge {
  position: absolute;
  top: 2px;
  left: 2px;
  padding: 2px 2px;
  border-radius: 999px;

  background: rgba(140, 255, 102, 0.95);
  border: 3px solid rgba(255, 255, 255, 0.18);
  color: white;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4);
  will-change: transform;
}

.amount {
  position: absolute;
  bottom: 0;
  right: 0;

  padding: 1px 5px;
  border-radius: 999px;

  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);

  font-weight: 900;
  font-size: 11px;
}
</style>
