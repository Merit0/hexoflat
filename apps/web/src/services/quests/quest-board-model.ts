import { CONTENT } from '@hexoflat/engine';
import { HEXOBJECT_KEYS, type THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import type { QuestDefinition } from '@hexoflat/engine/quests/quest-definition';
import { QUEST_BOARD_SIZE } from '@hexoflat/engine/quests/quest-offer';

export const QUEST_CATEGORIES = ['gather', 'combat', 'learn', 'exp'] as const;
export type QuestCategory = (typeof QUEST_CATEGORIES)[number];

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

export function spriteKeyOf(templateId: string, category: QuestCategory): THexobjectKey {
  return SPRITE_KEY_BY_ID[templateId] ?? SPRITE_KEY_BY_CATEGORY[category];
}

export function spritePathOf(templateId: string, category: QuestCategory): string {
  return CONTENT[spriteKeyOf(templateId, category)].spritePath ?? '';
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

export const QUEST_BOARD_LIMIT = QUEST_BOARD_SIZE;

export function capQuests<T extends { taken: boolean }>(
  rows: readonly T[],
  max: number = QUEST_BOARD_LIMIT,
): T[] {
  return [...rows.filter((row) => row.taken), ...rows.filter((row) => !row.taken)].slice(0, max);
}
