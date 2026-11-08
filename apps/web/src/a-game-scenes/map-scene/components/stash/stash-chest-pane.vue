<template>
  <section
    class="pane"
    :class="zoneClass"
    data-zone="stash"
    data-testid="stash-chest-pane"
    :aria-label="t('stash.stash')"
  >
    <header class="head">
      <h3>{{ t('stash.stash') }}</h3>
      <span class="count" data-testid="stash-count">{{
        t('stash.count', { used: stashUsed, total: stashCapacity })
      }}</span>
    </header>
    <stash-chest-tabs />
    <div v-if="stash.activeChest < stash.chests" class="grid" data-testid="stash-chest-grid">
      <stash-cell
        v-for="cell in activeCells"
        :key="cell.index"
        :item="cell.item"
        :testid="`stash-cell-${cell.index}`"
        :location="{ container: 'stash', index: cell.index }"
      />
    </div>
    <stash-chest-shop v-else />
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useStashBoardData } from '@/composables/use-stash-board-data';
import { useStashZoneClass } from '@/composables/use-stash-zone-class';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import StashCell from './stash-cell.vue';
import StashChestShop from './stash-chest-shop.vue';
import StashChestTabs from './stash-chest-tabs.vue';

const { t } = useI18n();
const stash = useHeroStashStore();
const { activeCells, stashUsed, stashCapacity } = useStashBoardData();
const zoneClass = useStashZoneClass('stash');
</script>

<style scoped>
.pane {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px var(--stash-pad) 10px;
  container-type: inline-size;
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
.count {
  color: rgba(255, 236, 186, 0.95);
  font-size: 0.78rem;
  font-weight: 700;
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, var(--stash-cell));
  gap: var(--stash-gap);
  justify-content: center;
}
</style>
