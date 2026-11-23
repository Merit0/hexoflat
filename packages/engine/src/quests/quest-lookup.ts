import { ALL_QUESTS } from './all-quests';
import type { QuestCatalogue, QuestDefinition } from './quest-definition';
import type { QuestLog } from './quest-log-state';

/** Active log entries keep using questId. Generated entries point at their saved offer. */
export function questDefinitionFor(
  log: QuestLog,
  questId: string,
  catalogue: QuestCatalogue = ALL_QUESTS,
): QuestDefinition | undefined {
  const offer = log.offers?.find((entry) => entry.id === questId);
  return offer?.definition ?? (Object.hasOwn(catalogue, questId) ? catalogue[questId] : undefined);
}
