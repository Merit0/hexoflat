<template>
  <div class="grid-wrap" :style="centerHoleVars">
    <div
        class="grid"
        :style="gridStyle"
    >
      <div
          v-for="cell in cells"
          :key="cell.key"
          class="cell"
          :data-slotkey="cell.key"
          :class="{
          blocked: cell.blocked,
          selected: !cell.blocked && itemsBySlot[cell.key]?.id === selectedId,
          'is-drop': !cell.blocked && cell.key === inv.dragOverSlot
  }"
          @click.self="onCellClick(cell.key)"
      >
        <inventory-token
            v-if="!cell.blocked && itemsBySlot[cell.key]"
            :item="itemsBySlot[cell.key]"
        />
        <span
            v-if="!cell.blocked && itemsBySlot[cell.key]?.isNew"
            class="badge"
        >
        </span>

        <span
            v-if="!cell.blocked && (itemsBySlot[cell.key]?.amount ?? 1) > 1"
            class="amount"
        >
          {{ itemsBySlot[cell.key]!.amount }}
        </span>
      </div>
    </div>

    <!-- легка прозора “дірка” під центр -->
    <div class="center-hole" :style="centerHoleStyle"></div>
  </div>
</template>

<script setup lang="ts">
import {computed} from "vue";
import {useHeroInventoryStore} from "@/stores/hero-inventory-store";
import InventoryToken from "@/a-game-scenes/inventory-scene/components/inventory-token.vue";

const inv = useHeroInventoryStore();

const itemsBySlot = computed(() => inv.itemsBySlot);

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
      out.push({key, r, c, blocked: inv.isCellBlocked(r, c)});
    }
  }
  return out;
});

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${inv.grid.cols}, var(--cell))`,
  gridTemplateRows: `repeat(${inv.grid.rows}, var(--cell))`,
}));

const selectedId = computed(() => inv.selectedItemId);

const centerHoleStyle = computed(() => {
  const {x, y, w, h} = inv.grid.blockedRect;
  return {
    left: `calc(${x} * var(--cell))`,
    top: `calc(${y} * var(--cell))`,
    width: `calc(${w} * var(--cell))`,
    height: `calc(${h} * var(--cell))`,
  };
});

const centerHoleVars = computed(() => {
  const { x, y, w, h } = inv.grid.blockedRect;
  return {
    "--hole-left": `calc(${x} * var(--cell) + 12px)`, //relating in css.grid class -> padding: 12px;
    "--hole-top": `calc(${y} * var(--cell) + 12px)`,
    "--hole-w": `calc(${w} * var(--cell))`,
    "--hole-h": `calc(${h} * var(--cell))`,
  } as Record<string, string>;
});
</script>

<style scoped>
.grid-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}

.grid {
  display: grid;

  --cell: 76px;
  gap: 4px;
  padding: 12px;

  border-radius: 10px;

  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06) inset,
  0 20px 60px rgba(0, 0, 0, 0.55);
}

.cell.selected {
  box-shadow:
      0 0 0 1px rgba(255,255,255,0.95),
      0 6px 40px rgba(0,0,0,0.55);
  border-color: rgb(255, 204, 0);
}

@media (max-width: 1100px) {
  .grid {
    --cell: 64px;
    gap: 5px;
  }
}

@media (max-width: 900px) {
  .grid {
    --cell: 56px;
    gap: 4px;
  }
}

.cell {
  border-radius: 5px;
  background: rgba(120, 160, 170, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.30);

  display: grid;
  place-items: center;
  position: relative;
}

.cell.blocked {
  background: transparent;
  box-shadow: none;
  opacity: 0;
}

/* “порожнє” за гексами — напівпрозора зона */
.center-hole {
  position: absolute;
  pointer-events: none;
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
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

.cell:not(.blocked):hover {
  background: rgba(138, 173, 180, 0.3);
}

.cell.is-drop {
  //box-shadow:
  //    0 0 0 2px rgba(195, 228, 255, 0.49),
  //    0 5px 28px rgba(0,0,0,0.55);
}
</style>