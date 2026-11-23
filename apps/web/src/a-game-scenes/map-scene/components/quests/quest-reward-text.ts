import type { Reward } from '@hexoflat/engine/quests/quest-definition';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { i18n } from '@/i18n';
import { itemName } from '@/composables/shop-messages';
import { tokenName } from '@/services/tokens/token-text';

export function isSingleItem(reward: Reward): boolean {
  return (
    reward.kind === 'item' && reward.amount === 1 && !resolveInventoryView(reward.itemKey).stackable
  );
}

export function rewardText(reward: Reward): string {
  if (reward.kind === 'will') return i18n.global.t('quest.reward.will', { n: reward.amount });
  const name = reward.token ? tokenName(reward.token) : itemName(reward.itemKey);
  return isSingleItem(reward) ? name : `${reward.amount} × ${name}`;
}
