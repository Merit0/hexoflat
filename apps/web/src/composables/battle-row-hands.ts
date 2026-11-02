import type { BattleCreature, BattleHand, BattleItem } from '@hexoflat/engine/battle/battle-state';
import { battleToolKeyOf } from '@/render/battle/battle-tool-key';

export interface BattleRowHand {
  hand: BattleHand;
  toolKey: string;
  itemKey: string | null;
}

export function rowToolKey(item: BattleItem | null): string {
  return battleToolKeyOf(item?.key);
}

export function rowHands(creature: Pick<BattleCreature, 'hands'>): BattleRowHand[] {
  return (['right', 'left'] as BattleHand[]).map((hand) => {
    const item = creature.hands[hand];
    return { hand, toolKey: rowToolKey(item), itemKey: item?.key ?? null };
  });
}
