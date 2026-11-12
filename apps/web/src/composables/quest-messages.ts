import { i18n } from '@/i18n';
import type { QuestRefusal } from '@hexoflat/engine/quests/quest-definition';

export function questRefusalText(reason: string): string {
  const t = i18n.global.t;
  const known: Record<QuestRefusal, () => string> = {
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
  };
  return (
    (known as Record<string, (() => string) | undefined>)[reason]?.() ?? t('quest.refusal.OTHER')
  );
}
