<template>
  <div
    class="cell"
    :class="classes"
    :data-testid="testid"
    :data-item-key="item?.key"
    :data-item-amount="item?.amount"
    :data-rarity="rarity"
    :data-drop-container="location.container"
    :data-drop-index="location.container === 'equip' ? undefined : location.index"
    :data-drop-slot="location.container === 'equip' ? location.slot : undefined"
    :tabindex="item ? 0 : undefined"
    :role="item ? 'button' : undefined"
    :aria-label="label"
    @pointerdown.prevent="onPointerDown"
    @dblclick.prevent="onQuickMove"
    @contextmenu.prevent="onQuickMove"
    @keydown.enter.prevent="onQuickMove"
  >
    <slot name="placeholder" />
    <stash-item-token v-if="item && !isLifted" :item="item" />
    <span v-if="showsCounter(item) && !isLifted" class="amount">{{ item?.amount }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMeta, getPrototype } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { TItemLocation } from '@hexoflat/engine/inventory/item-location';
import { getObjectRarityTone } from '@/render/rarity';
import { showsCounter } from '@/composables/item-counter';
import { locationKey, stashDrag, stashFx } from '@/composables/stash-drag-state';
import { beginStashDrag, quickMove } from '@/composables/use-stash-drag';
import StashItemToken from './stash-item-token.vue';

const props = defineProps<{
  item: InventoryItem | null;
  testid: string;
  location: TItemLocation;
}>();

const i18n = useI18n();
const key = computed(() => locationKey(props.location));

const rarity = computed(() =>
  props.item ? (getObjectRarityTone(getPrototype(props.item.key)) ?? undefined) : undefined,
);

const label = computed(() => {
  if (!props.item) return undefined;
  const title = getMeta(props.item.key).title;
  return i18n.te(title) ? i18n.t(title) : title;
});

const isTarget = computed(
  () =>
    stashDrag.active &&
    stashDrag.target?.kind === 'cell' &&
    locationKey(stashDrag.target.at) === key.value,
);
const isLifted = computed(
  () => stashDrag.active && !!stashDrag.from && locationKey(stashDrag.from) === key.value,
);
const isNext = computed(
  () => stashDrag.active && !!stashDrag.nextHint && locationKey(stashDrag.nextHint) === key.value,
);

const classes = computed(() => ({
  'cursor-grab': !!props.item,
  'is-lifted': isLifted.value,
  'is-next': isNext.value && !isTarget.value,
  'is-valid': isTarget.value && !!stashDrag.preview?.ok && stashDrag.preview.kind !== 'noop',
  'is-invalid': isTarget.value && stashDrag.preview?.ok === false,
  'is-landed': stashFx.landed === key.value,
  'is-shake': stashFx.shake === key.value,
}));

function onPointerDown(event: PointerEvent) {
  if (props.item) beginStashDrag(event, props.location, props.item);
}

function onQuickMove(event: MouseEvent | KeyboardEvent) {
  if (props.item) quickMove(props.location, event.shiftKey);
}
</script>

<style scoped>
.cell {
  position: relative;
  aspect-ratio: 1;
  min-width: 0;
  display: grid;
  place-items: center;
  border-radius: 5px;
  background: rgba(120, 160, 170, 0.24);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.3);
  touch-action: none;
  user-select: none;
  outline: none;
  transition:
    background 0.12s ease,
    border-color 0.12s ease,
    box-shadow 0.12s ease,
    opacity 0.12s ease;
}
.cell:hover {
  background: rgba(138, 173, 180, 0.3);
}
.cell:focus-visible {
  border-color: rgba(255, 220, 150, 0.7);
}
.cell.is-next {
  border: 1px dashed rgba(255, 220, 150, 0.5);
}
.cell.is-valid {
  border-color: rgba(255, 220, 150, 0.55);
  box-shadow:
    0 0 0 2px rgba(255, 200, 120, 0.5) inset,
    0 0 16px rgba(255, 200, 120, 0.45),
    0 0 30px rgba(255, 200, 120, 0.25),
    0 6px 14px rgba(0, 0, 0, 0.3);
}
.cell.is-invalid {
  border-color: rgba(255, 120, 120, 0.6);
  box-shadow:
    0 0 0 2px rgba(255, 120, 120, 0.5) inset,
    0 0 16px rgba(255, 80, 80, 0.4),
    0 6px 14px rgba(0, 0, 0, 0.3);
}
.cell.is-landed {
  animation: cell-land 0.28s ease-out;
}
.cell.is-shake {
  animation: cell-shake 0.3s ease-in-out;
}
@keyframes cell-land {
  from {
    transform: scale(1.12);
  }
  to {
    transform: scale(1);
  }
}
@keyframes cell-shake {
  25% {
    transform: translateX(-3px);
  }
  75% {
    transform: translateX(3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .cell.is-landed,
  .cell.is-shake {
    animation: none;
  }
}
.amount {
  position: absolute;
  bottom: 0;
  right: 0;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 900;
  font-size: 11px;
  pointer-events: none;
}
</style>
