import type { TTraderKey } from '@hexoflat/engine/content/traders.content';
import { isHeroBoardOpen } from '@/composables/use-hero-board-collapse';
import { closeKnowledgePanel, knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { closeStashBoard } from '@/composables/use-stash-board';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useTraderStore } from '@/stores/trader-store';
import { shopDragCancel } from '@/composables/use-shop-drag';
import { clearShopSelection } from '@/composables/shop-selection';

export function openShopBoard(key: TTraderKey): void {
  if (useHeroStashStore().isOpen) closeStashBoard();
  if (knowledgePanelMode.value) void closeKnowledgePanel(false);
  useTraderStore().open(key);
  isHeroBoardOpen.value = true;
}

export function closeShopBoard(): void {
  clearShopSelection();
  shopDragCancel();
  useTraderStore().close();
}
