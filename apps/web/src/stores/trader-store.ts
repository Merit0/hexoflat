import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { TTraderKey } from '@hexoflat/engine/content/traders.content';
import type { TraderState } from '@hexoflat/engine/trade/trade-state';
import { traderProjection } from '@/services/trade/trader-projection';

export const useTraderStore = defineStore('trader', () => {
  const traderKey = ref<TTraderKey | null>(null);

  const isOpen = computed(() => traderKey.value !== null);
  const trips = computed(() => traderProjection.value.trips);
  const view = computed<TraderState | null>(() =>
    traderKey.value ? (traderProjection.value.traders[traderKey.value] ?? null) : null,
  );

  function open(key: TTraderKey) {
    traderKey.value = key;
  }

  function close() {
    traderKey.value = null;
  }

  return { traderKey, isOpen, trips, view, open, close };
});
