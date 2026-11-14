import { SEEKER_CARDS, type SeekerCard } from './seeker-content';
import { catalogueOf } from './quests.content';
import type { QuestDefinition } from './quest-definition';

export function seekerQuestOf(card: SeekerCard): QuestDefinition {
  return {
    id: card.id,
    nameKey: card.nameKey,
    descKey: card.descKey,
    repeat: 'repeatable',
    requires: card.requiresCleanOf ? [{ kind: 'questDone', questId: card.requiresCleanOf }] : [],
    accept: { kind: 'will', amount: card.entryWill },
    objective: { kind: 'expedition', expedition: 'treasureSeeker', params: card.params },
    rewards: [],
    turnIn: 'auto',
    maxSellValue: card.maxSellValue,
    tableRule: card.tableRule,
  };
}

export const SEEKER_QUESTS: readonly QuestDefinition[] = SEEKER_CARDS.map(seekerQuestOf);

export const SEEKER_CATALOGUE = catalogueOf(SEEKER_QUESTS);
