import { computed } from 'vue';
import type { HexTileModel } from '@hexoflat/engine/map/models/hex-tile-model';
import type { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { actionWillCost } from '@hexoflat/engine/knowledge/will';
import { willZoneCharges } from '@hexoflat/engine/knowledge/will-zone';
import { useHeroStore } from '@/stores/hero-store';

export function useWillPricing() {
  const heroStore = useHeroStore();
  const will = computed(() => heroStore.knowledge?.current ?? 0);
  const charges = computed(() => willZoneCharges(heroStore.willZoneContext));

  function costOf(tile: HexTileModel | null, actionType: EHexActionType | undefined): number {
    if (!tile || !actionType || !charges.value) return 0;
    return actionWillCost(tile, actionType);
  }

  function canAfford(cost: number): boolean {
    return cost <= will.value;
  }

  return { costOf, canAfford };
}
