import { BATTLE_ITEMS, hexobjectOfBattleItem } from '@hexoflat/engine/battle/battle-catalogue';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';

export function battleToolKeyOf(itemKey: string | null | undefined): string {
  if (!itemKey) return HEXOBJECT_KEYS.HAND;
  const own = hexobjectOfBattleItem(itemKey);
  if (own) return own;
  const def = BATTLE_ITEMS[itemKey];
  if (def?.shieldCapacity) return HEXOBJECT_KEYS.SHIELD;
  if (def?.power) return HEXOBJECT_KEYS.SWORD;
  return HEXOBJECT_KEYS.HAND;
}
