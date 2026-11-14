import type { Reward } from '@hexoflat/engine/quests/quest-definition';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { i18n } from '@/i18n';
import { itemName } from '@/composables/shop-messages';

export function rewardText(reward: Reward): string {
  if (reward.kind === 'will') return i18n.global.t('quest.reward.will', { n: reward.amount });
  return `${reward.amount} × ${itemName(reward.itemKey)}`;
}
