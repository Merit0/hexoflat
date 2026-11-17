import type { Reward } from '@hexoflat/engine/quests/quest-definition';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { i18n } from '@/i18n';
import { itemName } from '@/composables/shop-messages';

export function isSingleItem(reward: Reward): boolean {
  return reward.kind === 'item' && !resolveInventoryView(reward.itemKey).stackable;
}

export function rewardText(reward: Reward): string {
  if (reward.kind === 'will') return i18n.global.t('quest.reward.will', { n: reward.amount });
  if (isSingleItem(reward)) return itemName(reward.itemKey);
  return `${reward.amount} × ${itemName(reward.itemKey)}`;
}
