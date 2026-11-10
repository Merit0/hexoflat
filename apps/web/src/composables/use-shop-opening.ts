import { computed, watch, type ComputedRef } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { TRADER_KEYS, TRADERS, type TTraderKey } from '@hexoflat/engine/content/traders.content';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useTraderStore } from '@/stores/trader-store';
import { useWorldMapStore } from '@/stores/world-map-store';

export function traderAtStall(hexobjectKey: string | undefined): TTraderKey | null {
  return TRADER_KEYS.find((key) => TRADERS[key].stallHexobjectKey === hexobjectKey) ?? null;
}

export function useShopOpening(activeTool: ComputedRef<unknown>) {
  const worldStore = useWorldMapStore();
  const heroToolStore = useHeroToolStore();
  const trader = useTraderStore();

  const isOpening = computed(() => trader.isOpen && !!activeTool.value);

  const stallCoordinates = computed<IHexCoordinates | null>(() => {
    const key = trader.traderKey;
    if (!key) return null;
    const stall = TRADERS[key].stallHexobjectKey;
    return (
      worldStore.map?.tiles.find((tile) => tile.hexobject?.hexobjectKey === stall)?.coordinates ??
      null
    );
  });

  const anchor = computed<IHexCoordinates | null>(() =>
    isOpening.value ? stallCoordinates.value : null,
  );

  watch(
    () => trader.isOpen,
    (now, previous) => {
      if (previous && !now) heroToolStore.stopTool();
    },
  );

  return { isOpening, anchor };
}
