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
    @pointerdown.prevent="onPointerDown"
    @dblclick.prevent="onQuickMove"
    @contextmenu.prevent="onQuickMove"
    @keydown.enter.prevent="onQuickMove"
    @keydown="onNavigate"
  >
    <slot name="placeholder" />
    <stash-item-token v-if="item && !isLifted" :item="item" :price="tooltipPrice" />
    <span v-if="showsCounter(item) && !isLifted" class="amount">{{ item?.amount }}</span>
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
import { locationKey, stashDrag, stashFx } from '@/composables/stash-drag-state';
import { isGridNavKey, nextCellIndex } from '@/composables/stash-grid-nav';
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
  'is-dim': !!props.dim,
  'is-next': isNext.value && !isTarget.value,
  'is-valid': isTarget.value && !!stashDrag.preview?.ok && stashDrag.preview.kind !== 'noop',
  'is-invalid': isTarget.value && stashDrag.preview?.ok === false,
  'is-landed': stashFx.landed === key.value,
  'is-shake': stashFx.shake === key.value,
}));

function onPointerDown(event: PointerEvent) {
  if (props.item) context.begin(event, props.location, props.item);
}

function onNavigate(event: KeyboardEvent) {
  if (!isGridNavKey(event.key)) return;
  const current = event.currentTarget as HTMLElement;
  const grid = current.closest<HTMLElement>('[data-cell-grid]');
  if (!grid) return;
  const cells = [...grid.querySelectorAll<HTMLElement>('[data-drop-container]')];
  const columns = Number(grid.dataset.columns) || 1;
  const target = nextCellIndex(cells.indexOf(current), event.key, columns, cells.length);
  event.preventDefault();
  if (target !== null) cells[target].focus();
}

function onQuickMove(event: MouseEvent | KeyboardEvent) {
  if (props.item) context.quick(props.location, event.shiftKey);
}
</script>

<style scoped src="../../../../components/gui/board/board-cell.css"></style>
