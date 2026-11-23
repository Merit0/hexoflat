import { EQUIPMENT_TYPES } from '../content/item-types.content';
import { BATTLE_ITEMS, hexobjectOfBattleItem } from './battle-catalogue';
import { battleHeroStats } from './hero-stats';
import type { BattleCreature, BattleItem } from './battle-state';

export function itemShieldBase(item: BattleItem | null | undefined): {
  sides: number;
} {
  if (!item) return { sides: 0 };
  const prototype = EQUIPMENT_TYPES.find(
    (type) => type.key === (hexobjectOfBattleItem(item.key) ?? item.key),
  );
  if (prototype && prototype.group !== 'defense') return { sides: 0 };
  const typeKey = item.token?.type ?? hexobjectOfBattleItem(item.key) ?? item.key;
  const type = EQUIPMENT_TYPES.find((type) => type.key === typeKey);
  if (type) return { sides: type.block?.sides ?? 0 };
  const native = BATTLE_ITEMS[item.key]?.block;
  if (native) return native;
  // Keep unknown legacy battle items loadable; known gear always reads current content.
  return { sides: item.shieldCapacity ?? 0 };
}

export function battleShieldSides(creature: Pick<BattleCreature, 'hands' | 'equipment'>): number {
  const hands = [creature.hands.right, creature.hands.left];
  if (!hands.some((item) => itemShieldBase(item).sides > 0)) return 0;
  const nativeSides = hands.reduce((sum, item) => {
    if (!item || item.token || hexobjectOfBattleItem(item.key)) return sum;
    return sum + itemShieldBase(item).sides;
  }, 0);
  return battleHeroStats(creature).blockSides + nativeSides;
}

export function itemShieldSides(item: BattleItem | null | undefined): number {
  return item ? battleShieldSides({ hands: { right: item, left: null } }) : 0;
}
