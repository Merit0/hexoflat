import { nextTick, ref } from 'vue';
import { isHeroBoardOpen } from './use-hero-board-collapse';

export const knowledgePanelMode = ref<'hall' | 'return' | null>(null);
export function openKnowledgePanel(mode: 'hall' | 'return') {
  knowledgePanelMode.value = mode;
  isHeroBoardOpen.value = true;
}

export async function closeKnowledgePanel(restoreFocus = true) {
  knowledgePanelMode.value = null;
  await nextTick();
  if (!restoreFocus) return;
  document.querySelector<HTMLButtonElement>('[data-testid="hero-board-toggle"]')?.focus();
}
