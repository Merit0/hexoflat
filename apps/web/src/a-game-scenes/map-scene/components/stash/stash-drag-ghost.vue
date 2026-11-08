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

<style scoped>
.ghost {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  transition: none;
  filter: brightness(1.15);
}
.badge {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 800;
  background: linear-gradient(180deg, rgba(43, 46, 52, 0.95), rgba(18, 12, 8, 0.96));
  border: 1px solid rgba(170, 252, 255, 0.35);
  color: rgba(255, 236, 186, 0.95);
}
.badge.is-ok {
  border-color: rgba(255, 220, 150, 0.55);
}
.badge.is-bad {
  border-color: rgba(255, 120, 120, 0.6);
  color: #ff9d9d;
}
</style>
