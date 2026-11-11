<template>
  <Teleport to="body">
    <div
      v-if="shopDrag.active && shopDrag.item"
      class="ghost"
      :style="ghostStyle"
      data-testid="shop-drag-ghost"
    >
      <stash-item-token :item="shopDrag.item" ghost />
      <span
        v-if="badge"
        class="badge"
        :class="`is-${badge.tone}`"
        :data-label="badge.id"
        data-testid="shop-drag-badge"
        >{{ badgeText }}</span
      >
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { shopDrag } from '@/composables/shop-drag-state';
import { describeShopDrop } from '@/composables/shop-drop';
import { shopDropText } from '@/composables/shop-messages';
import StashItemToken from '../stash/stash-item-token.vue';

const ghostStyle = computed(() => ({
  left: `${shopDrag.x - shopDrag.offsetX}px`,
  top: `${shopDrag.y - shopDrag.offsetY}px`,
  width: `${shopDrag.width}px`,
  height: `${shopDrag.height}px`,
  transform: `scale(${shopDrag.target?.kind === 'bag-cell' ? 1.12 : 1.05})`,
}));

const badge = computed(() => describeShopDrop(shopDrag.plan));
const badgeText = computed(() => (badge.value ? shopDropText(badge.value) : ''));
</script>

<style scoped src="../../../../components/gui/board/board-drag-ghost.css"></style>
