import type { QuestDefinition } from '@hexoflat/engine/quests/quest-definition';

export const QUEST_CATEGORIES = ['gather', 'combat', 'learn', 'exp'] as const;
export type QuestCategory = (typeof QUEST_CATEGORIES)[number];
export type QuestFilter = 'all' | QuestCategory;

export function categoryOf(quest: QuestDefinition): QuestCategory {
  const objective = quest.objective;
  if (objective.kind === 'expedition') return 'exp';
  if (objective.event === 'BATTLE_CLOSED') return 'combat';
  if (objective.event === 'HALL_ANSWERED') return 'learn';
  return 'gather';
}

export type QuestIcon = 'axes' | 'stones' | 'book' | 'skull' | 'compass' | 'leaf';

const ICON_BY_ID: Readonly<Record<string, QuestIcon>> = {
  woodcutter: 'axes',
  stonebreaker: 'stones',
  scholar: 'book',
  'bone-hunter': 'skull',
};

const ICON_BY_CATEGORY: Readonly<Record<QuestCategory, QuestIcon>> = {
  gather: 'leaf',
  combat: 'skull',
  learn: 'book',
  exp: 'compass',
};

export function iconOf(quest: QuestDefinition): QuestIcon {
  return ICON_BY_ID[quest.id] ?? ICON_BY_CATEGORY[categoryOf(quest)];
}

export function matchesFilter(category: QuestCategory, filter: QuestFilter): boolean {
  return filter === 'all' || filter === category;
}

export function filterCounts(categories: readonly QuestCategory[]): Record<QuestFilter, number> {
  const counts: Record<QuestFilter, number> = {
    all: categories.length,
    gather: 0,
    combat: 0,
    learn: 0,
    exp: 0,
  };
  for (const category of categories) counts[category] += 1;
  return counts;
}

export type QuestReason = 'locked' | 'slots' | 'will' | null;

export function reasonOf(input: {
  state: 'open' | 'locked' | 'taken' | 'finished';
  slotsFull: boolean;
  willShort: boolean;
}): QuestReason {
  if (input.state === 'locked') return 'locked';
  if (input.state !== 'open') return null;
  if (input.slotsFull) return 'slots';
  return input.willShort ? 'will' : null;
}
