import { apiClient } from '@/api/client';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { inventorySession } from '@/services/inventory/inventory-session';
import { applyProgress, settleInventorySync } from '@/services/inventory/inventory-sync';
import type { ProjectedAggregate } from '@/services/player/player-socket';
import { questProjection } from '@/services/quests/quest-projection';
import type { TestQuestFixture, TestQuests } from './test-api.types';

async function setQuestsOnServer(fixture: TestQuestFixture): Promise<void> {
  if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
  await settleInventorySync();
  let answer: { aggregates: { progress?: ProjectedAggregate } };
  try {
    answer = await apiClient.post<typeof answer>('/player/dev/quest-fixture', fixture, {
      headers: { 'X-Player-Session': inventorySession.sessionToken ?? '' },
    });
  } catch (error) {
    throw new Error(
      `Quest fixture refused (start the API with HEXOFLAT_E2E_FIXTURES=1): ${String(error)}`,
    );
  }
  applyProgress(answer.aggregates.progress);
}

export const questTestApi = {
  getQuests(): TestQuests {
    const log = questProjection.value;
    return { active: log.active.map((entry) => ({ ...entry })), done: { ...log.done } };
  },
  getOpenQuestBoard(): boolean {
    return knowledgePanelMode.value === 'quests';
  },
  setQuests: setQuestsOnServer,
};
