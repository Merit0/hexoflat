<template>
  <img
    v-if="reward.kind === 'will'"
    class="will-icon"
    :src="WILL_ICON_URL"
    alt=""
    aria-hidden="true"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
  <span
    v-else
    class="item-icon"
    :style="style"
    aria-hidden="true"
    @mouseenter="showTip"
    @mouseleave="hideItemTooltip()"
  ></span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';
import type { Reward } from '@hexoflat/engine/quests/quest-definition';
import { WILL_ICON_URL } from '@/composables/use-hero-details';
import { hideItemTooltip, showItemTooltip } from '@/composables/use-item-tooltip';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { tokenSpriteUrl } from '@/render/token-look';

const props = withDefaults(defineProps<{ reward: Reward; size?: number; tooltip?: boolean }>(), {
  size: 18,
  tooltip: false,
});

function showTip(event: MouseEvent) {
  const reward = props.reward;
  if (!props.tooltip || reward.kind !== 'item') return;
  const view = resolveInventoryView(reward.itemKey);
  const id = reward.token?.id ?? `quest-reward-${reward.itemKey}`;
  showItemTooltip(id, event.currentTarget as HTMLElement, {
    item: {
      id,
      key: reward.itemKey,
      type: view.group,
      amount: reward.amount,
      slotKey: id,
      isNew: false,
      ...(reward.token ? { token: reward.token } : {}),
    },
  });
}

onBeforeUnmount(hideItemTooltip);

const style = computed(() => {
  const reward = props.reward;
  const path =
    reward.kind === 'item'
      ? reward.token
        ? tokenSpriteUrl(reward.token)
        : resolveInventoryView(reward.itemKey).iconPath
      : '';
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    backgroundImage: path ? `url("${path}")` : 'none',
  };
});
</script>

<style scoped>
.item-icon {
  display: inline-block;
  flex: none;
}
.will-icon {
  flex: none;
  object-fit: contain;
}
.item-icon {
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}
</style>
