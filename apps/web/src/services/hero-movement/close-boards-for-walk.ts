import { knowledgePanelMode, closeKnowledgePanel } from '@/composables/use-knowledge-panel';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useTraderStore } from '@/stores/trader-store';

export function closeBoardsForWalk(): void {
  const stash = useHeroStashStore();
  const trader = useTraderStore();
  const questsOpen = knowledgePanelMode.value === 'quests';
  if (!stash.isOpen && !trader.isOpen && !questsOpen) return;
  stash.close();
  trader.close();
  if (questsOpen) void closeKnowledgePanel(false);
  useHeroToolStore().stopTool();
}
