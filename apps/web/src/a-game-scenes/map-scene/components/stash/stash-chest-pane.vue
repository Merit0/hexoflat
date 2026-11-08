<template>
  <section class="pane" data-testid="stash-chest-pane" :aria-label="t('stash.stash')">
    <header class="head">
      <h3>{{ t('stash.stash') }}</h3>
      <span class="count" data-testid="stash-count">{{
        t('stash.count', { used: stashUsed, total: stashCapacity })
      }}</span>
    </header>
    <stash-scroll-box>
      <div class="grid">
        <stash-cell
          v-for="(item, index) in stash"
          :key="index"
          :item="item"
          :testid="`stash-cell-${index}`"
        />
      </div>
    </stash-scroll-box>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useStashBoardData } from '@/composables/use-stash-board-data';
import StashCell from './stash-cell.vue';
import StashScrollBox from './stash-scroll-box.vue';

const { t } = useI18n();
const { stash, stashUsed, stashCapacity } = useStashBoardData();
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  padding: 8px 10px;
  container-type: inline-size;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
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
  color: #ffe98a;
}
.count {
  color: rgba(241, 228, 204, 0.85);
  font-size: 0.78rem;
  font-weight: 700;
}
.grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 6px;
}
@container (max-width: 440px) {
  .grid {
    gap: 4px;
  }
}
</style>
