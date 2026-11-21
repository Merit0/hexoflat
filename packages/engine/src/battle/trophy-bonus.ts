import { resolveItemStats } from '../tokens/equipment/item-stats';
import type { BattleCreature, BattleItem } from './battle-state';

export function trophyBonusFor(attacker: BattleCreature, weapon: BattleItem | null): number {
  if (attacker.side !== 'heroes' || !weapon?.token) return 0;
  return resolveItemStats({ key: weapon.token.type, token: weapon.token }).graveLootBonus;
}
