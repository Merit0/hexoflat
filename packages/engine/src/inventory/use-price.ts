import type { HeroStats } from '../tokens/equipment/hero-stats';

export function usePriceFor(
  item: { usePrice?: number },
  stats: Pick<HeroStats, 'useWillDiscount'>,
): number {
  return item.usePrice ? Math.max(1, item.usePrice - stats.useWillDiscount) : 0;
}
