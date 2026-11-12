<template>
  <span
    v-if="reward.kind === 'will'"
    class="will-gem"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  ></span>
  <span v-else class="item-icon" :style="style" aria-hidden="true"></span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Reward } from '@hexoflat/engine/quests/quest-definition';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';

const props = withDefaults(defineProps<{ reward: Reward; size?: number }>(), { size: 18 });

const style = computed(() => {
  const path =
    props.reward.kind === 'item' ? resolveInventoryView(props.reward.itemKey).iconPath : '';
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    backgroundImage: path ? `url("${path}")` : 'none',
  };
});
</script>

<style scoped>
.will-gem,
.item-icon {
  display: inline-block;
  flex: none;
}
.will-gem {
  background: #5b3fe0;
  border: 1px solid #b89bff;
  transform: rotate(45deg) scale(0.62);
  border-radius: 2px;
}
.item-icon {
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}
</style>
