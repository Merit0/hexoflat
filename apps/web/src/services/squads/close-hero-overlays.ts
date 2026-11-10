import { resetBattleUi } from '@/composables/use-battle-view';
import { closeKnowledgePanel } from '@/composables/use-knowledge-panel';
import { closeStashBoard } from '@/composables/use-stash-board';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';

export function closeHeroOverlays(): void {
  resetBattleUi();
  const tool = useHeroToolStore();
  if (tool.isDragging) tool.stopTool();
  if (useHeroStashStore().isOpen) closeStashBoard();
  void closeKnowledgePanel(false);
}
