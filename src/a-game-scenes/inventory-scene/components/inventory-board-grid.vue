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
          :class="{
    blocked: cell.blocked,
    selected: !cell.blocked && itemsBySlot[cell.key]?.id === selectedId
  }"
      >
        <inventory-token
            v-if="!cell.blocked && itemsBySlot[cell.key]"
            :item="itemsBySlot[cell.key]"
        />
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
    "--hole-left": `calc(${x} * var(--cell) + 14px)`,  // 14px = padding grid (як у .grid)
    "--hole-top": `calc(${y} * var(--cell) + 14px)`,
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
  gap: 4px; /* було 10 */
  padding: 12px; /* було 14 */

  border-radius: 10px;

  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06) inset,
  0 20px 60px rgba(0, 0, 0, 0.55);
}

.cell.selected {
  box-shadow:
      0 0 0 2px rgba(255,255,255,0.95),
      0 0 0 6px rgba(255,255,255,0.10),
      0 18px 40px rgba(0,0,0,0.55);
  border-color: rgba(255,255,255,0.65);
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
  border: 1px dashed rgba(255, 255, 255, 0.06);
  box-shadow: none;
  opacity: 0.35;
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
</style>