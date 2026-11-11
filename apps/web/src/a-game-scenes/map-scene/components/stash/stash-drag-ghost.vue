<template>
  <Teleport to="body">
    <div
      v-if="stashDrag.active && stashDrag.item"
      class="ghost"
      :style="ghostStyle"
      data-testid="stash-drag-ghost"
    >
      <stash-item-token :item="stashDrag.item" ghost />
      <span v-if="badge" class="badge" :class="`is-${badge.tone}`" data-testid="stash-drag-badge">{{
        badgeText
      }}</span>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { stashDrag } from '@/composables/stash-drag-state';
import { describeDrop } from '@/composables/stash-drop-label';
import { stashDropText } from '@/composables/stash-messages';
import StashItemToken from './stash-item-token.vue';

const ghostStyle = computed(() => ({
  left: `${stashDrag.x - stashDrag.offsetX}px`,
  top: `${stashDrag.y - stashDrag.offsetY}px`,
  width: `${stashDrag.width}px`,
  height: `${stashDrag.height}px`,
  transform: `scale(${stashDrag.target?.kind === 'cell' ? 1.12 : 1.05})`,
}));

const badge = computed(() => describeDrop(stashDrag.preview, stashDrag.target));
const badgeText = computed(() => (badge.value ? stashDropText(badge.value) : ''));
</script>

<style scoped src="../../../../components/gui/board/board-drag-ghost.css"></style>
