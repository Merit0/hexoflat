<template>
  <section
    class="pane"
    :class="zoneClass"
    data-zone="bag"
    data-testid="stash-bag-pane"
    :aria-label="t('stash.bag')"
  >
    <header class="head">
      <h3>{{ t('stash.bag') }}</h3>
      <span
        class="load"
        :class="{ 'is-heavy': isHeavy, 'is-over': isOver }"
        data-testid="stash-load-value"
        >{{ weightText }}</span
      >
    </header>
    <div class="loadbar" aria-hidden="true">
      <i
        :class="{ 'is-heavy': isHeavy, 'is-over': isOver, 'is-blink': stashFx.blinkWeight }"
        :style="{ width: loadWidth }"
      ></i>
    </div>
    <stash-scroll-box
      class="bag-scroll"
      :style="props.rows ? { '--bag-rows': props.rows } : undefined"
      more-selector="[data-item-key]"
      more-testid="stash-more-bag"
    >
      <div class="grid" data-cell-grid data-columns="7">
        <stash-cell
          v-for="(cell, position) in bagView"
          :key="cell.index"
          :item="cell.item"
          :testid="`stash-bag-cell-${position}`"
          :location="{ container: 'bag', index: cell.index }"
        />
      </div>
    </stash-scroll-box>
  </section>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStashBoardData } from '@/composables/use-stash-board-data';
import { stashFx } from '@/composables/stash-drag-state';
import { BOARD_CELL_CONTEXT, STASH_CELL_CONTEXT } from '@/composables/board-cell-context';
import StashCell from './stash-cell.vue';
import StashScrollBox from './stash-scroll-box.vue';

const { t } = useI18n();
const context = inject(BOARD_CELL_CONTEXT, STASH_CELL_CONTEXT);
const props = defineProps<{ rows?: number }>();
const { bagView, carried, capacity, loadRatio, isHeavy, isOver } = useStashBoardData();
const weightText = computed(() => {
  const next = context.forecastKg?.() ?? null;
  if (next === null || next === carried.value) {
    return t('stash.weight', { current: carried.value, max: capacity.value });
  }
  return `${carried.value} → ${next} / ${capacity.value} kg`;
});
const loadWidth = computed(() => `${Math.round(loadRatio.value * 100)}%`);
const zoneClass = computed(() => context.zoneClassOf('bag'));
</script>

<style scoped>
.pane {
  flex: 0 1 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  padding: 8px var(--stash-pad) 8px;
  background: rgba(0, 0, 0, 0.35);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}
.pane.zone-ok {
  box-shadow:
    0 0 0 2px rgba(255, 200, 120, 0.5) inset,
    0 0 16px rgba(255, 200, 120, 0.45),
    0 0 30px rgba(255, 200, 120, 0.25);
}
.pane.zone-bad {
  box-shadow:
    0 0 0 2px rgba(255, 120, 120, 0.5) inset,
    0 0 16px rgba(255, 80, 80, 0.4);
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
h3 {
  margin: 0;
  font-family: var(--font-main, serif), serif;
  font-size: 0.95rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.06em;
  color: rgba(255, 236, 186, 0.95);
}
.load {
  color: rgba(255, 236, 186, 0.95);
  font-size: 0.78rem;
  font-weight: 700;
}
.load.is-heavy {
  color: #ffc878;
}
.load.is-over {
  color: #ff9d9d;
}
.loadbar {
  height: 5px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.6);
  overflow: hidden;
}
.loadbar i {
  display: block;
  height: 100%;
  background: rgba(255, 236, 186, 0.75);
  transition: width 0.2s ease;
}
.loadbar i.is-heavy {
  background: #ffc878;
}
.loadbar i.is-over {
  background: #ff9d9d;
}
.loadbar:has(.is-blink) {
  animation: load-blink 0.5s ease-in-out 2;
}
@keyframes load-blink {
  50% {
    box-shadow: 0 0 0 2px rgba(255, 120, 120, 0.6);
  }
}
@media (prefers-reduced-motion: reduce) {
  .loadbar:has(.is-blink) {
    animation: none;
    box-shadow: 0 0 0 2px rgba(255, 120, 120, 0.6);
  }
}
.bag-scroll {
  flex: 0 1
    calc(var(--bag-rows, 6) * var(--stash-cell) + (var(--bag-rows, 6) - 1) * var(--stash-gap));
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, var(--stash-cell));
  gap: var(--stash-gap);
  justify-content: start;
}
</style>
