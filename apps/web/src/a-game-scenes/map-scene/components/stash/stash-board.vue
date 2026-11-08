<template>
  <section
    ref="board"
    class="stash-board"
    :style="cellStyle"
    data-testid="stash-board"
    :aria-label="t('stash.title')"
  >
    <header class="top">
      <img class="emblem" :src="CHEST_IMAGE" alt="" aria-hidden="true" />
      <h2>{{ t('stash.title') }}</h2>
      <button
        type="button"
        class="close-btn"
        data-testid="stash-close"
        :aria-label="t('stash.close')"
        @click="closeStashBoard()"
      >
        ×
      </button>
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>

    <stash-chest-pane />
    <stash-bag-pane />

    <p class="foot" data-testid="stash-hint">{{ hint }}</p>
    <stash-drag-ghost />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { closeStashBoard } from '@/composables/use-stash-board';
import { stashDrag } from '@/composables/stash-drag-state';
import { useInventoryCellSize } from '@/composables/use-inventory-cell-size';
import { dragCancel } from '@/composables/use-stash-drag';
import StashBagPane from './stash-bag-pane.vue';
import StashChestPane from './stash-chest-pane.vue';
import StashDragGhost from './stash-drag-ghost.vue';

const CHEST_IMAGE = '/hex-assets/hex-loot/stash-chest-token-image.png';

const { t } = useI18n();
const board = ref<HTMLElement | null>(null);
const { style: cellStyle } = useInventoryCellSize(board);

const hint = computed(() => {
  if (!stashDrag.active) return t('stash.hint.idle');
  return stashDrag.split ? t('stash.hint.split') : t('stash.hint.drag');
});

onBeforeUnmount(() => {
  dragCancel();
});
</script>

<style scoped>
.stash-board {
  position: relative;
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.9);
  font-family: var(--font-main, serif), serif;
}
.top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 52px;
}
.emblem {
  width: 40px;
  height: 40px;
  object-fit: contain;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.7));
  pointer-events: none;
}
h2 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.05em;
  text-align: center;
  color: rgba(255, 236, 186, 0.95);
  text-shadow: 0 2px 3px rgba(0, 0, 0, 0.8);
}
.close-btn {
  position: absolute;
  top: 2px;
  right: 8px;
  width: 40px;
  min-height: 40px;
  height: 40px;
  padding: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}
.ornament {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}
.ornament span {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.22), transparent);
}
.ornament i {
  width: 9px;
  height: 9px;
  border: 1px solid rgba(255, 220, 150, 0.55);
  transform: rotate(45deg);
}
.foot {
  margin: 0;
  padding: 2px 10px 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.72rem;
  font-weight: 700;
  text-align: center;
}
</style>
