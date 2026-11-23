import { i18n } from '@/i18n';
import { questLootRefusalKey } from '@/services/quests/quest-loot';
import type { QuestBoardRefusal, QuestRefusal } from '@hexoflat/engine/quests/quest-definition';

export function questRefusalText(reason: string): string {
  const t = i18n.global.t;
  const known: Record<QuestRefusal | QuestBoardRefusal, () => string> = {
    UNKNOWN_QUEST: () => t('quest.refusal.UNKNOWN_QUEST'),
    NOT_AT_BOARD: () => t('quest.refusal.NOT_AT_BOARD'),
    QUEST_ALREADY_ACTIVE: () => t('quest.refusal.QUEST_ALREADY_ACTIVE'),
    REQUIREMENTS_NOT_MET: () => t('quest.refusal.REQUIREMENTS_NOT_MET'),
    QUEST_SLOTS_FULL: () => t('quest.refusal.QUEST_SLOTS_FULL'),
    INSUFFICIENT_WILL: () => t('quest.refusal.INSUFFICIENT_WILL'),
    INSUFFICIENT_ITEMS: () => t('quest.refusal.INSUFFICIENT_ITEMS'),
    NOT_ACTIVE: () => t('quest.refusal.NOT_ACTIVE'),
    NOT_READY: () => t('quest.refusal.NOT_READY'),
    AUTO_TURN_IN: () => t('quest.refusal.AUTO_TURN_IN'),
    BAG_FULL: () => t('quest.refusal.BAG_FULL'),
    NO_INVENTORY: () => t('quest.refusal.NO_INVENTORY'),
    QUEST_OFFER_EXPIRED: () => t('quest.refusal.QUEST_OFFER_EXPIRED'),
    QUEST_OFFER_REQUIRED: () => t('quest.refusal.QUEST_OFFER_EXPIRED'),
    QUEST_BOARD_STALE: () => t('quest.refusal.QUEST_BOARD_STALE'),
    QUEST_BOARD_UNCHANGED: () => t('quest.refusal.QUEST_BOARD_UNCHANGED'),
    QUEST_BOARD_LIMIT: () => t('quest.refusal.QUEST_BOARD_LIMIT'),
    NO_ROOM_FOR_QUEST_ENTRANCE: () => t('quest.refusal.NO_ROOM_FOR_QUEST_ENTRANCE'),
  };
  const seeker: Record<string, () => string> = {
    NOT_AT_QUEST_ENTRANCE: () => t('quest.refusal.NOT_AT_QUEST_ENTRANCE'),
    QUEST_SUSPENDED: () => t('quest.refusal.QUEST_SUSPENDED'),
    OTHER_QUEST_SUSPENDED: () => t('quest.refusal.OTHER_QUEST_SUSPENDED'),
    NO_ROOM_FOR_TRAIL: () => t('quest.refusal.NO_ROOM_FOR_TRAIL'),
    QUEST_IN_PROGRESS: () => t('quest.refusal.QUEST_IN_PROGRESS'),
    NOT_ADJACENT: () => t('quest.refusal.NOT_ADJACENT'),
    HEX_NOT_REVEALED: () => t('quest.refusal.HEX_NOT_REVEALED'),
    USE_STEP_BACK: () => t('quest.refusal.USE_STEP_BACK'),
    NOTHING_TO_STEP_BACK: () => t('quest.refusal.NOTHING_TO_STEP_BACK'),
    NO_CHEST: () => t('quest.refusal.NO_CHEST'),
    WRONG_PHASE: () => t('quest.refusal.WRONG_PHASE'),
    BATTLE_OPEN: () => t('quest.refusal.BATTLE_OPEN'),
    NO_RUN: () => t('quest.refusal.NO_RUN'),
    HEX_BLOCKED: () => t('quest.refusal.HEX_BLOCKED'),
    NO_LOOT_THERE: () => t('quest.refusal.NO_LOOT_THERE'),
    OFFLINE: () => t('quest.refusal.OFFLINE'),
    REVISION_CONFLICT: () => t('quest.refusal.QUEST_BOARD_STALE'),
  };
  const lootKey = questLootRefusalKey(reason);
  return (
    seeker[reason]?.() ??
    (known as Record<string, (() => string) | undefined>)[reason]?.() ??
    (lootKey ? t(lootKey) : undefined) ??
    t('quest.refusal.OTHER')
  );
}
