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
      <div class="actions">
        <button
          type="button"
          class="icon-btn"
          :title="t('stash.action.store')"
          :aria-label="t('stash.action.store')"
          data-testid="stash-store-resources"
          @click="onStore"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="ICON_PATHS.chest" /></svg>
        </button>
        <button
          type="button"
          class="icon-btn"
          :title="t('stash.action.sort')"
          :aria-label="t('stash.action.sort')"
          data-testid="stash-sort"
          @click="onSort"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="ICON_PATHS.sort" /></svg>
        </button>
      </div>
    </header>
    <stash-chest-tabs />
    <div v-if="hasChest" class="filters" role="group" :aria-label="t('stash.stash')">
      <button
        v-for="filter in STASH_FILTERS"
        :key="filter"
        type="button"
        class="filter"
        :class="{ 'is-active': stash.filter === filter }"
        :aria-pressed="stash.filter === filter"
        :data-testid="`stash-filter-${filter}`"
        @click="stash.setFilter(filter)"
      >
        {{ stashFilterText(filter) }}
      </button>
    </div>
    <div v-if="hasChest" class="grid" data-testid="stash-chest-grid">
      <stash-cell
        v-for="cell in activeCells"
        :key="cell.index"
        :item="cell.item"
        :dim="isDimmed(cell.item, stash.filter)"
        :testid="`stash-cell-${cell.index}`"
        :location="{ container: 'stash', index: cell.index }"
      />
    </div>
    <stash-chest-shop v-else />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ICON_PATHS } from '@/components/gui/icons/item-icons';
import { STASH_FILTERS, isDimmed } from '@/composables/stash-filter';
import {
  stashErrorText,
  stashFilterText,
  stashNothingToStoreText,
  warnHero,
} from '@/composables/stash-messages';
import { useStashBoardData } from '@/composables/use-stash-board-data';
import { useStashZoneClass } from '@/composables/use-stash-zone-class';
import { sortStash, storeResources } from '@/services/inventory/stash-transfer';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import StashCell from './stash-cell.vue';
import StashChestShop from './stash-chest-shop.vue';
import StashChestTabs from './stash-chest-tabs.vue';

const { t } = useI18n();
const stash = useHeroStashStore();
const heroToolStore = useHeroToolStore();
const { activeCells, stashUsed, stashCapacity } = useStashBoardData();
const zoneClass = useStashZoneClass('stash');
const hasChest = computed(() => stash.activeChest < stash.chests);

function noChestYet(): boolean {
  if (stash.chests > 0) return false;
  warnHero(stashErrorText('NO_CHEST'));
  return true;
}

function onStore() {
  if (noChestYet()) return;
  const result = storeResources();
  if (!result.ok) warnHero(stashErrorText(result.reason));
  else if (result.kind === 'noop') {
    heroToolStore.setActionMessage(stashNothingToStoreText(), null, null, 'info');
  }
}

function onSort() {
  if (noChestYet()) return;
  const result = sortStash();
  if (!result.ok) warnHero(stashErrorText(result.reason));
}
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
  margin-right: auto;
  color: rgba(255, 236, 186, 0.95);
  font-size: 0.78rem;
  font-weight: 700;
}
.actions {
  display: flex;
  gap: 4px;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  min-height: 0;
  height: 28px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(120, 160, 170, 0.24);
  box-shadow: none;
  color: rgba(255, 255, 255, 0.85);
}
.icon-btn:hover {
  background: rgba(138, 173, 180, 0.3);
  border-color: rgba(255, 220, 150, 0.55);
  color: rgba(255, 236, 186, 0.95);
}
.icon-btn svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.filter {
  min-height: 0;
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
  box-shadow: none;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.filter:hover {
  background: rgba(138, 173, 180, 0.2);
}
.filter.is-active {
  border-color: rgba(255, 220, 150, 0.55);
  background: rgba(120, 160, 170, 0.26);
  color: rgba(255, 236, 186, 0.95);
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, var(--stash-cell));
  gap: var(--stash-gap);
  justify-content: center;
}
</style>
