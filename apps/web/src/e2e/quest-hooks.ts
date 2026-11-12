import { apiClient } from '@/api/client';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { inventorySession } from '@/services/inventory/inventory-session';
import { applyProgress, settleInventorySync } from '@/services/inventory/inventory-sync';
import type { ProjectedAggregate } from '@/services/player/player-socket';
import { questProjection } from '@/services/quests/quest-projection';
import { questRun } from '@/services/quests/quest-run-projection';
import { buildQuestField } from '@/services/quests/quest-field-model';
import type { TestQuestField, TestQuestFixture, TestQuests } from './test-api.types';

export interface QuestHexPoint {
  x: number;
  y: number;
}

let hexProbe: ((hex: { columnIndex: number; rowIndex: number }) => QuestHexPoint | null) | null =
  null;

export function registerQuestHexProbe(probe: typeof hexProbe): void {
  hexProbe = probe;
}

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
  getQuestField(): TestQuestField | null {
    const run = questRun.value;
    if (!run) return null;
    const model = buildQuestField(run);
    return {
      phase: run.phase,
      outcome: run.outcome,
      position: run.position,
      path: run.path.map((step) => step.number),
      pathHexes: run.path.map((step) => step.hex),
      hintHex: run.hintHex,
      chest: run.chest ? run.chest.hex : null,
      stepCost: run.stepCost,
      backCost: run.backCost,
      hexes: model.hexes.map((cell) => ({
        hex: cell.hex,
        number: cell.number,
        hint: cell.hint,
        footprint: cell.footprint,
        step: cell.step,
      })),
    };
  },
  getQuestHexPoint(columnIndex: number, rowIndex: number): QuestHexPoint | null {
    return hexProbe ? hexProbe({ columnIndex, rowIndex }) : null;
  },
};
