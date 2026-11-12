import { CONTENT } from '@hexoflat/engine';
import { HEXOBJECT_KEYS, type THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
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

const SPRITE_KEY_BY_ID: Readonly<Record<string, THexobjectKey>> = {
  woodcutter: HEXOBJECT_KEYS.TREE,
  stonebreaker: HEXOBJECT_KEYS.ROCK,
  scholar: HEXOBJECT_KEYS.KNOWLEDGE_BOOK,
  'bone-hunter': HEXOBJECT_KEYS.LONE_SKELETON,
};

const SPRITE_KEY_BY_CATEGORY: Readonly<Record<QuestCategory, THexobjectKey>> = {
  gather: HEXOBJECT_KEYS.TREE,
  combat: HEXOBJECT_KEYS.LONE_SKELETON,
  learn: HEXOBJECT_KEYS.KNOWLEDGE_BOOK,
  exp: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
};

export function spriteKeyOf(quest: QuestDefinition): THexobjectKey {
  return SPRITE_KEY_BY_ID[quest.id] ?? SPRITE_KEY_BY_CATEGORY[categoryOf(quest)];
}

export function spritePathOf(quest: QuestDefinition): string {
  return CONTENT[spriteKeyOf(quest)].spritePath ?? '';
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

export type QuestReason = 'slots' | 'will' | null;

export function reasonOf(input: {
  state: 'open' | 'locked' | 'taken' | 'finished';
  slotsFull: boolean;
  willShort: boolean;
}): QuestReason {
  if (input.state !== 'open') return null;
  if (input.slotsFull) return 'slots';
  return input.willShort ? 'will' : null;
}
