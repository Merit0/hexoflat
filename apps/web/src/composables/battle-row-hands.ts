import type { BattleCreature, BattleHand, BattleItem } from '@hexoflat/engine/battle/battle-state';
import { hexobjectOfBattleItem } from '@hexoflat/engine/battle/battle-catalogue';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';

export interface BattleRowHand {
  hand: BattleHand;
  toolKey: string;
  itemKey: string | null;
}

export function rowToolKey(item: BattleItem | null): string {
  if (!item) return HEXOBJECT_KEYS.HAND;
  const own = hexobjectOfBattleItem(item.key);
  if (own) return own;
  if (item.shieldCapacity) return HEXOBJECT_KEYS.SHIELD;
  if (item.power) return HEXOBJECT_KEYS.SWORD;
  return HEXOBJECT_KEYS.HAND;
}

export function rowHands(creature: Pick<BattleCreature, 'hands'>): BattleRowHand[] {
  return (['right', 'left'] as BattleHand[]).map((hand) => {
    const item = creature.hands[hand];
    return { hand, toolKey: rowToolKey(item), itemKey: item?.key ?? null };
  });
}
