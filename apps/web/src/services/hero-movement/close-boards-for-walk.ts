import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useTraderStore } from '@/stores/trader-store';

export function closeBoardsForWalk(): void {
  const stash = useHeroStashStore();
  const trader = useTraderStore();
  if (!stash.isOpen && !trader.isOpen) return;
  stash.close();
  trader.close();
  useHeroToolStore().stopTool();
}
