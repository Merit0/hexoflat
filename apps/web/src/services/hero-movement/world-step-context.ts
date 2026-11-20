import type { StepWillContext } from '@hexoflat/engine/knowledge/math';
import { resolveHeroStats } from '@hexoflat/engine/tokens/equipment/hero-stats';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';

export function worldStepContext(paidSteps: number): StepWillContext {
  return {
    paidSteps,
    stepFreeEvery: resolveHeroStats(Object.values(useHeroInventoryStore().equippedItems))
      .stepFreeEvery,
  };
}
