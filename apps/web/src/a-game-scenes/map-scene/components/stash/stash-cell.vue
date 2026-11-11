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
    :tabindex="item ? 0 : -1"
    :role="item ? 'button' : undefined"
    :aria-label="label"
    :data-selected="selected || undefined"
    @pointerdown.prevent="onPointerDown"
    @click="onSelect"
    @dblclick.prevent="onQuickMove"
    @contextmenu.prevent="onQuickMove"
    @keydown.enter.prevent="onQuickMove"
    @keydown="onNavigate"
  >
    <slot name="placeholder" />
    <stash-item-token v-if="item && !isLifted" :item="item" :price="tooltipPrice" />
    <span v-if="showsCounter(item) && !isLifted" class="amount">{{ item?.amount }}</span>
    <span v-if="sum !== null && !isLifted" class="sum" data-testid="shop-bag-sum" :data-sum="sum">{{
      sum
    }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { getMeta, getPrototype } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { TItemLocation } from '@hexoflat/engine/inventory/item-location';
import { getObjectRarityTone } from '@/render/rarity';
import { showsCounter } from '@/composables/item-counter';
import { locationKey, stashFx } from '@/composables/stash-drag-state';
import { moveGridFocus } from '@/composables/stash-grid-nav';
import { BOARD_CELL_CONTEXT, STASH_CELL_CONTEXT } from '@/composables/board-cell-context';
import StashItemToken from './stash-item-token.vue';

const props = defineProps<{
  item: InventoryItem | null;
  testid: string;
  location: TItemLocation;
  dim?: boolean;
}>();

const i18n = useI18n();
const context = inject(BOARD_CELL_CONTEXT, STASH_CELL_CONTEXT);
const key = computed(() => locationKey(props.location));
const tooltipPrice = computed(() => {
  const priceOf = context.priceOf;
  return priceOf ? () => priceOf(props.location) : undefined;
});

const rarity = computed(() =>
  props.item ? (getObjectRarityTone(getPrototype(props.item.key)) ?? undefined) : undefined,
);

const label = computed(() => {
  if (!props.item) return undefined;
  const title = getMeta(props.item.key).title;
  return i18n.te(title) ? i18n.t(title) : title;
});

const sum = computed(() => (props.item ? (context.sumOf?.(props.location) ?? null) : null));
const selected = computed(() =>
  props.item ? (context.isSelected?.(props.location, props.item) ?? false) : false,
);
const state = computed(() => context.stateOf(props.location));
const isLifted = computed(() => state.value.lifted);

const classes = computed(() => ({
  'cursor-grab': !!props.item,
  'is-lifted': state.value.lifted,
  'is-dim': !!props.dim,
  'is-selected': selected.value,
  'is-next': state.value.next,
  'is-valid': state.value.valid,
  'is-invalid': state.value.invalid,
  'is-landed': stashFx.landed === key.value,
  'is-shake': stashFx.shake === key.value,
}));

function onPointerDown(event: PointerEvent) {
  if (props.item) context.begin(event, props.location, props.item);
}

function onSelect() {
  if (props.item) context.select?.(props.location, props.item);
}

function onNavigate(event: KeyboardEvent) {
  moveGridFocus(event, '[data-drop-container]');
}

function onQuickMove(event: MouseEvent | KeyboardEvent) {
  if (props.item) context.quick(props.location, event.shiftKey);
}
</script>

<style scoped src="../../../../components/gui/board/board-cell.css"></style>

<style scoped>
.sum {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 1px;
  color: #cfe4f8;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  pointer-events: none;
}
.cell.is-selected {
  border-color: #7fb4e8;
  box-shadow: 0 0 0 2px rgba(127, 180, 232, 0.5) inset;
}
</style>
